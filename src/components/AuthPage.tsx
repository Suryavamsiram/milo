import { useState } from 'react';
import { Sparkles, Mail, Lock, User, AlertCircle } from 'lucide-react';

type Props = {
  onSignUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
};

export function AuthPage({ onSignUp, onSignIn }: Props) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isSignUp) {
      if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
      const result = await onSignUp(email, password, name.trim());
      if (result.error) setError(result.error);
    } else {
      const result = await onSignIn(email, password);
      if (result.error) setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Milo</h1>
            <p className="text-xs text-gray-400">Campus Gig Marketplace</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => { setIsSignUp(true); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${isSignUp ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>Sign Up</button>
            <button onClick={() => { setIsSignUp(false); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${!isSignUp ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>Sign In</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-medium rounded-lg transition-all text-sm">
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
