import React, { useState } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';

interface ApiKeyEntryProps {
  onConnect: (key?: string) => void;
}

const ApiKeyEntry: React.FC<ApiKeyEntryProps> = ({ onConnect }) => {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualKey, setManualKey] = useState("");

  const handleGoogleSignIn = async () => {
    // 1. Try Google AI Studio (IDX Environment)
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        onConnect();
        return;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("Requested entity was not found")) {
            alert("Sign in was cancelled.");
            return;
        }
      }
    }

    // 2. Check if Developer has provided a key in environment
    if (process.env.API_KEY) {
      onConnect();
      return;
    }

    // 3. Fallback: If no system connection and no env key, ask user for key
    setShowManualInput(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim().length > 10) {
      onConnect(manualKey.trim());
    } else {
      alert("Please enter a valid Gemini API Key.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-700">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-8">
        {/* Branding Section */}
        <div className="space-y-4">
          <div className="h-24 w-24 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100 p-3 mb-6">
             <img 
               src="https://storage.googleapis.com/kulelienglishcentre/MSU.png" 
               alt="MSU Logo" 
               className="w-full h-full object-contain"
             />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Kuleli English Centre
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Welcome to the AI-powered speaking & writing lab. Please sign in to activate your session.
          </p>
        </div>

        {!showManualInput ? (
          /* Primary Sign In Button */
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-4 px-6 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-lg shadow-sm flex items-center justify-center gap-4 transition-all transform hover:scale-[1.01] active:scale-95 group"
          >
            {/* Google G Logo SVG */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        ) : (
          /* Manual Fallback Input */
          <form onSubmit={handleManualSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
               We couldn't detect a Google AI Studio session. Please enter your API key to continue.
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="password" 
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Paste Gemini API Key here..." 
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Start Session <ArrowRight size={20} />
            </button>
            <div className="text-center">
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-red-600 font-semibold underline">
                Get a Gemini API Key here
              </a>
            </div>
          </form>
        )}
          
        {/* Footer Disclaimer */}
        <div className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed border-t border-slate-100 pt-4">
          <p>
            By continuing, you agree to allow <strong>National Defence University</strong> to access Gemini AI features on your behalf for educational purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyEntry;