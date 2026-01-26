import React, { useState, useEffect } from 'react';
import { AppMode, WritingFeedback } from '../types';
import { generateWritingTopic, processWritingInput } from '../services/geminiService';
import { PenTool, Clock, Send, RefreshCw, AlertCircle, CheckCircle2, ListChecks, MessageSquareText, FileEdit } from 'lucide-react';
import Timer from './Timer';

interface WritingModeProps {
  mode: AppMode;
}

const WritingMode: React.FC<WritingModeProps> = ({ mode }) => {
  const isExam = mode === AppMode.WRITING_EXAM;
  const [topic, setTopic] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes
  const [hasStarted, setHasStarted] = useState(!isExam);
  const [isLoadingTopic, setIsLoadingTopic] = useState(isExam);

  useEffect(() => {
    if (isExam) {
      fetchTopic();
    } else {
      setTopic(""); // No topic for free writing
      setHasStarted(true);
    }
    // Reset state when mode changes
    setText("");
    setFeedback(null);
  }, [mode]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isExam && hasStarted && timeLeft > 0 && !feedback) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !feedback && isExam) {
      handleSubmit();
    }
    return () => clearInterval(interval);
  }, [hasStarted, timeLeft, feedback, isExam]);

  const fetchTopic = async () => {
    setIsLoadingTopic(true);
    try {
      const t = await generateWritingTopic();
      setTopic(t);
    } catch (e) {
      setTopic("Write a description of your typical daily routine at school or home.");
    } finally {
      setIsLoadingTopic(false);
    }
  };

  const handleSubmit = async () => {
    if (text.trim().length < 20) {
      alert("Please write at least a few sentences before submitting for evaluation.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await processWritingInput(text, isExam ? topic : "Free Practice (No Specific Topic)");
      setFeedback(result);
    } catch (e) {
      alert("Error evaluating your writing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;

  if (isExam && !hasStarted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <PenTool size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Writing Exam</h2>
          <div className="text-slate-500 text-sm space-y-2">
            <p>You will have 20 minutes to complete a writing task.</p>
            <p>Target: 80 - 120 words.</p>
          </div>
          <button 
            onClick={() => setHasStarted(true)} 
            disabled={isLoadingTopic}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50"
          >
            {isLoadingTopic ? "Generating Topic..." : "Start Writing Now"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-8 pb-20">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className={`flex-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full ${!isExam ? 'bg-slate-50/50 border-dashed' : ''}`}>
           <div className="flex items-center gap-2 mb-4 text-red-600 font-bold uppercase tracking-widest text-xs">
             {isExam ? <ListChecks size={16} /> : <FileEdit size={16} />}
             {isExam ? "Exam Topic" : "Free Writing Practice"}
           </div>
           {isExam ? (
             isLoadingTopic ? (
               <div className="h-20 flex items-center justify-center animate-pulse text-slate-300">
                 <RefreshCw className="animate-spin mr-2" /> Loading topic...
               </div>
             ) : (
               <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                 {topic}
               </div>
             )
           ) : (
             <div className="text-slate-500 leading-relaxed font-medium italic">
               "Write about any topic you choose. When you're finished, I will evaluate your work based on Task Achievement, Coherence, Grammar, and Vocabulary."
             </div>
           )}
        </div>

        {isExam && !feedback && (
          <div className="w-full md:w-48 shrink-0 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
            <Timer currentTime={timeLeft} totalTime={1200} label="Remaining" />
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Editor Area */}
        <div className="flex-[3] space-y-4">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isSubmitting || !!feedback}
              placeholder={isExam ? "Start typing your response to the prompt above..." : "Type your story, essay, or message here..."}
              className="w-full min-h-[400px] p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm focus:ring-4 focus:ring-red-50 focus:border-red-500 transition-all outline-none text-slate-700 leading-relaxed text-lg resize-none"
            />
            <div className="absolute bottom-6 right-8 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <span className={`text-xs font-bold ${isExam && (wordCount < 80 || wordCount > 120) ? 'text-orange-500' : 'text-green-600'}`}>
                {wordCount} words
              </span>
              {isExam && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Target: 80-120</span>}
            </div>
          </div>

          {!feedback && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || text.trim().length < 20}
              className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-red-100 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? (
                <><RefreshCw size={24} className="animate-spin" /> Evaluating Writing...</>
              ) : (
                <><Send size={24} /> Submit for Review</>
              )}
            </button>
          )}
        </div>

        {/* Feedback Area */}
        {feedback && (
          <div className="flex-[2] space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="bg-red-600 p-6 text-white text-center">
                  <div className="text-4xl font-black">{Math.min(10, feedback.totalScore)}<span className="text-xl opacity-60">/10</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Final Grade</div>
               </div>
               
               <div className="p-6 space-y-6">
                  <WritingScoreItem label="Task Achievement" score={feedback.taskAchievement.score} max={3} explanation={feedback.taskAchievement.explanation} />
                  <WritingScoreItem label="Fluency & Coherence" score={feedback.fluencyCoherence.score} max={2} explanation={feedback.fluencyCoherence.explanation} />
                  <WritingScoreItem label="Grammar & Mechanics" score={feedback.grammarMechanics.score} max={3} explanation={feedback.grammarMechanics.explanation} />
                  <WritingScoreItem label="Vocabulary" score={feedback.vocabulary.score} max={2} explanation={feedback.vocabulary.explanation} />
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-800 text-sm uppercase tracking-wider">
                <CheckCircle2 size={18} className="text-green-500" /> Instructor Summary
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed italic">"{feedback.overallFeedback}"</p>
            </div>

            {feedback.corrections.length > 0 && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-800 text-sm uppercase tracking-wider">
                  <AlertCircle size={18} className="text-red-500" /> Corrections & Suggestions
                </h3>
                <div className="space-y-2">
                  {feedback.corrections.map((c, i) => (
                    <div key={i} className="text-xs bg-red-50 p-3 rounded-xl border border-red-100 text-red-800 font-medium leading-relaxed">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={() => { setFeedback(null); setText(""); if (isExam) { setHasStarted(false); fetchTopic(); } }}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"
            >
              <RefreshCw size={18} /> {isExam ? "Try New Exam" : "Start New Practice"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const WritingScoreItem = ({ label, score, max, explanation }: { label: string, score: number, max: number, explanation: string }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-red-700">{score}/{max}</span>
    </div>
    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
      <div 
        className="bg-red-600 h-full transition-all duration-1000" 
        style={{ width: `${Math.min(100, (score/max)*100)}%` }} 
      />
    </div>
    <p className="text-[11px] text-slate-500 leading-normal">{explanation}</p>
  </div>
);

export default WritingMode;