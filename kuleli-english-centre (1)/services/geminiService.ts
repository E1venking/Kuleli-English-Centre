import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FeedbackData, WritingFeedback, ExamPart } from "../types";

// Keep a reference to prevent garbage collection of the utterance
let activeUtterance: SpeechSynthesisUtterance | null = null;
let isAudioUnlocked = false;

// Constants for Model Fallback
const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-2.5-flash";

export const unlockAudio = () => {
  if (isAudioUnlocked) return;
  if (!('speechSynthesis' in window)) return;
  const silentUtterance = new SpeechSynthesisUtterance("");
  silentUtterance.volume = 0;
  window.speechSynthesis.speak(silentUtterance);
  isAudioUnlocked = true;
};

// Helper to check if error is related to quota/limits
const isQuotaError = (error: any) => {
  const errorString = JSON.stringify(error) || String(error);
  return error?.message?.includes('429') || 
    error?.status === 429 || 
    errorString.includes('429') ||
    errorString.includes('RESOURCE_EXHAUSTED') ||
    errorString.toLowerCase().includes('quota');
};

const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && isQuotaError(error)) {
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
    
    try {
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return response.text?.replace(/\*/g, '').trim() || "City vs Village";
    } catch (e) {
        if (isQuotaError(e)) {
            console.warn("Quota hit, switching to fallback model for Topic Gen");
            const response = await ai.models.generateContent({
                model: FALLBACK_MODEL,
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            return response.text?.replace(/\*/g, '').trim() || "City vs Village";
        }
        throw e;
    }
  }).catch(() => "City vs Village");
};

export const generateWritingTopic = async (): Promise<string> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Generate a CEFR A2-B1 level English writing exam topic. 
    Examples: 'Write about a memorable day', 'Write about an important person'. 
    Format MUST include a title and 4-5 bullet points of what to include. 
    Word target: 80-120 words. Use simple text without any bolding or stars.`;
    
    try {
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return response.text?.replace(/\*/g, '').trim() || "Write about your best friend...";
    } catch (e) {
        if (isQuotaError(e)) {
             console.warn("Quota hit, switching to fallback model for Writing Topic");
             const response = await ai.models.generateContent({
                model: FALLBACK_MODEL,
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            return response.text?.replace(/\*/g, '').trim() || "Write about your best friend...";
        }
        throw e;
    }
  }).catch(() => "Write about your best friend...");
};

export const generateExamImage = async (topic: string): Promise<string | null> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // No fallback for image generation available in free tier mostly
      contents: { parts: [{ text: `High quality professional photograph of: ${topic}` }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return null;
  }).catch(() => null);
};

const generateFreeSpeakingReply = async (audioBase64: string, history: any[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = {
      systemInstruction: "You are a friendly English tutor. Reply naturally to the student's input. Keep your response brief (max 3 sentences) and encouraging. Do NOT use stars or markdown.",
      responseMimeType: "text/plain"
  };
  // Updated mimeType to audio/webm to match browser recorder
  const contents = [...history, { role: 'user', parts: [{ inlineData: { mimeType: "audio/webm", data: audioBase64 } }, { text: "Reply conversationally." }] }];

  try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents,
        config
      });
      return (response.text || "").replace(/\*/g, '');
  } catch (e) {
      if (isQuotaError(e)) {
          const response = await ai.models.generateContent({
            model: FALLBACK_MODEL,
            contents,
            config
          });
          return (response.text || "").replace(/\*/g, '');
      }
      throw e;
  }
};

export const processStudentInput = async (
  audioBlob: Blob, 
  mode: 'EXAM' | 'FREE', 
  examContext?: string,
  history: any[] = [],
  currentPart: ExamPart = ExamPart.INTRO,
  turnCount: number = 0,
  onReply?: (text: string) => void
): Promise<{ reply: string, feedback: FeedbackData, moveNext?: boolean }> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const audioBase64 = await blobToBase64(audioBlob);
    
    // FREE MODE OPTIMIZATION: PARALLEL REQUESTS
    if (mode === 'FREE') {
      // 1. Fast Reply Generation
      const replyPromise = generateFreeSpeakingReply(audioBase64, history).then(text => {
        if (onReply) onReply(text);
        return text;
      });

      // 2. Parallel Analysis (JSON)
      const analysisPromise = (async () => {
          // Updated mimeType to audio/webm to match browser recorder
          const contents = [...history, { role: 'user', parts: [{ inlineData: { mimeType: "audio/webm", data: audioBase64 } }, { text: "Analyze." }] }];
          const config = { 
            systemInstruction: "English tutor. Analyze student speech. Return JSON. Do NOT use stars. Focus on grammar, vocabulary, and fluency.", 
            responseMimeType: "application/json", 
            responseSchema: {
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
                        type: { type: Type.STRING, enum: ["grammar", "pronunciation", "vocabulary"] }
                    },
                    required: ["mistake", "correction", "type"]
                    } 
                }
                },
                required: ["taskAchievementScore", "pronunciationScore", "grammarScore", "fluencyCoherenceScore", "feedbackText", "mistakesAndCorrections"]
            }
          };

          try {
             return await ai.models.generateContent({ model: PRIMARY_MODEL, contents, config });
          } catch (e) {
             if (isQuotaError(e)) {
                 return await ai.models.generateContent({ model: FALLBACK_MODEL, contents, config });
             }
             throw e;
          }
      })();

      const [replyText, analysisResponse] = await Promise.all([replyPromise, analysisPromise]);
      const rawJson = analysisResponse.text || "{}";
      const cleanedJson = JSON.parse(rawJson.replace(/\*/g, ''));
      
      return {
        reply: replyText,
        moveNext: false,
        feedback: {
          taskAchievementScore: cleanedJson.taskAchievementScore || 0,
          pronunciationScore: cleanedJson.pronunciationScore || 0,
          grammarScore: cleanedJson.grammarScore || 0,
          fluencyCoherenceScore: cleanedJson.fluencyCoherenceScore || 0,
          fluencyScore: cleanedJson.fluencyScore || 0,
          vocabularyScore: cleanedJson.vocabularyScore || 0,
          idiomScore: cleanedJson.idiomScore || 0,
          feedbackText: cleanedJson.feedbackText || "",
          mistakesAndCorrections: cleanedJson.mistakesAndCorrections || [],
          weaknesses: [],
          improvements: []
        }
      };
    }

    // EXAM MODE: STANDARD SINGLE REQUEST (Optimized for brevity)
    // Define max scores per part
    const maxScore = currentPart === ExamPart.INTRO ? 5 : 10;
    
    const systemInstruction = `IELTS examiner: ${examContext}. 
      
      EXAMINER PROTOCOLS:
      1. LIMIT: You are allowed a MAXIMUM of 2 follow-up questions. You have currently used ${turnCount} turns.
         - If turnCount >= 2, you MUST set 'examMoveToNext: true' and conclude the part.
      2. STEERING & RELEVANCE: 
         - When asking follow-up questions, BRIDGE the student's specific input back to the main topic.
      3. COMPLETION THRESHOLD: 
         - If the student is fluent and has addressed the task, set 'examMoveToNext: true'.
         - If the student has answered 3 times (Main + 2 Follow-ups), you MUST set 'examMoveToNext: true'.
      4. STRICT GRADING: 
         - Be a STRICT examiner. Deduct 'taskAchievementScore' if the student provides minimal or vague information.
      5. RESPONSE BREVITY:
         - Keep 'replyText' VERY BRIEF (max 20 words) to ensure the exam flows quickly.
      
      GRADING RULES for Part ${currentPart}:
      - Score each category between 0.5 and ${maxScore}.
      - MISTAKE TYPES: Categorize errors as "grammar", "vocabulary", or "pronunciation".
      
      IMPORTANT: NEVER use stars (*) or bold markdown in any field. Level target: A2-B1+.`;

    // Updated mimeType to audio/webm to match browser recorder
    const contents = [...history, { role: 'user', parts: [{ inlineData: { mimeType: "audio/webm", data: audioBase64 } }, { text: "Analyze." }] }];
    const config = { 
        systemInstruction, 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { type: Type.STRING },
            taskAchievementScore: { type: Type.NUMBER },
            pronunciationScore: { type: Type.NUMBER },
            grammarScore: { type: Type.NUMBER },
            fluencyCoherenceScore: { type: Type.NUMBER },
            feedbackText: { type: Type.STRING },
            mistakesAndCorrections: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  mistake: { type: Type.STRING },
                  correction: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["grammar", "pronunciation", "vocabulary"] }
                },
                required: ["mistake", "correction", "type"]
              } 
            },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            examMoveToNext: { type: Type.BOOLEAN }
          },
          required: ["replyText", "taskAchievementScore", "pronunciationScore", "grammarScore", "fluencyCoherenceScore", "feedbackText", "examMoveToNext", "mistakesAndCorrections"]
        }
    };

    let response;
    try {
        response = await ai.models.generateContent({ model: PRIMARY_MODEL, contents, config });
    } catch (e) {
        if (isQuotaError(e)) {
            console.warn("Quota hit, switching to fallback model for Exam Mode");
            response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents, config });
        } else {
            throw e;
        }
    }
    
    const rawText = (response.text || "{}").replace(/\*/g, '');
    const json = JSON.parse(rawText);
    
    const clean = (obj: any): any => {
      if (typeof obj === 'string') return obj.replace(/\*/g, '');
      if (Array.isArray(obj)) return obj.map(clean);
      if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const key in obj) newObj[key] = clean(obj[key]);
        return newObj;
      }
      return obj;
    };

    const cleanedJson = clean(json);
    
    // Invoke onReply for consistency if provided (even though it's late for Exam mode)
    if (onReply && cleanedJson.replyText && !cleanedJson.examMoveToNext) {
        onReply(cleanedJson.replyText);
    }

    return {
      reply: cleanedJson.replyText, 
      moveNext: cleanedJson.examMoveToNext,
      feedback: {
        taskAchievementScore: cleanedJson.taskAchievementScore || 0,
        pronunciationScore: cleanedJson.pronunciationScore || 0,
        grammarScore: cleanedJson.grammarScore || 0,
        fluencyCoherenceScore: cleanedJson.fluencyCoherenceScore || 0,
        feedbackText: cleanedJson.feedbackText || "",
        mistakesAndCorrections: cleanedJson.mistakesAndCorrections || [],
        weaknesses: cleanedJson.weaknesses || [],
        improvements: cleanedJson.improvements || []
      }
    };
  });
};

export const processWritingInput = async (text: string, topic?: string): Promise<WritingFeedback> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = `You are an English writing evaluator for A2-B1 levels. 
    Analyze the text based on these EXACT criteria:
    
    1. Task Achievement (Min: 0.5, Max: 3 pts)
    2. Fluency and Coherence (Min: 0.5, Max: 2 pts)
    3. Grammar and Mechanics (Min: 0.5, Max: 3 pts)
    4. Vocabulary (Min: 0.5, Max: 2 pts)

    Total Max: 10 pts.
    IMPORTANT: DO NOT USE STARS (*) OR BOLD MARKDOWN IN ANY FIELD.`;

    const contents = [{ role: 'user', parts: [{ text: `Topic: ${topic || "No Specific Topic - Free Writing"}\n\nStudent Text: ${text}` }] }];
    const config = { 
        systemInstruction, 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            taskAchievement: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                explanation: { type: Type.STRING } 
              },
              required: ["score", "explanation"]
            },
            fluencyCoherence: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                explanation: { type: Type.STRING } 
              },
              required: ["score", "explanation"]
            },
            grammarMechanics: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                explanation: { type: Type.STRING } 
              },
              required: ["score", "explanation"]
            },
            vocabulary: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                explanation: { type: Type.STRING } 
              },
              required: ["score", "explanation"]
            },
            totalScore: { type: Type.NUMBER },
            overallFeedback: { type: Type.STRING },
            corrections: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["taskAchievement", "fluencyCoherence", "grammarMechanics", "vocabulary", "totalScore", "overallFeedback", "corrections"]
        }
    };

    let response;
    try {
        response = await ai.models.generateContent({ model: PRIMARY_MODEL, contents, config });
    } catch (e) {
        if (isQuotaError(e)) {
             console.warn("Quota hit, switching to fallback model for Writing Eval");
             response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents, config });
        } else {
            throw e;
        }
    }
    
    const data = JSON.parse(response.text || "{}");
    
    const clean = (obj: any): any => {
      if (typeof obj === 'string') return obj.replace(/\*/g, '');
      if (Array.isArray(obj)) return obj.map(clean);
      if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const key in obj) newObj[key] = clean(obj[key]);
        return newObj;
      }
      return obj;
    };
    
    return clean(data);
  });
};