import React from 'react';
import { Shield, GraduationCap, MessageCircle, PenTool, ArrowRight, Sparkles } from 'lucide-react';
import { unlockAudio } from '../services/geminiService';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const handleBegin = () => {
    unlockAudio();
    onStart();
  };

  return (
    <div className="min-h-full bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center space-y-12">
      <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="h-24 w-24 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-slate-100 p-3 overflow-hidden transition-transform hover:scale-110 duration-500">
            <img 
              src="https://storage.googleapis.com/kulelienglishcentre/MSU.png" 
              alt="MSÜ Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tighter">
            Elevate Your <span className="text-red-700">English</span> Proficiency
          </h2>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            Kuleli English Centre provides intelligent, real-time AI evaluation for Speaking and Writing tasks tailored for National Defence University students.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
              <GraduationCap size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Structured Exams</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Complete IELTS-style exams with automated Part 1, Part 2 (Picture Analysis), and Part 3 discussion.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
              <MessageCircle size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Free Speaking</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Casual conversation with our AI tutor. Receive live grammar, vocabulary, and fluency scores.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <PenTool size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Writing Evaluator</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Submit your essays and descriptions for instant evaluation on a 10-point scale with detailed corrections.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="pt-8">
          <button 
            onClick={handleBegin}
            className="group relative inline-flex items-center gap-3 px-10 py-5 bg-red-700 text-white rounded-2xl font-black text-xl shadow-2xl shadow-red-200 hover:bg-red-800 transition-all transform hover:scale-105 active:scale-95"
          >
            Start Your Session
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            <Sparkles className="absolute -top-3 -right-3 text-orange-400 animate-pulse" />
          </button>
          <p className="mt-6 text-[10px] font-bold text-slate-400">
            MSÜ YDYO Teknoloji Destekli Eğitim Ofisi tarafından hazırlanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;