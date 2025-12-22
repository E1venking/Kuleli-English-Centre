import React, { useState } from 'react';
import Layout from './components/Layout';
import ExamMode from './components/ExamMode';
import FreeSpeakingMode from './components/FreeSpeakingMode';
import WritingMode from './components/WritingMode';
import LandingPage from './components/LandingPage';
import { AppMode, ExamPart } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.LANDING);

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