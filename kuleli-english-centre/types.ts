export enum AppMode {
  LANDING = 'LANDING',
  EXAM = 'EXAM',
  EXAM_P1 = 'EXAM_P1',
  EXAM_P2 = 'EXAM_P2',
  EXAM_P3 = 'EXAM_P3',
  FREE_SPEAKING = 'FREE_SPEAKING',
  WRITING_EXAM = 'WRITING_EXAM',
  FREE_WRITING = 'FREE_WRITING'
}

export enum ExamPart {
  INTRO = 1,
  PICTURE = 2,
  DISCUSSION = 3
}

export enum ExamStatus {
  IDLE = 'IDLE',
  AI_SPEAKING = 'AI_SPEAKING',
  USER_PREP = 'USER_PREP',
  USER_SPEAKING = 'USER_SPEAKING',
  PROCESSING = 'PROCESSING',
  PART_COMPLETED = 'PART_COMPLETED',
  COMPLETED = 'COMPLETED'
}

export interface Mistake {
  mistake: string;
  correction: string;
  type: 'grammar' | 'pronunciation';
}

export interface FeedbackData {
  taskAchievementScore: number;
  pronunciationScore: number;
  grammarScore: number;
  fluencyCoherenceScore: number;
  // Optional scoring fields used for visualization in FreeSpeakingMode
  fluencyScore?: number;
  vocabularyScore?: number;
  idiomScore?: number;
  feedbackText: string;
  mistakesAndCorrections: Mistake[];
  weaknesses: string[];
  improvements: string[];
}

export interface WritingFeedback {
  taskAchievement: { score: number; explanation: string };
  fluencyCoherence: { score: number; explanation: string };
  grammarMechanics: { score: number; explanation: string };
  vocabulary: { score: number; explanation: string };
  totalScore: number;
  overallFeedback: string;
  corrections: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text?: string;
  audioUrl?: string;
  feedback?: FeedbackData;
  timestamp: number;
}