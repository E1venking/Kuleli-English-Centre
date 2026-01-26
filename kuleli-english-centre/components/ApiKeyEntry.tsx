import React, { useState } from 'react';
import { Key, AlertCircle, ArrowRight, User, ExternalLink, ChevronDown } from 'lucide-react';
import { setAuth } from '../services/geminiService';
import { UserProfile } from '../types';

interface ApiKeyEntryProps {
  onConnect: (user: UserProfile) => void;
}

const ApiKeyEntry: React.FC<ApiKeyEntryProps> = ({ onConnect }) => {
  const [apiKey, setApiKey] = useState('');
  const [epauletteNumber, setEpauletteNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim()) {
      setError('Please enter your API Key.');
      return;
    }

    if (!apiKey.trim().startsWith('AIza')) {
      setError('Invalid API Key format. It usually starts with "AIza".');
      return;
    }

    // Set Auth Strategy to Manual API Key
    setAuth({ type: 'apiKey', value: apiKey.trim() });

    // Create a pseudo-profile using the Epaulette Number as the name
    const displayId = epauletteNumber.trim() || "Cadet";
    
    const userProfile: UserProfile = {
      name: displayId,
      email: "guest@kuleli.edu",
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayId)}&background=dc2626&color=fff&bold=true&length=4`
    };

    onConnect(userProfile);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-700">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-8 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-red-600 to-red-700"></div>

        <div className="space-y-4">
          <div className="h-24 w-24 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100 p-3 mb-6 transition-transform hover:scale-105 duration-500">
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
            AI-Powered Speaking & Writing Lab
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Epaulette Number</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  value={epauletteNumber}
                  onChange={(e) => setEpauletteNumber(e.target.value)}
                  placeholder="e.g. 1923"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Gemini API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter AIza..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
                type="submit"
                className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-200 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95"
            >
                Start Session <ArrowRight size={20} />
            </button>

            {error && (
                <div className="flex items-start gap-2 text-xs font-bold text-red-600 bg-red-50 p-3 rounded-lg animate-in slide-in-from-top-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span className="leading-tight">{error}</span>
                </div>
            )}
        </form>
          
        <div className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed border-t border-slate-100 pt-4">
          <p className="mb-2">Don't have an API Key?</p>
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline"
          >
            Get one for free from Google <ExternalLink size={10} />
          </a>

          <details className="mt-4 text-left group select-none">
            <summary className="cursor-pointer font-bold text-slate-500 hover:text-red-600 transition-colors list-none flex items-center justify-center gap-1">
              <span>How to create a key</span>
              <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
               <ol className="list-decimal list-inside space-y-2">
                  <li>Click the link above to open <span className="font-bold">Google AI Studio</span>.</li>
                  <li>Sign in with your <span className="font-bold">Google Account</span>.</li>
                  <li>Click the blue <span className="font-bold text-slate-700">"Create API key"</span> button.</li>
                  <li>Choose <span className="italic">"Create API key in new project"</span>.</li>
                  <li>Copy the code that starts with <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-red-600 text-[10px]">AIza</code>.</li>
                  <li>Paste it into the box above.</li>
               </ol>
            </div>
          </details>

          <p className="mt-4">Your key is used directly from your browser to Google servers. It is not stored on our servers.</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyEntry;