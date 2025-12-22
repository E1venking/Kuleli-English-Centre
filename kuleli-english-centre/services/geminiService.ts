import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FeedbackData, WritingFeedback, ExamPart } from "../types";

// Keep a reference to prevent garbage collection of the utterance
let activeUtterance: SpeechSynthesisUtterance | null = null;
let isAudioUnlocked = false;

export const unlockAudio = () => {
  if (isAudioUnlocked) return;
  if (!('speechSynthesis' in window)) return;
  const silentUtterance = new SpeechSynthesisUtterance("");
  silentUtterance.volume = 0;
  window.speechSynthesis.speak(silentUtterance);
  isAudioUnlocked = true;
};

const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorString = JSON.stringify(error) || String(error);
    const isQuotaError = 
      error?.message?.includes('429') || 
      error?.status === 429 || 
      errorString.includes('429') ||
      errorString.includes('RESOURCE_EXHAUSTED') ||
      errorString.toLowerCase().includes('quota');
                        
    if (retries > 0 && isQuotaError) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const speakWithBrowserFallback = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const doSpeak = () => {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\*/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      activeUtterance = utterance;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                      voices.find(v => v.lang.startsWith('en')) || 
                      voices[0];
      if (enVoice) utterance.voice = enVoice;
      utterance.onend = () => { activeUtterance = null; resolve(); };
      utterance.onerror = () => { activeUtterance = null; resolve(); };
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => doSpeak(), { once: true });
    } else { doSpeak(); }
  });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
};

const addWavHeader = (pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Uint8Array => {
  const headerLength = 44;
  const dataLength = pcmData.length;
  const buffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buffer);
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(view, 0, 'RIFF');
  view.setUint32(4, dataLength + 36, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  const pcmBytes = new Uint8Array(buffer);
  pcmBytes.set(pcmData, 44);
  return pcmBytes;
};

export const synthesizeSpeech = async (text: string): Promise<string | 'FALLBACK_HANDLED' | null> => {
  try {
    return await fetchWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const cleanText = text.replace(/\*/g, '');
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const wavData = addWavHeader(base64ToUint8Array(base64Audio), 24000);
        return `data:audio/wav;base64,${uint8ArrayToBase64(wavData)}`;
      }
      return null;
    });
  } catch (error) {
    await speakWithBrowserFallback(text);
    return 'FALLBACK_HANDLED';
  }
};

export const generateExamTopic = async (part: number): Promise<string> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = part === 2 
        ? "Generate two contrasting subjects for a picture comparison exam. Examples: 'A crowded modern city' vs 'A peaceful rural village', 'Individual sports like tennis' vs 'Team sports like football', 'Studying in a library' vs 'Studying in a cafe'. Return ONLY the subjects separated by ' vs '. Be creative." 
        : "Generate a single interesting discussion question for an English exam at A2-B1+ level. Use clear, simple language and avoid overly academic or abstract topics. Examples: 'Do you prefer living in a city or a village? Why?', 'What are the advantages of learning a second language?', 'Is it important to travel to other countries?'.";
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text?.replace(/\*/g, '').trim() || "City vs Village";
  }).catch(() => "City vs Village");
};

export const generateWritingTopic = async (): Promise<string> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Generate a CEFR A2-B1 level English writing exam topic. 
    Examples: 'Write about a memorable day', 'Write about an important person'. 
    Format MUST include a title and 4-5 bullet points of what to include. 
    Word target: 80-120 words. Use simple text without any bolding or stars.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text?.replace(/\*/g, '').trim() || "Write about your best friend...";
  }).catch(() => "Write about your best friend...");
};

// Fix truncated generateExamImage function
export const generateExamImage = async (topic: string): Promise<string | null> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality professional photograph of: ${topic}` }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return null;
  }).catch(() => null);
};

// Fix missing export 'processStudentInput'
export const processStudentInput = async (
  audioBlob: Blob,
  mode: 'EXAM' | 'FREE',
  context?: string,
  history: any[] = [],
  part?: number
): Promise<{ reply: string; feedback: FeedbackData; moveNext: boolean }> => {
  const base64Audio = await blobToBase64(audioBlob);
  
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = mode === 'EXAM' 
      ? `You are an IELTS examiner for Part ${part}. Context: ${context}. Evaluate the student strictly and provide detailed feedback in JSON format. If the student has provided a complete and sufficient answer for this part, set moveNext: true.`
      : `You are a helpful and friendly English tutor. Chat with the student and provide live feedback on their speech (fluency, grammar, vocabulary). Return response in JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        ...history,
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
            { text: "Evaluate my speaking performance." }
          ]
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            moveNext: { type: Type.BOOLEAN },
            feedback: {
              type: Type.OBJECT,
              properties: {
                taskAchievementScore: { type: Type.NUMBER },
                pronunciationScore: { type: Type.NUMBER },
                grammarScore: { type: Type.NUMBER },
                fluencyCoherenceScore: { type: Type.NUMBER },
                fluencyScore: { type: Type.NUMBER },
                vocabularyScore: { type: Type.NUMBER },
                idiomScore: { type: Type.NUMBER },
                feedbackText: { type: Type.STRING },
                mistakesAndCorrections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      mistake: { type: Type.STRING },
                      correction: { type: Type.STRING },
                      type: { type: Type.STRING }
                    }
                  }
                },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvements: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["taskAchievementScore", "pronunciationScore", "grammarScore", "fluencyCoherenceScore", "feedbackText", "mistakesAndCorrections"]
            }
          },
          required: ["reply", "feedback"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    if (data.feedback) {
      // Ensure visualization fields for FreeSpeakingMode are populated
      data.feedback.fluencyScore = data.feedback.fluencyScore ?? Math.min(100, Math.floor(data.feedback.fluencyCoherenceScore * 10));
      data.feedback.vocabularyScore = data.feedback.vocabularyScore ?? Math.min(100, Math.floor(data.feedback.taskAchievementScore * 10));
      data.feedback.idiomScore = data.feedback.idiomScore ?? Math.min(100, Math.floor(data.feedback.pronunciationScore * 10));
    }
    return data;
  });
};

// Fix missing export 'processWritingInput'
export const processWritingInput = async (text: string, topic: string): Promise<WritingFeedback> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{
        role: "user",
        parts: [{ text: `Topic: ${topic}\n\nStudent Writing: ${text}\n\nPlease evaluate this according to CEFR A2-B1 standards.` }]
      }],
      config: {
        systemInstruction: "You are an expert English writing examiner. Evaluate the text and provide feedback in JSON format. Scores should be out of 10 total.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            taskAchievement: {
              type: Type.OBJECT,
              properties: { score: { type: Type.NUMBER }, explanation: { type: Type.STRING } },
              required: ["score", "explanation"]
            },
            fluencyCoherence: {
              type: Type.OBJECT,
              properties: { score: { type: Type.NUMBER }, explanation: { type: Type.STRING } },
              required: ["score", "explanation"]
            },
            grammarMechanics: {
              type: Type.OBJECT,
              properties: { score: { type: Type.NUMBER }, explanation: { type: Type.STRING } },
              required: ["score", "explanation"]
            },
            vocabulary: {
              type: Type.OBJECT,
              properties: { score: { type: Type.NUMBER }, explanation: { type: Type.STRING } },
              required: ["score", "explanation"]
            },
            totalScore: { type: Type.NUMBER },
            overallFeedback: { type: Type.STRING },
            corrections: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["taskAchievement", "fluencyCoherence", "grammarMechanics", "vocabulary", "totalScore", "overallFeedback", "corrections"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
};