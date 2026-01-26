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
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
        try {
          const hasKey = await aiStudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (e) {
          console.error("Error checking API key:", e);
        }
      } else {
        // Fallback for development environments without the extension
        if (process.env.API_KEY) {
          setHasApiKey(true);
        }
      }
      setIsChecking(false);
    };
    checkKey();
  }, []);

  const handleConnect = async (email: string) => {
    setUserEmail(email);
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        // Assume success to avoid race conditions as per documentation
        setHasApiKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
        // Reset state if needed
        const msg = String(e);
        if (msg.includes("Requested entity was not found")) {
            setHasApiKey(false);
            alert("Connection cancelled or failed. Please try again.");
        }
      }
    } else {
      // In dev/fallback mode without aistudio, just proceed if we have an env key or simulate
      if (process.env.API_KEY) {
        setHasApiKey(true);
      } else {
        alert("Google AI Studio environment not detected. Cannot select account.");
      }
    }
  };

  if (isChecking) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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