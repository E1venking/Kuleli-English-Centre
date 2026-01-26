import React, { useState } from 'react';
import { AppMode } from '../types';
import { MessageCircle, GraduationCap, Menu, X, Shield, Languages, PenTool, FileText, ChevronDown, ChevronUp, Layers, Target, Home } from 'lucide-react';

interface LayoutProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentMode, onModeChange, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSpeakingExamExpanded, setIsSpeakingExamExpanded] = useState(
    [AppMode.EXAM, AppMode.EXAM_P1, AppMode.EXAM_P2, AppMode.EXAM_P3].includes(currentMode)
  );

  const speakingExamModes = [
    { mode: AppMode.EXAM, label: "All Parts", icon: <Layers size={16} /> },
    { mode: AppMode.EXAM_P1, label: "Part 1", icon: <Target size={16} /> },
    { mode: AppMode.EXAM_P2, label: "Part 2", icon: <Target size={16} /> },
    { mode: AppMode.EXAM_P3, label: "Part 3", icon: <Target size={16} /> },
  ];

  const mainNavItems = [
    { mode: AppMode.FREE_SPEAKING, label: "Free Speaking", icon: <MessageCircle size={20} /> },
    { mode: AppMode.WRITING_EXAM, label: "Writing Exam", icon: <PenTool size={20} /> },
    { mode: AppMode.FREE_WRITING, label: "Free Writing", icon: <FileText size={20} /> },
  ];

  const handleSpeakingExamClick = () => {
    setIsSpeakingExamExpanded(!isSpeakingExamExpanded);
  };

  const isSpeakingExamModeActive = (mode: AppMode) => {
    return [AppMode.EXAM, AppMode.EXAM_P1, AppMode.EXAM_P2, AppMode.EXAM_P3].includes(mode);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* GLOBAL HEADER */}
      <header className="h-28 w-full border-b border-slate-100 bg-white flex items-center px-4 md:px-8 shrink-0 z-50 relative shadow-sm justify-between">
        {/* Left Section: Mobile Menu + MSU Logo */}
        <div className="flex items-center gap-4 z-10">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            <Menu size={24} />
          </button>
          
          <div className="shrink-0">
             <div className="h-16 w-16 md:h-20 md:w-20 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 p-2 overflow-hidden transition-transform hover:scale-105 cursor-pointer" onClick={() => onModeChange(AppMode.LANDING)}>
               <img 
                 src="https://storage.googleapis.com/kulelienglishcentre/MSU.png" 
                 alt="MSÜ Logo" 
                 className="w-full h-full object-contain"
               />
             </div>
          </div>
        </div>

        {/* Center Text Section */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
          <span className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] leading-none mb-1 md:mb-2 translate-y-[-2px]">
            National Defence University
          </span>
          <div className="flex items-center">
             <h1 className="text-xl md:text-4xl font-black tracking-tighter uppercase flex items-center gap-2 md:gap-4 leading-none whitespace-nowrap">
               <span className="text-red-800">Kuleli</span>
               <span className="text-slate-700">English Centre</span>
             </h1>
          </div>
          <div className="h-[2px] w-32 md:w-96 bg-gradient-to-r from-transparent via-red-300 to-transparent mt-2 md:mt-3"></div>
        </div>

        {/* Right Section: YDYO Logo */}
        <div className="flex items-center shrink-0 z-10 hidden sm:flex">
           <div className="h-16 w-16 md:h-20 md:w-20 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 p-2 overflow-hidden transition-transform hover:scale-105">
             <img 
               src="https://storage.googleapis.com/kulelienglishcentre/ydyo.png" 
               alt="YDYO Logo" 
               className="w-full h-full object-contain"
             />
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}>
          <div className="md:hidden p-4 border-b border-slate-100 flex justify-end">
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="text-slate-400 p-2 hover:text-red-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="p-6 space-y-2 flex-1 pt-12 overflow-y-auto">
            <div className="px-4 mb-4">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Dashboard</span>
            </div>

            <button
              onClick={() => {
                onModeChange(AppMode.LANDING);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all
                ${currentMode === AppMode.LANDING 
                  ? 'bg-red-700 text-white shadow-xl shadow-red-100' 
                  : 'text-slate-600 hover:bg-red-50 hover:text-red-700'}
              `}
            >
              <Home size={20} />
              Home
            </button>

            <div className="px-4 mt-6 mb-4">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Sections</span>
            </div>

            {/* Expandable Speaking Exam Section */}
            <div>
              <button
                onClick={handleSpeakingExamClick}
                className={`
                  w-full flex items-center justify-between gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all
                  ${isSpeakingExamModeActive(currentMode)
                    ? 'bg-red-50 text-red-800' 
                    : 'text-slate-600 hover:bg-red-50 hover:text-red-700'}
                `}
              >
                <div className="flex items-center gap-4">
                  <GraduationCap size={20} />
                  Speaking Exam
                </div>
                {isSpeakingExamExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSpeakingExamExpanded ? 'max-h-64 mt-2' : 'max-h-0'}`}>
                <div className="pl-6 space-y-1 border-l-2 border-red-100 ml-8 py-1">
                  {speakingExamModes.map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => {
                        onModeChange(item.mode);
                        setIsSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all
                        ${currentMode === item.mode 
                          ? 'bg-red-700 text-white shadow-lg' 
                          : 'text-slate-500 hover:bg-red-50 hover:text-red-700'}
                      `}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mainNavItems.map((item) => (
              <button
                key={item.mode}
                onClick={() => {
                  onModeChange(item.mode);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all
                  ${currentMode === item.mode 
                    ? 'bg-red-700 text-white shadow-xl shadow-red-100' 
                    : 'text-slate-600 hover:bg-red-50 hover:text-red-700'}
                `}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="text-[10px] text-slate-500 text-center font-medium leading-relaxed px-2">
              MSÜ YDYO Teknoloji Destekli Eğitim Ofisi tarafından hazırlanmıştır.
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto relative bg-slate-50/30">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;