import React, { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';

interface ApiKeyEntryProps {
  onConnect: (email: string) => void;
}

const ApiKeyEntry: React.FC<ApiKeyEntryProps> = ({ onConnect }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onConnect(email);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 animate-in fade-in duration-700">
      <div className="max-w-[400px] w-full bg-white p-8 text-center space-y-8">
        <div className="space-y-4">
          <div className="h-16 w-16 mx-auto mb-4">
             <img 
               src="https://storage.googleapis.com/kulelienglishcentre/MSU.png" 
               alt="MSU Logo" 
               className="w-full h-full object-contain"
             />
          </div>
          <h1 className="text-2xl font-medium text-slate-800">
            Sign in
          </h1>
          <p className="text-base text-slate-600">
            Use your Google Account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="space-y-2">
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-500"
                placeholder="Email or phone"
              />
            </div>
            <a href="#" className="text-sm font-bold text-blue-600 hover:text-blue-700 rounded inline-block">
              Forgot email?
            </a>
          </div>

          <div className="text-sm text-slate-600">
            Not your computer? Use Guest mode to sign in privately.
            <br />
            <a href="#" className="font-bold text-blue-600 hover:text-blue-700">Learn more</a>
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
            >
              Next
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-8 flex gap-8 text-xs text-slate-500">
        <a href="#" className="hover:text-slate-700">Help</a>
        <a href="#" className="hover:text-slate-700">Privacy</a>
        <a href="#" className="hover:text-slate-700">Terms</a>
      </div>
    </div>
  );
};

export default ApiKeyEntry;