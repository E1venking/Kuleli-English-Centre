import React, { useState, useEffect, useRef } from 'react';
import { ExamPart, ExamStatus, FeedbackData, Mistake, AppMode } from '../types';
import { processStudentInput, synthesizeSpeech, generateExamImage, generateExamTopic, unlockAudio } from '../services/geminiService';
import Timer from './Timer';
import AudioVisualizer from './AudioVisualizer';
import AiSpeakingVisualizer from './AiSpeakingVisualizer';
import { useAudioLevel } from '../hooks/useAudioLevel';
import { Mic, Play, ArrowRight, CheckCircle, AlertCircle, Volume2, Clock, GraduationCap, FastForward, TrendingUp, AlertTriangle, RefreshCw, Trophy, ClipboardCheck, ArrowUpRight, MessageSquare, XCircle, Info, Volume1, Flag, SkipForward } from 'lucide-react';

interface ExamModeProps {
  initialPart?: ExamPart;
  isStandalone?: boolean;
  onModeChange?: (mode: AppMode) => void;
}

const ExamMode: React.FC<ExamModeProps> = ({ initialPart = ExamPart.INTRO, isStandalone = false, onModeChange }) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [part, setPart] = useState<ExamPart>(initialPart);
  const [status, setStatus] = useState<ExamStatus>(ExamStatus.IDLE);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [examImages, setExamImages] = useState<string[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(null);
  const [resultsHistory, setResultsHistory] = useState<Record<number, FeedbackData>>({});
  const [quotaError, setQuotaError] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  
  const isNewPartRef = useRef(true);
  const autoAdvanceRef = useRef(false);
  const secretTopicRef = useRef<string>("");
  const turnCountRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  const aiAudioLevel = useAudioLevel(audioRef.current, status === ExamStatus.AI_SPEAKING);
  const userAudioLevel = useAudioLevel(micStream, isRecording);

  const introAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let msg = "";
    if (initialPart === ExamPart.INTRO) {
      msg = "Welcome to the Speaking Exam. In Part 1, I'd like you to introduce yourself. Please tell me about your background, hobbies, and studies.";
    } else if (initialPart === ExamPart.PICTURE) {
      msg = "Welcome. We will now begin Part 2: Picture Comparison. Please wait while I prepare the topics for you.";
    } else {
      msg = "Welcome. We will now begin Part 3: Discussion. Please wait while I prepare a topic for you.";
    }
    setAiMessage(msg);
    setPart(initialPart);
    setHasStarted(false); 
    setCurrentFeedback(null);
    setExamImages([]);
    isNewPartRef.current = true;
    turnCountRef.current = 0;
  }, [initialPart, isStandalone]);

  useEffect(() => {
    if (initialPart === ExamPart.INTRO) {
      const prefetchIntro = async () => {
          try {
            const result = await synthesizeSpeech("Welcome to the Speaking Exam. In Part 1, I'd like you to introduce yourself. Please tell me about your background, hobbies, and studies.");
            if (result && result !== 'FALLBACK_HANDLED') introAudioUrlRef.current = result;
          } catch (e) {
            console.error("Prefetch quota hit");
          }
      };
      prefetchIntro();
    }
  }, [initialPart]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const shouldRunTimer = (status === ExamStatus.USER_PREP || status === ExamStatus.USER_SPEAKING) && timeLeft > 0;

    if (shouldRunTimer) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && hasStarted) {
      if (status === ExamStatus.USER_PREP) handlePrepDone();
      else if (status === ExamStatus.USER_SPEAKING && isRecording) handleSpeakingDone();
    }
    return () => clearInterval(interval);
  }, [status, timeLeft, hasStarted, isRecording]);

  useEffect(() => {
    if (hasStarted) {
      if (part === ExamPart.INTRO && isNewPartRef.current) {
        if (introAudioUrlRef.current) {
            playAudioUrl(introAudioUrlRef.current);
            introAudioUrlRef.current = null;
        } else {
            playAiAudio(aiMessage);
        }
      } else if (isNewPartRef.current) {
        setupNextPart(part);
      }
    }
  }, [hasStarted, part]);

  const setupNextPart = async (targetPart: ExamPart) => {
    setStatus(ExamStatus.PROCESSING);
    turnCountRef.current = 0;
    try {
      if (targetPart === ExamPart.PICTURE) {
        const topic = await generateExamTopic(2);
        secretTopicRef.current = topic;
        const [topicA, topicB] = topic.split(' vs ').map(t => t.trim());
        const instructions = `Part 2: Picture Comparison. Look at these two subjects and compare them. Think about the differences and similarities. You have 1 minute to prepare.`;
        setAiMessage(instructions);
        
        // Generate two distinct images
        const [imgA, imgB] = await Promise.all([
           generateExamImage(topicA || "A crowded city"),
           generateExamImage(topicB || "A peaceful village")
        ]);
        
        const validImages = [];
        if (imgA) validImages.push(imgA);
        if (imgB) validImages.push(imgB);
        setExamImages(validImages);
        
        playAiAudio(instructions);
      } else if (targetPart === ExamPart.DISCUSSION) {
        const question = await generateExamTopic(3);
        const instructions = `Part 3: Discussion. ${question} You have 1 minute to prepare.`;
        setAiMessage(instructions);
        playAiAudio(instructions);
      }
    } catch (e: any) {
      setQuotaError(true);
    }
  }

  const playAudioUrl = async (url: string) => {
      setStatus(ExamStatus.AI_SPEAKING);
      if (audioRef.current) {
          audioRef.current.src = url;
          try {
            await audioRef.current.play();
          } catch (e) {
             console.warn("Autoplay blocked", e);
          }
          audioRef.current.onended = () => handleAiFinishedSpeaking();
      }
  };

  const playAiAudio = async (text: string) => {
    setStatus(ExamStatus.AI_SPEAKING);
    try {
      const result = await synthesizeSpeech(text);
      if (result === 'FALLBACK_HANDLED') {
        handleAiFinishedSpeaking();
      } else if (result) {
        await playAudioUrl(result);
      } else {
        setTimeout(() => handleAiFinishedSpeaking(), 2000);
      }
    } catch (e: any) {
      setQuotaError(true);
      setStatus(ExamStatus.IDLE);
    }
  };

  const playPronunciationAudio = async (text: string) => {
     try {
       const result = await synthesizeSpeech(`The correct pronunciation is: ${text}`);
       if (result && result !== 'FALLBACK_HANDLED') {
          const audio = new Audio(result);
          audio.play();
       }
     } catch (e) {
       console.error("Could not play sample audio", e);
     }
  };

  const handleAiFinishedSpeaking = () => {
    if (status === ExamStatus.COMPLETED || status === ExamStatus.PART_COMPLETED) return;
    if (part === ExamPart.INTRO) {
      setStatus(ExamStatus.USER_SPEAKING);
      if (isNewPartRef.current) {
        setTimeLeft(120); setTotalTime(120);
        isNewPartRef.current = false;
        startRecording();
      } else {
        startRecording();
      }
    } else if (part === ExamPart.PICTURE || part === ExamPart.DISCUSSION) {
      if (isNewPartRef.current) {
         setStatus(ExamStatus.USER_PREP);
         setTimeLeft(60); setTotalTime(60);
      } else {
         setStatus(ExamStatus.USER_SPEAKING);
         startRecording();
      }
    } else {
      setStatus(ExamStatus.IDLE);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleSubmission(blob);
        stream.getTracks().forEach(track => track.stop());
        setMicStream(null);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus(ExamStatus.PROCESSING);
    }
  };

  const handleSubmission = async (audioBlob: Blob) => {
    try {
      setQuotaError(false);
      let context = "";
      if (part === ExamPart.INTRO) context = "Part 1: Self Introduction";
      if (part === ExamPart.PICTURE) context = `Part 2: Picture Comparison. Comparison: ${secretTopicRef.current}. Student should contrast the two subjects.`;
      if (part === ExamPart.DISCUSSION) context = `Part 3: Discussion. Question: ${aiMessage}`;

      // Increment turn count BEFORE processing to determine limit
      const nextTurn = turnCountRef.current + 1;
      
      const result = await processStudentInput(
        audioBlob, 
        'EXAM', 
        context, 
        [], 
        part,
        nextTurn
      );
      
      turnCountRef.current = nextTurn;
      setCurrentFeedback(result.feedback); 

      // Strict Limit: Main Answer + 2 Follow-ups = 3 Turns max
      const shouldFinish = result.moveNext || autoAdvanceRef.current || nextTurn >= 3;

      if (shouldFinish) {
        setResultsHistory(prev => ({ ...prev, [part]: result.feedback }));
        setStatus(ExamStatus.PART_COMPLETED);
        autoAdvanceRef.current = false;
      } else {
        setAiMessage(result.reply);
        playAiAudio(result.reply);
      }
    } catch (error: any) {
      setQuotaError(true);
      setAiMessage("I'm sorry, I had trouble processing that. Please try again.");
      setStatus(ExamStatus.IDLE);
    }
  };

  const handleFinishWillingly = () => {
    if (currentFeedback) {
        setResultsHistory(prev => ({ ...prev, [part]: currentFeedback }));
        setStatus(ExamStatus.PART_COMPLETED);
    } else {
        // Fallback if they try to finish before first Turn but turn count is check handled in UI
        autoAdvanceRef.current = true;
        if (isRecording) stopRecording();
        else setStatus(ExamStatus.PART_COMPLETED);
    }
  };

  const handleSkipPart = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    // Create zeroed feedback
    const skippedFeedback: FeedbackData = {
      taskAchievementScore: 0,
      pronunciationScore: 0,
      grammarScore: 0,
      fluencyCoherenceScore: 0,
      feedbackText: "Part skipped by student.",
      mistakesAndCorrections: [],
      weaknesses: [],
      improvements: []
    };

    setResultsHistory(prev => ({ ...prev, [part]: skippedFeedback }));
    setCurrentFeedback(skippedFeedback);
    setStatus(ExamStatus.PART_COMPLETED);
    
    // Stop any ongoing timers or audio
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    setAiMessage("Part skipped.");
  };

  const advancePart = async () => {
    if (isStandalone || part === ExamPart.DISCUSSION) {
      setStatus(ExamStatus.COMPLETED);
      return;
    }

    // Set Processing status to clear the UI and prevent "restart" flash
    setStatus(ExamStatus.PROCESSING); 
    isNewPartRef.current = true;
    setCurrentFeedback(null);
    setExamImages([]);
    setPart(prev => (prev + 1) as ExamPart);
  };

  const handlePrepDone = () => {
    setStatus(ExamStatus.USER_SPEAKING);
    setTimeLeft(120); setTotalTime(120);
    isNewPartRef.current = false;
    startRecording();
  };

  const handleSpeakingDone = () => stopRecording();

  const handleStartExam = () => {
    unlockAudio();
    setHasStarted(true);
  };

  const calculateTotalScore = () => {
    return (Object.values(resultsHistory) as FeedbackData[]).reduce((acc, f) => {
      return acc + f.taskAchievementScore + f.pronunciationScore + f.grammarScore + f.fluencyCoherenceScore;
    }, 0);
  };

  const getDynamicGlow = (level: number) => {
    const intensity = Math.max(0.1, level);
    return {
        boxShadow: `
            0 0 ${15 + intensity * 35}px -2px rgba(239, 68, 68, ${0.4 + intensity * 0.4}),
            0 0 ${10 + intensity * 45}px -1px rgba(251, 113, 133, ${0.3 + intensity * 0.3}),
            0 0 ${5 + intensity * 55}px 0px rgba(249, 115, 22, ${0.2 + intensity * 0.2})
        `,
        borderColor: `rgba(248, 113, 113, ${0.3 + intensity * 0.7})`,
        transition: 'box-shadow 0.1s ease, border-color 0.1s ease'
    };
  };

  // Helper for mistake styles
  const getMistakeStyle = (type: string) => {
     if (type === 'pronunciation') {
        return {
           border: 'border-blue-100',
           bgLeft: 'bg-blue-50/50',
           bgRight: 'bg-indigo-50/50',
           textLabelLeft: 'text-blue-400',
           textLabelRight: 'text-indigo-400',
           textLeft: 'text-blue-900',
           textRight: 'text-indigo-900',
           label: 'Pronunciation'
        };
     } else if (type === 'vocabulary') {
        return {
           border: 'border-amber-100',
           bgLeft: 'bg-amber-50/50',
           bgRight: 'bg-orange-50/50',
           textLabelLeft: 'text-amber-500',
           textLabelRight: 'text-orange-500',
           textLeft: 'text-amber-900',
           textRight: 'text-orange-900',
           label: 'Vocabulary'
        };
     }
     // Default Grammar
     return {
        border: 'border-red-100',
        bgLeft: 'bg-red-50/50',
        bgRight: 'bg-green-50/50',
        textLabelLeft: 'text-red-400',
        textLabelRight: 'text-green-400',
        textLeft: 'text-red-900',
        textRight: 'text-green-900',
        label: 'Grammar'
     };
  };

  if (!hasStarted) {
    return (
      <div className="flex items-center justify-center min-h-full bg-slate-50/50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <GraduationCap size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {isStandalone ? `Speaking Part ${initialPart} Practice` : 'Full Speaking Exam'}
          </h2>
          <div className="text-slate-500 text-sm text-left bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
             <p className="font-bold text-slate-700">Grading System:</p>
             <ul className="space-y-1 list-disc pl-4 text-xs">
               <li>Part 1: 20 points max (5 pts per category)</li>
               <li>Part 2: 40 points max (10 pts per category)</li>
               <li>Part 3: 40 points max (10 pts per category)</li>
               <li>Total: 100 points</li>
             </ul>
             <p className="font-bold text-red-600 text-[10px] mt-2 italic">Note: AI evaluates strictly. Short or off-topic responses will be penalized in Task Achievement.</p>
          </div>
          <button onClick={handleStartExam} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all">Start Exam Session</button>
        </div>
      </div>
    );
  }

  if (status === ExamStatus.COMPLETED) {
    const totalScore = calculateTotalScore();
    const allMistakes: Mistake[] = (Object.values(resultsHistory) as FeedbackData[]).flatMap(r => r.mistakesAndCorrections);
    
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">
        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-red-700 p-12 text-white text-center space-y-4">
            <Trophy size={64} className="mx-auto mb-4 text-orange-400" />
            <h2 className="text-3xl font-black uppercase tracking-widest">Exam Results</h2>
            <div className="flex items-center justify-center gap-2">
               <span className="text-7xl font-black">{totalScore.toFixed(1)}</span>
               <span className="text-2xl font-bold opacity-60">/ 100</span>
            </div>
            <p className="text-lg font-medium opacity-80">Final Grade - Kuleli English Centre</p>
          </div>

          <div className="p-8 md:p-12 space-y-12">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(p => {
                  const res = resultsHistory[p];
                  if (!res) return null;
                  const pScore = res.taskAchievementScore + res.pronunciationScore + res.grammarScore + res.fluencyCoherenceScore;
                  const pMax = p === 1 ? 20 : 40;
                  return (
                    <div key={p} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Part {p}</div>
                      <div className="text-2xl font-black text-red-700">{pScore.toFixed(1)}<span className="text-sm opacity-40">/{pMax}</span></div>
                    </div>
                  );
                })}
             </div>

             <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                   <ClipboardCheck className="text-red-600" />
                   Performance Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                   <StatBar label="Task Achievement" current={(Object.values(resultsHistory) as FeedbackData[]).reduce((a, b) => a + b.taskAchievementScore, 0)} total={25} />
                   <StatBar label="Pronunciation" current={(Object.values(resultsHistory) as FeedbackData[]).reduce((a, b) => a + b.pronunciationScore, 0)} total={25} />
                   <StatBar label="Grammar" current={(Object.values(resultsHistory) as FeedbackData[]).reduce((a, b) => a + b.grammarScore, 0)} total={25} />
                   <StatBar label="Fluency & Coherence" current={(Object.values(resultsHistory) as FeedbackData[]).reduce((a, b) => a + b.fluencyCoherenceScore, 0)} total={25} />
                </div>
             </div>

             <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                   <XCircle className="text-red-600" />
                   Mistakes & Corrections
                </h3>
                <div className="space-y-4">
                   {allMistakes.length > 0 ? (
                     allMistakes.map((m, i) => {
                       const style = getMistakeStyle(m.type);
                       return (
                         <div key={i} className={`bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row ${style.border}`}>
                            <div className={`flex-1 p-4 border-r border-slate-100 ${style.bgLeft}`}>
                               <div className="flex items-center justify-between mb-1">
                                  <div className={`text-[10px] font-black uppercase ${style.textLabelLeft}`}>
                                     {m.type === 'pronunciation' ? 'Pronunciation' : 'You said'}:
                                  </div>
                                  {m.type === 'pronunciation' && (
                                     <button 
                                        onClick={() => playPronunciationAudio(m.correction)}
                                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                        title="Listen to correct pronunciation"
                                     >
                                        <Volume1 size={14} />
                                     </button>
                                  )}
                                  {m.type === 'vocabulary' && (
                                     <div className="text-[9px] font-black uppercase text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">Vocab</div>
                                  )}
                               </div>
                               <div className={`text-sm italic ${style.textLeft}`}>"{m.mistake}"</div>
                            </div>
                            <div className={`flex-1 p-4 ${style.bgRight}`}>
                               <div className={`text-[10px] font-black uppercase mb-1 ${style.textLabelRight}`}>Correct:</div>
                               <div className={`text-sm font-bold ${style.textRight}`}>"{m.correction}"</div>
                            </div>
                         </div>
                       );
                     })
                   ) : (
                     <div className="text-center py-12 bg-slate-50 rounded-3xl text-slate-400 italic">No significant mistakes detected. Excellent control!</div>
                   )}
                </div>
             </div>
          </div>
        </div>

        <button 
          onClick={() => onModeChange?.(AppMode.LANDING)}
          className="w-full py-5 bg-slate-800 text-white rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-slate-900 transition-all shadow-xl"
        >
          <RefreshCw size={20} />
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (status === ExamStatus.PART_COMPLETED && currentFeedback) {
    const pScore = currentFeedback.taskAchievementScore + currentFeedback.pronunciationScore + currentFeedback.grammarScore + currentFeedback.fluencyCoherenceScore;
    const pMax = part === ExamPart.INTRO ? 20 : 40;
    
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
           <div className="bg-red-50 p-8 border-b border-slate-100 text-center">
              <div className="text-[12px] font-black text-red-600 uppercase tracking-widest mb-2">Part {part} Complete</div>
              <h2 className="text-3xl font-black text-slate-800">Part {part} Summary</h2>
           </div>
           
           <div className="p-8 md:p-12 space-y-10">
              <div className="flex items-center justify-center gap-4">
                 <div className="text-center px-8 py-4 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <div className="text-5xl font-black text-red-700">{pScore.toFixed(1)}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Score out of {pMax}</div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <MiniScoreItem label="Task Achievement" score={currentFeedback.taskAchievementScore} max={part === 1 ? 5 : 10} />
                 <MiniScoreItem label="Pronunciation" score={currentFeedback.pronunciationScore} max={part === 1 ? 5 : 10} />
                 <MiniScoreItem label="Grammar" score={currentFeedback.grammarScore} max={part === 1 ? 5 : 10} />
                 <MiniScoreItem label="Fluency" score={currentFeedback.fluencyCoherenceScore} max={part === 1 ? 5 : 10} />
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                 <h4 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquare size={18} className="text-red-600" /> Instructor Feedback</h4>
                 <p className="text-slate-600 text-sm italic leading-relaxed">"{currentFeedback.feedbackText}"</p>
              </div>

              {currentFeedback.mistakesAndCorrections.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={18} className="text-orange-500" /> Mistakes in Part {part}</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {currentFeedback.mistakesAndCorrections.map((m, i) => {
                       const style = getMistakeStyle(m.type);
                       return (
                         <div key={i} className={`p-3 rounded-xl border flex flex-col gap-1 ${style.bgLeft} ${style.border}`}>
                            <div className="flex items-center justify-between">
                               <span className={`font-black uppercase text-[9px] ${style.textLabelLeft}`}>{style.label}:</span>
                               {m.type === 'pronunciation' && (
                                  <button onClick={() => playPronunciationAudio(m.correction)} className="text-blue-600"><Volume1 size={14} /></button>
                               )}
                            </div>
                            <span className={`${style.textLeft} italic text-[11px]`}>"{m.mistake}"</span>
                            <span className={`font-black uppercase text-[9px] mt-1 ${style.textLabelRight}`}>Correction:</span>
                            <span className={`${style.textRight} font-bold text-[11px]`}>"{m.correction}"</span>
                         </div>
                       );
                    })}
                  </div>
                </div>
              )}
           </div>

           <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={advancePart}
                className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-red-100 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
              >
                {part === 3 ? 'View Final Scoreboard' : `Continue to Part ${part + 1}`}
                <ArrowRight size={24} />
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6">
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
      
      {quotaError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800 shrink-0">
           <div className="flex items-center gap-2">
             <AlertCircle size={20} />
             <span className="text-sm font-medium">Processing issues. Retrying...</span>
           </div>
           <button onClick={() => setQuotaError(false)} className="text-red-600 hover:text-red-800"><RefreshCw size={16} /></button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {isStandalone ? (
            <div className="h-10 px-4 rounded-full bg-red-600 text-white flex items-center justify-center font-bold uppercase tracking-widest text-[10px]">Part {initialPart} Only</div>
          ) : (
            [1,2,3].map(p => (
              <React.Fragment key={p}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold transition-colors ${part === p ? 'bg-red-600 text-white' : resultsHistory[p] ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  {resultsHistory[p] ? <CheckCircle size={20} /> : p}
                </div>
                {p < 3 && <div className="h-1 w-8 bg-slate-200" />}
              </React.Fragment>
            ))
          )}
        </div>
        <div className="flex flex-col items-end">
          <div className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] leading-none mb-1">{status.replace('_', ' ')}</div>
          <div className="text-[9px] font-black text-red-600 uppercase tracking-widest">Grading Active</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-[3] bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-start min-h-[400px]">
          <div 
            className={`h-20 w-20 md:h-24 md:w-24 bg-white rounded-full flex items-center justify-center mb-6 shrink-0 transition-all duration-300 overflow-hidden relative ${status === ExamStatus.AI_SPEAKING ? '' : 'border border-red-50 shadow-inner'}`}
            style={status === ExamStatus.AI_SPEAKING ? getDynamicGlow(aiAudioLevel) : {}}
          >
            {status === ExamStatus.AI_SPEAKING ? <AiSpeakingVisualizer /> : <Volume2 className="h-10 w-10 text-red-100" />}
          </div>

          {part === ExamPart.PICTURE && examImages.length > 0 && (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
               {examImages.map((img, i) => (
                 <div key={i} className="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-200 bg-slate-100 flex items-center justify-center relative">
                    <img src={img} alt={`Comparison Subject ${i+1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-white/80 backdrop-blur rounded-lg text-[10px] font-bold text-slate-600">Image {i+1}</div>
                 </div>
               ))}
            </div>
          )}

          <div className="text-center space-y-6 max-w-lg w-full">
             <p className="text-lg md:text-xl text-slate-700 font-medium leading-relaxed px-2 italic">"{aiMessage.replace(/\*/g, '')}"</p>
             {status === ExamStatus.PROCESSING && (
               <div className="flex items-center justify-center gap-3 text-red-600 font-bold animate-pulse py-8">
                  <RefreshCw className="animate-spin" />
                  Analyzing your speech...
               </div>
             )}
          </div>
        </div>

        <div className="flex-[2] md:max-w-sm flex flex-col gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[220px]">
            {status === ExamStatus.USER_PREP ? (
              <div className="space-y-4 w-full">
                <Timer currentTime={timeLeft} totalTime={totalTime} label="Prep Time" />
                <button 
                  onClick={handlePrepDone}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all hover:scale-[1.02]"
                >
                  <Play size={18} />
                  Start Speaking Now
                </button>
              </div>
            ) : status === ExamStatus.USER_SPEAKING ? (
              <Timer currentTime={timeLeft} totalTime={totalTime} label="Speaking" />
            ) : (
              <div className="text-slate-400 flex flex-col items-center py-6">
                <Clock size={40} className="mb-2 opacity-20" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-black opacity-40">{status}</span>
              </div>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
             <div className={`relative p-8 rounded-2xl border-2 transition-all duration-300 min-h-[120px] flex flex-col justify-center overflow-hidden ${isRecording ? 'bg-white' : 'border-slate-100 bg-slate-50/50'}`} style={isRecording ? getDynamicGlow(userAudioLevel) : {}}>
               {isRecording && <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[9px] font-black animate-pulse">LIVE</div>}
               <AudioVisualizer isRecording={isRecording} />
            </div>
            <div className="space-y-3 pb-2">
              {status === ExamStatus.USER_SPEAKING && !isRecording && (
                <button onClick={startRecording} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-colors">
                  <Mic size={20} />
                  Start Speaking
                </button>
              )}
              {isRecording && (
                <button onClick={stopRecording} className="w-full py-4 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
                  Submit Answer
                </button>
              )}
              
              {/* Finish Willingly Button: Now visible whenever the user has made at least one interaction (turn > 0) */}
              {status === ExamStatus.USER_SPEAKING && !isRecording && turnCountRef.current > 0 && (
                <button 
                  onClick={handleFinishWillingly} 
                  className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors shadow-lg border-2 border-slate-700 mt-2"
                >
                  <Flag size={18} />
                  Finish and Grade Part {part}
                </button>
              )}

              {/* NEW SKIP PART BUTTON */}
              {(status === ExamStatus.USER_PREP || status === ExamStatus.USER_SPEAKING) && (
                <button
                  onClick={handleSkipPart}
                  className="mt-4 text-slate-400 hover:text-red-600 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors w-full py-2"
                >
                  <SkipForward size={14} /> Skip this Part
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBar = ({ label, current, total }: { label: string, current: number, total: number }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
       <span>{label}</span>
       <span className="text-red-700">{current.toFixed(1)} / {total}</span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
       <div 
         className="h-full bg-red-600 transition-all duration-1000 ease-out" 
         style={{ width: `${(current/total)*100}%` }}
       />
    </div>
  </div>
);

const MiniScoreItem = ({ label, score, max }: { label: string, score: number, max: number }) => (
  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
     <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
     <div className="flex items-end gap-1">
        <span className="text-xl font-black text-red-700 leading-none">{score.toFixed(1)}</span>
        <span className="text-[10px] text-slate-300 font-bold mb-0.5">/ {max}</span>
     </div>
  </div>
);

export default ExamMode;