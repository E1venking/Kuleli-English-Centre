import { useState, useEffect, useRef } from 'react';

// Global map to track connected audio elements to prevent "can only be connected once" errors
const connectedElements = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export const useAudioLevel = (source: MediaStream | HTMLAudioElement | null, isActive: boolean) => {
  const [level, setLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !source) {
      setLevel(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const initAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Create Analyser
        if (!analyserRef.current) {
            analyserRef.current = ctx.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.8;
        }

        // Connect Source
        if (source instanceof MediaStream) {
           sourceNodeRef.current = ctx.createMediaStreamSource(source);
           sourceNodeRef.current.connect(analyserRef.current);
        } else if (source instanceof HTMLAudioElement) {
           // Prevent double-connection error for Audio Elements
           if (connectedElements.has(source)) {
               sourceNodeRef.current = connectedElements.get(source)!;
           } else {
               sourceNodeRef.current = ctx.createMediaElementSource(source);
               connectedElements.set(source, sourceNodeRef.current as MediaElementAudioSourceNode);
           }
           // Connect to analyser AND destination (so we can hear it)
           sourceNodeRef.current.connect(analyserRef.current);
           analyserRef.current.connect(ctx.destination);
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const tick = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate RMS (Root Mean Square) for volume
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          
          // Normalize (0 to 1ish)
          // 255 is max byte value, but speech usually sits lower.
          // Boosting a bit for visual effect.
          const normalized = Math.min(1, average / 50); 
          
          setLevel(normalized);
          rafRef.current = requestAnimationFrame(tick);
        };

        tick();

      } catch (err) {
        console.error("Audio Context Error:", err);
      }
    };

    initAudio();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // We don't close the context here to allow reuse, strictly disconnect nodes if needed
      // Ideally we keep the graph alive or manage strictly.
      if (sourceNodeRef.current && source instanceof MediaStream) {
          sourceNodeRef.current.disconnect();
      }
      // AudioElements are tricky to disconnect without cutting audio if component unmounts mid-speech
    };
  }, [source, isActive]);

  return level;
};