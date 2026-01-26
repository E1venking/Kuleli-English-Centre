import React from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  currentTime: number; // current seconds remaining
  totalTime: number;   // total duration for progress calculation
  label?: string;
}

const Timer: React.FC<TimerProps> = ({ currentTime, totalTime, label }) => {
  // Calculate progress percentage (100% at start, 0% at end)
  const progress = totalTime > 0 ? ((totalTime - currentTime) / totalTime) * 100 : 0;
  
  const minutes = Math.floor(currentTime / 60);
  const seconds = currentTime % 60;

  // SVG Configuration
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full">
      <div className="relative h-32 w-32 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="6"
            fill="none"
          />
          {/* Progress Circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`transition-all duration-1000 ease-linear ${
              currentTime < 10 ? 'stroke-orange-500' : 'stroke-red-600'
            }`}
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="text-3xl font-bold text-slate-700">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>
      {label && (
        <div className="flex items-center gap-2 text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
          <Clock size={14} />
          {label}
        </div>
      )}
    </div>
  );
};

export default Timer;