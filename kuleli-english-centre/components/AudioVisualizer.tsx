import React from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording }) => {
  if (!isRecording) {
    return (
      <div className="h-12 w-full flex items-center justify-center gap-1">
        <div className="h-1 w-1 bg-slate-300 rounded-full" />
        <div className="h-1 w-1 bg-slate-300 rounded-full" />
        <div className="h-1 w-1 bg-slate-300 rounded-full" />
      </div>
    );
  }

  // Create a symmetrical waveform pattern
  const barHeights = [12, 20, 32, 24, 40, 24, 32, 20, 12];

  return (
    <div className="h-12 w-full flex items-center justify-center gap-1.5 px-4">
      {barHeights.map((maxHeight, i) => (
        <div
          key={i}
          className="w-1.5 bg-red-500 rounded-full animate-wave"
          style={{
            height: '100%',
            maxHeight: `${maxHeight}px`,
            animationDuration: `${0.6 + (i % 3) * 0.2}s`,
            animationDelay: `${i * 0.05}s`,
            opacity: 0.4 + (i / barHeights.length) * 0.6
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;