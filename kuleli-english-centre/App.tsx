import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ExamMode from './components/ExamMode';
import FreeSpeakingMode from './components/FreeSpeakingMode';
import WritingMode from './components/WritingMode';
import LandingPage from './components/LandingPage';
import ApiKeyEntry from './components/ApiKeyEntry';
import { AppMode, ExamPart, UserProfile } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.LANDING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // We start by checking if user needs to login. 
    // Even if API KEY is in env, we want the user to "Sign In" for identity.
    setIsChecking(false);
  }, []);

  const handleConnect = (userProfile: UserProfile) => {
    setUser(userProfile);
  };

  if (isChecking) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <ApiKeyEntry onConnect={handleConnect} />;
  }

  return (
    <Layout currentMode={currentMode} onModeChange={setCurrentMode} user={user}>
      {currentMode === AppMode.LANDING && (
        <LandingPage onStart={() => setCurrentMode(AppMode.EXAM)} />
      )}
      {currentMode === AppMode.EXAM && <ExamMode key="exam-all" onModeChange={setCurrentMode} user={user} />}
      {currentMode === AppMode.EXAM_P1 && <ExamMode key="exam-p1" initialPart={ExamPart.INTRO} isStandalone={true} onModeChange={setCurrentMode} user={user} />}
      {currentMode === AppMode.EXAM_P2 && <ExamMode key="exam-p2" initialPart={ExamPart.PICTURE} isStandalone={true} onModeChange={setCurrentMode} user={user} />}
      {currentMode === AppMode.EXAM_P3 && <ExamMode key="exam-p3" initialPart={ExamPart.DISCUSSION} isStandalone={true} onModeChange={setCurrentMode} user={user} />}
      {currentMode === AppMode.FREE_SPEAKING && <FreeSpeakingMode />}
      {(currentMode === AppMode.WRITING_EXAM || currentMode === AppMode.FREE_WRITING) && (
        <WritingMode mode={currentMode} user={user} />
      )}
    </Layout>
  );
};

export default App;