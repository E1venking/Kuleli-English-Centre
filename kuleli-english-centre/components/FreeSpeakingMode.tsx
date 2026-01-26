import React, { useState, useRef, useEffect } from 'react';
import { processStudentInput, synthesizeSpeech, unlockAudio } from '../services/geminiService';
import { ChatMessage, FeedbackData } from '../types';
import AudioVisualizer from './AudioVisualizer';
import AiSpeakingVisualizer from './AiSpeakingVisualizer';
import { useAudioLevel } from '../hooks/useAudioLevel';
import { Mic, Send, Volume2, Sparkles, AlertTriangle, TrendingUp, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

const FreeSpeakingMode: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  const aiAudioLevel = useAudioLevel(audioRef.current, isAiSpeaking);
  const userAudioLevel = useAudioLevel(micStream, isRecording);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage('ai', "Hello! I'm your AI tutor. We can talk about anything you like. I'll listen to your English and give you feedback. What's on your mind?");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'user' | 'ai', text: string, feedback?: FeedbackData) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      text,
      feedback,
      timestamp: Date.now()
    }]);
    if (role === 'ai') playAiAudio(text);
  };

  const playAiAudio = async (text: string) => {
    try {
        const result = await synthesizeSpeech(text);
        if (result === 'FALLBACK_HANDLED') {
           setIsAiSpeaking(false);
        } else if (result && audioRef.current) {
            audioRef.current.src = result;
            setIsAiSpeaking(true);
            await audioRef.current.play().catch(() => setIsAiSpeaking(false));
            audioRef.current.onended = () => setIsAiSpeaking(false);
        }
    } catch (e: any) { 
        const errorStr = JSON.stringify(e) || String(e);
        if (errorStr.includes('429')) setQuotaError(true);
        setIsAiSpeaking(false);
    }
  };

  const startRecording = async () => {
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAudioSubmit(blob);
        stream.getTracks().forEach(track => track.stop());
        setMicStream(null);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Mic error"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioSubmit = async (blob: Blob) => {
    setIsProcessing(true);
    setQuotaError(false);
    try {
        // Correctly map 'ai' role to 'model' for Gemini API compatibility
        const history = messages.map(m => ({ 
            role: m.role === 'ai' ? 'model' : 'user', 
            parts: [{ text: m.text || "" }] 
        }));
        
        // Optimistic UI update for user input
        addMessage('user', "(Audio Input)", undefined); 

        // Use the callback to handle the fast reply immediately
        const result = await processStudentInput(
          blob, 
          'FREE', 
          undefined, 
          history, 
          undefined, 
          undefined,
          (fastReply) => {
            // This runs as soon as the fast reply is generated, while analysis is still happening
             addMessage('ai', fastReply, undefined);
          }
        );
        
        // Once full analysis is done, update the last message with feedback (the reply text is same)
        setMessages(prev => {
           const newArr = [...prev];
           const lastIdx = newArr.length - 1;
           if (lastIdx >= 0 && newArr[lastIdx].role === 'ai') {
              newArr[lastIdx].feedback = result.feedback;
           }
           return newArr;
        });

    } catch (error: any) {
        const errorStr = JSON.stringify(error) || String(error);
        if (errorStr.includes('429')) setQuotaError(true);
        addMessage('ai', "Sorry, I had trouble processing that. We might be at capacity.");
    } finally {
        setIsProcessing(false);
    }
  };

  const getDynamicGlow = (level: number) => {
    const intensity = Math.max(0.1, level);
    return {
        boxShadow: `
            0 0 ${15 + intensity * 30}px -2px rgba(239, 68, 68, ${0.4 + intensity * 0.4}),
            0 0 ${10 + intensity * 40}px -1px rgba(251, 113, 133, ${0.3 + intensity * 0.3}),
            0 0 ${5 + intensity * 50}px 0px rgba(249, 115, 22, ${0.2 + intensity * 0.2})
        `,
        borderColor: `rgba(248, 113, 113, ${0.3 + intensity * 0.7})`,
        transition: 'box-shadow 0.1s ease, border-color 0.1s ease'
    };
  };

  return (
    <div className="flex h-full gap-6 p-4 md:p-6 max-w-6xl mx-auto flex-col overflow-hidden">
      {quotaError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800 shrink-0">
           <div className="flex items-center gap-2">
             <AlertCircle size={20} />
             <span className="text-sm font-medium">API Quota exceeded. Using browser fallback...</span>
           </div>
           <button onClick={() => setQuotaError(false)} className="text-red-600 hover:text-red-800"><RefreshCw size={16} /></button>
        </div>
      )}
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-800 shadow-sm border border-slate-100'}`}>
                  {msg.role === 'ai' && <div className="flex items-center gap-2 mb-2 text-red-600 text-[10px] font-bold uppercase tracking-wider"><Sparkles size={12} /> AI Tutor</div>}
                  <p className="leading-relaxed text-sm md:text-base">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-4 max-w-4xl mx-auto">
               <div className={`flex-1 h-16 md:h-20 rounded-2xl border-2 flex items-center px-6 transition-all duration-300 relative overflow-hidden ${isRecording || isAiSpeaking ? 'bg-white' : 'border-slate-200 bg-slate-50'}`} style={isRecording ? getDynamicGlow(userAudioLevel) : isAiSpeaking ? getDynamicGlow(aiAudioLevel) : {}}>
                  {isProcessing ? (
                    <div className="w-full flex items-center justify-center gap-3 text-red-600 font-medium animate-pulse text-sm">
                      <Sparkles size={18} />Analyzing...
                    </div>
                  ) : isAiSpeaking ? (
                    <div className="w-full flex items-center justify-between gap-4">
                      <div className="text-red-600 font-bold text-xs uppercase tracking-widest">AI Speaking</div>
                      <AiSpeakingVisualizer />
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-4">
                      <div className="flex-1"><AudioVisualizer isRecording={isRecording} /></div>
                      {isRecording && <div className="text-red-600 text-[10px] font-black tracking-widest animate-pulse whitespace-nowrap">RECORDING</div>}
                    </div>
                  )}
               </div>
               <button 
                onClick={isRecording ? stopRecording : startRecording} 
                disabled={isProcessing && !isAiSpeaking} 
                className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl flex items-center justify-center shadow-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}
               >
                 {isRecording ? <div className="h-6 w-6 md:h-8 md:w-8 bg-white rounded-md" /> : <Mic size={28} className="md:size-32" />}
               </button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 font-bold text-xs md:text-sm text-red-800 uppercase tracking-widest">Live Analysis</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.filter(m => m.feedback).length > 0 ? (() => {
                  const latestFeedback = messages.slice().reverse().find(m => m.feedback)?.feedback;
                  if (!latestFeedback) return null;
                  return (
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-3">
                              <ScoreCard label="Fluency" score={latestFeedback.fluencyScore || 0} />
                              <ScoreCard label="Grammar" score={latestFeedback.grammarScore || 0} />
                              <ScoreCard label="Vocab" score={latestFeedback.vocabularyScore || 0} />
                              <ScoreCard label="Idioms" score={latestFeedback.idiomScore || 0} />
                          </div>
                          <div className="bg-red-50 p-4 rounded-xl text-xs md:text-sm text-red-900 border border-red-100 leading-relaxed font-medium">
                            <div className="flex items-center gap-1.5 mb-2 text-red-600 font-bold uppercase tracking-tighter text-[10px]">Overall Feedback</div>
                            {latestFeedback.feedbackText}
                          </div>
                      </div>
                  );
              })() : <div className="text-slate-400 text-xs p-4 italic text-center">Your speech analysis will appear here once you start speaking.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ label, score }: { label: string, score: number }) => (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center md:text-left">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-1">{label}</div>
        <div className="text-lg md:text-xl font-black text-red-700">{score.toFixed(0)}<span className="text-[10px] text-slate-400 font-normal">/10</span></div>
    </div>
);

export default FreeSpeakingMode;