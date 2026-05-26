import { useState } from 'react';
import { X, LogIn } from 'lucide-react';
import { MOCK_PROFILES } from '../lib/webhook';
import { seedDemoWallets } from '../lib/demoStore';

type Props = {
  onLogin: (profileIdx: number) => Promise<{ error: string | null }>;
  onClose: () => void;
};

const AVATAR_COLORS = [
  'bg-brand-500', 'bg-cyan-500', 'bg-accent-500', 'bg-rose-500',
  'bg-blue-500', 'bg-teal-500', 'bg-amber-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-violet-500',
  'bg-lime-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-red-500',
  'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-cyan-600',
];

export function DevLoginPanel({ onLogin, onClose }: Props) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  const handleLogin = async (idx: number) => {
    setLoadingIdx(idx);
    await onLogin(idx);
    setLoadingIdx(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full animate-slide-in-right">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dev Profile Login</h3>
            <p className="text-[10px] text-gray-400">Switch to a mock contractor account</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {MOCK_PROFILES.map((p, idx) => (
            <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all group">
              <div className={`w-9 h-9 ${AVATAR_COLORS[idx]} rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {p.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {p.tags.slice(0, 2).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 text-[10px] bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded">{t}</span>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{p.loc}</p>
              </div>
              <button onClick={() => handleLogin(idx)} disabled={loadingIdx !== null}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-brand-500 group-hover:text-white text-gray-400 dark:text-gray-300 transition-all disabled:opacity-50 flex-shrink-0">
                {loadingIdx === idx ? (
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <button
            onClick={() => seedDemoWallets(100)}
            className="w-full px-3 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            Seed demo wallets with $100
          </button>
          <p className="text-[10px] text-gray-400 text-center">Credentials: name@milo-dev.local / dev1234</p>
        </div>
      </div>
    </div>
  );
}
