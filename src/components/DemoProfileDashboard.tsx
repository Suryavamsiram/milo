import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, DollarSign, MapPin, Clock, Shield, Wallet as WalletIcon, Calendar, Briefcase, AlertCircle } from 'lucide-react';
import type { GigMatch, UserProfile } from '../lib/supabase';
import { MOCK_PROFILES } from '../lib/webhook';
import { getDemoState, subscribeDemoStore, getMatchExtras, getDemoWallet, type DemoStoreShape } from '../lib/demoStore';

type Props = {
  profileIdx: number;
  matches: GigMatch[];
  posterProfile: UserProfile | null;
  onBack: () => void;
  onAccept: (matchId: string) => Promise<void>;
  onDecline: (matchId: string) => Promise<void>;
  onMarkComplete: (matchId: string, scheduledFor: string | null) => Promise<void>;
};

export function DemoProfileDashboard({ profileIdx, matches, posterProfile, onBack, onAccept, onDecline, onMarkComplete }: Props) {
  const profile = MOCK_PROFILES[profileIdx];
  const mockUserId = `mock-${profileIdx}`;
  const [demoState, setDemoState] = useState<DemoStoreShape>(() => getDemoState());
  const [scheduledMap, setScheduledMap] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => subscribeDemoStore(setDemoState), []);

  // Filter matches that target this mock profile.
  const ownMatches = matches
    .filter((m) => m.matched_user_id === mockUserId)
    .map((m) => ({ ...m, posterName: posterProfile?.name ?? 'Poster' }));

  const walletBalance = getDemoWallet(profile.name);

  // Show only matches where the poster has chosen this profile (decision === 'accepted')
  // and bucket by the contractor-side state stored in demoStore.
  const pendingInvites = ownMatches.filter((m) => {
    const ex = demoState.matchExtras[m.id] ?? getMatchExtras(m.id);
    return m.decision === 'accepted' && ex.contractor_decision === 'pending' && m.escrow_status === 'held';
  });
  const activeJobs = ownMatches.filter((m) => {
    const ex = demoState.matchExtras[m.id] ?? getMatchExtras(m.id);
    return m.decision === 'accepted' && ex.contractor_decision === 'accepted';
  });
  const completedJobs = ownMatches.filter((m) => {
    const ex = demoState.matchExtras[m.id] ?? getMatchExtras(m.id);
    return ex.contractor_decision === 'completed' || ex.contractor_decision === 'paid';
  });

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    await fn();
    setActionLoading(null);
  };

  const initials = profile.name.split(' ').map((n) => n[0]).join('');

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Switch back to your account">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">{profile.name}</h2>
                <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded font-bold uppercase">Demo Mode</span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">{profile.tags.slice(0, 3).join(' · ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-md">
            <WalletIcon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span className="text-xs text-brand-700 dark:text-brand-400 font-semibold">${walletBalance.toFixed(2)}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <>
            {/* Pending invites */}
            <section>
              <h3 className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> New Match Requests ({pendingInvites.length})
              </h3>
              {pendingInvites.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-3">No pending invites. When a poster picks you, it will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {pendingInvites.map((m) => (
                    <div key={m.id} className="p-3.5 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg animate-slide-up">
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{m.title}</h4>
                        <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">{m.match_score}% match</span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">From <span className="text-gray-700 dark:text-gray-300 font-medium">{m.posterName}</span></p>
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><DollarSign className="w-3 h-3 text-brand-500" />${m.pay_min}-${m.pay_max}</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><MapPin className="w-3 h-3" />{m.campus_location || 'Campus'}</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><Clock className="w-3 h-3" />{m.walk_time_mins}m walk</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400"><Shield className="w-3 h-3" />${m.pay_max.toFixed(2)} in escrow</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleAction(`accept-${m.id}`, () => onAccept(m.id))}
                          disabled={actionLoading !== null}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-md text-white text-xs font-medium transition-colors">
                          <CheckCircle className="w-3 h-3" /> Accept Gig
                        </button>
                        <button onClick={() => handleAction(`decline-${m.id}`, () => onDecline(m.id))}
                          disabled={actionLoading !== null}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors">
                          <XCircle className="w-3 h-3" /> Decline (refund escrow)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active jobs */}
            <section>
              <h3 className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3 h-3" /> Active Gigs ({activeJobs.length})
              </h3>
              {activeJobs.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-3">No active gigs yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeJobs.map((m) => {
                    const scheduled = scheduledMap[m.id] ?? '';
                    return (
                      <div key={m.id} className="p-3.5 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg animate-slide-up">
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{m.title}</h4>
                          <span className="px-1.5 py-0.5 bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 rounded text-[10px] font-bold">In Progress</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">For <span className="text-gray-700 dark:text-gray-300 font-medium">{m.posterName}</span></p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><DollarSign className="w-3 h-3 text-brand-500" />${m.pay_max} (escrowed)</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><MapPin className="w-3 h-3" />{m.campus_location || 'Campus'}</span>
                        </div>
                        <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Finish By (optional)
                        </label>
                        <input type="datetime-local" value={scheduled}
                          onChange={(e) => setScheduledMap((p) => ({ ...p, [m.id]: e.target.value }))}
                          className="w-full mb-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-brand-500 rounded-md text-xs text-gray-900 dark:text-white" />
                        <button onClick={() => handleAction(`complete-${m.id}`, () => onMarkComplete(m.id, scheduled || null))}
                          disabled={actionLoading !== null}
                          className="w-full flex items-center justify-center gap-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-md text-white text-xs font-medium transition-colors">
                          <CheckCircle className="w-3 h-3" /> Mark as Complete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Completed jobs */}
            {completedJobs.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" /> History ({completedJobs.length})
                </h3>
                <div className="space-y-2">
                  {completedJobs.map((m) => {
                    const ex = demoState.matchExtras[m.id] ?? getMatchExtras(m.id);
                    const paid = ex.contractor_decision === 'paid';
                    return (
                      <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-lg flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{m.title}</p>
                          <p className="text-[10px] text-gray-400">{m.posterName} - {paid ? `Paid $${m.pay_max.toFixed(2)}` : 'Awaiting poster approval'}</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${paid ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                          {paid ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
        </>
      </div>
    </div>
  );
}
