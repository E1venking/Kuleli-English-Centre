import React from 'react';

const AiSpeakingVisualizer: React.FC = () => {
  return (
    <div className="flex items-center justify-center gap-1 h-10 overflow-hidden">
      {[
        { color: 'bg-red-400', delay: '0s', height: 'h-4' },
        { color: 'bg-rose-400', delay: '0.15s', height: 'h-7' },
        { color: 'bg-orange-400', delay: '0.3s', height: 'h-5' },
        { color: 'bg-red-500', delay: '0.45s', height: 'h-8' },
        { color: 'bg-rose-500', delay: '0.6s', height: 'h-4' }
      ].map((bar, i) => (
        <div
          key={i}
          className={`w-1.5 ${bar.color} rounded-full animate-wave`}
          style={{
            height: '100%',
            maxHeight: '32px',
            animationDelay: bar.delay,
            filter: 'blur(0.5px)'
          }}
        />
      ))}
    </div>
  );
};

export default AiSpeakingVisualizer;