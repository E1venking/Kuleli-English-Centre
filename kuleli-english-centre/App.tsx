import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ExamMode from './components/ExamMode';
import FreeSpeakingMode from './components/FreeSpeakingMode';
import WritingMode from './components/WritingMode';
import LandingPage from './components/LandingPage';
import ApiKeyEntry from './components/ApiKeyEntry';
import { AppMode, ExamPart } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.LANDING);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // We intentionally skip checking hasSelectedApiKey() on mount.
    // This forces the "Sign in" screen to appear for every new session,
    // ensuring the user explicitly connects their account as requested.
    setIsChecking(false);
  }, []);

  const handleConnect = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        // Triggers the secure Google system dialog for account selection/login.
        await aiStudio.openSelectKey();
        // As per documentation, we assume success if no error is thrown.
        setHasApiKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
        const msg = String(e);
        // Handle user cancellation specifically
        if (msg.includes("Requested entity was not found")) {
            setHasApiKey(false);
            alert("Sign in was cancelled. Please try again to access the application.");
        }
      }
    } else {
      // Fallback for local development where window.aistudio might not exist.
      // Checks if a key was manually provided in .env
      if (process.env.API_KEY) {
        setHasApiKey(true);
      } else {
        alert("Google AI Studio environment not detected. Unable to sign in.");
      }
    }
  };

  if (isChecking) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasApiKey) {
    return <ApiKeyEntry onConnect={handleConnect} />;
  }

  return (
    <Layout currentMode={currentMode} onModeChange={setCurrentMode}>
      {currentMode === AppMode.LANDING && (
        <LandingPage onStart={() => setCurrentMode(AppMode.EXAM)} />
      )}
      {currentMode === AppMode.EXAM && <ExamMode key="exam-all" onModeChange={setCurrentMode} />}
      {currentMode === AppMode.EXAM_P1 && <ExamMode key="exam-p1" initialPart={ExamPart.INTRO} isStandalone={true} onModeChange={setCurrentMode} />}
      {currentMode === AppMode.EXAM_P2 && <ExamMode key="exam-p2" initialPart={ExamPart.PICTURE} isStandalone={true} onModeChange={setCurrentMode} />}
      {currentMode === AppMode.EXAM_P3 && <ExamMode key="exam-p3" initialPart={ExamPart.DISCUSSION} isStandalone={true} onModeChange={setCurrentMode} />}
      {currentMode === AppMode.FREE_SPEAKING && <FreeSpeakingMode />}
      {(currentMode === AppMode.WRITING_EXAM || currentMode === AppMode.FREE_WRITING) && (
        <WritingMode mode={currentMode} />
      )}
    </Layout>
  );
};

export default App;