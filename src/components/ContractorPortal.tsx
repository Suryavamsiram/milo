import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Shield, DollarSign, Briefcase, Timer, RotateCcw, User } from 'lucide-react';
import type { Gig, GigMatch, UserProfile, Notification } from '../lib/supabase';

type Props = {
  profile: UserProfile;
  activeGigs: Gig[];
  matches: GigMatch[];
  wallet: { balance: number } | null;
  notifications: Notification[];
  onMarkComplete: (gigId: string, matchId: string) => Promise<void>;
  onApprovePayment: (gigId: string, matchId: string, amount: number, recipientId: string) => Promise<void>;
  onRequestRedo: (gigId: string, matchId: string) => Promise<void>;
  onBack: () => void;
};

function formatDuration(ms: number): string {
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ContractorPortal({ profile, activeGigs, matches, wallet, notifications, onMarkComplete, onApprovePayment, onRequestRedo, onBack }: Props) {
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        for (const gig of activeGigs) {
          if (gig.status === 'matched' || gig.status === 'in_progress') {
            next[gig.id] = (prev[gig.id] || 0) + 1000;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeGigs]);

  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');
  const matchedGigs = activeGigs.filter((g) => g.status === 'matched' || g.status === 'in_progress');
  const pendingApprovalNotifs = notifications.filter((n) => n.type === 'gig_completion_pending');

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    await fn();
    setActionLoading(null);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div><h2 className="text-sm font-bold text-gray-900 dark:text-white">Contractor Portal</h2><p className="text-[10px] text-gray-400">Manage active gigs</p></div>
          </div>
          {wallet && (
            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-md">
              <DollarSign className="w-3 h-3 text-brand-600 dark:text-brand-400" />
              <span className="text-xs text-brand-700 dark:text-brand-400 font-semibold">${wallet.balance.toFixed(2)}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {matchedGigs.length === 0 && acceptedMatches.length === 0 && pendingApprovalNotifs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No active gigs</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Accepted gigs will appear here</p>
          </div>
        ) : (
          <>
            {pendingApprovalNotifs.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" /> Pending Your Approval
                </h3>
                {pendingApprovalNotifs.map((notif) => {
                  const gigId = (notif.data?.gig_id as string) || '';
                  const gig = activeGigs.find((g) => g.id === gigId);
                  const match = acceptedMatches.find((m) => m.gig_id === gigId);
                  if (!gig || !match) return null;
                  return (
                    <div key={notif.id} className="p-3.5 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg mb-2 animate-slide-up">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
                        <h4 className="text-sm text-gray-900 dark:text-white font-medium">{gig.title}</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-2">{notif.message}</p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Escrow: ${gig.escrow_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleAction(`approve-${gigId}`, () => onApprovePayment(gigId, match!.id, gig!.escrow_amount, match!.matched_user_id))}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-md text-white text-xs font-medium transition-colors">
                          <DollarSign className="w-3 h-3" /> Approve Payment
                        </button>
                        <button onClick={() => handleAction(`redo-${gigId}`, () => onRequestRedo(gigId, match!.id))}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 border border-gray-200 dark:border-gray-700 rounded-md text-gray-500 dark:text-gray-300 text-xs font-medium transition-colors">
                          <RotateCcw className="w-3 h-3" /> Request Redo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {matchedGigs.map((gig) => {
              const match = acceptedMatches.find((m) => m.gig_id === gig.id);
              const timerMs = timers[gig.id] || 0;
              const isPostedByMe = gig.user_id === profile.user_id;

              return (
                <div key={gig.id} className="p-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg card-hover animate-slide-up">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${gig.status === 'in_progress' ? 'bg-brand-500 animate-pulse-soft' : 'bg-cyan-500'}`} />
                      <span className="text-[10px] text-gray-400 font-medium uppercase">{gig.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
                      <Timer className="w-3 h-3 text-brand-500" />
                      <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-semibold">{formatDuration(timerMs)}</span>
                    </div>
                  </div>
                  <h4 className="text-sm text-gray-900 dark:text-white font-bold mb-0.5">{gig.title}</h4>
                  <p className="text-[10px] text-gray-400 mb-2">{gig.category} - {gig.campus_location || 'Campus'}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400"><DollarSign className="w-3 h-3 text-brand-500" />${gig.pay_min}-${gig.pay_max}</span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400"><Shield className="w-3 h-3 text-amber-500" />${gig.escrow_amount.toFixed(2)} escrow</span>
                  </div>
                  {match && (
                    <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400">Worker: <span className="text-gray-900 dark:text-white font-medium">{match.matched_user_name}</span></span>
                    </div>
                  )}
                  {!isPostedByMe && match && gig.status !== 'completed' && (
                    <button onClick={() => handleAction(`complete-${gig.id}`, () => onMarkComplete(gig.id, match.id))}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-md text-white text-xs font-medium transition-colors">
                      <CheckCircle className="w-3 h-3" /> Mark as Complete
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
