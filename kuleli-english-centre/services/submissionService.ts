import { UserProfile } from "../types";

// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
// Example: "https://script.google.com/macros/s/AKfycbx.../exec"
const SUBMISSION_API_URL = "https://script.google.com/macros/s/AKfycbzwukpooPXBjSQqdKEcbuFuK235VY5lY9oJRMXZF7lzeq_JkQa8R2W-7KBgBiIIJfoj/exec"; 

export interface ExamResultPayload {
  user: UserProfile;
  type: 'SPEAKING_EXAM' | 'WRITING_EXAM';
  score: number;
  maxScore: number;
  breakdown: string; // JSON string of specific scores
  feedbackSummary: string;
}

export const submitExamResult = async (payload: ExamResultPayload): Promise<boolean> => {
  // If no URL is configured, we simulate a success for the UI demo
  if (!SUBMISSION_API_URL) {
    console.warn("Submission URL not configured. Simulating success.");
    console.log("Payload:", payload);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true; 
  }

  try {
    // We use no-cors mode because Google Apps Script doesn't support CORS headers perfectly 
    // for simple POSTs, but opaque responses are fine for fire-and-forget logging.
    await fetch(SUBMISSION_API_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        epaulette: payload.user.name, // Using name field as Epaulette based on previous change
        name: payload.user.name,
        type: payload.type,
        score: `${payload.score.toFixed(1)} / ${payload.maxScore}`,
        breakdown: payload.breakdown,
        feedback: payload.feedbackSummary
      }),
    });
    return true;
  } catch (error) {
    console.error("Submission failed:", error);
    return false;
  }
};