import { useState } from 'react';
import { MapPin, DollarSign, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Zap, Hourglass, BadgeCheck } from 'lucide-react';
import type { GigMatch } from '../lib/supabase';
import type { ContractorDecision } from '../lib/demoStore';

type Props = {
  match: GigMatch;
  gigLocked?: boolean;
  chosenWorker?: boolean;
  contractorDecision?: ContractorDecision;
  scheduledFor?: string | null;
  onAccept: (matchId: string) => void;
  onDecline: (matchId: string) => void;
  onReleaseEscrow?: (matchId: string) => void;
  onFinishAndPay?: (matchId: string) => void;
  onMarkComplete?: (matchId: string) => void;
};

export function MatchCard({ match, gigLocked, chosenWorker, contractorDecision = 'pending', scheduledFor, onAccept, onDecline, onReleaseEscrow, onFinishAndPay, onMarkComplete }: Props) {
  const [showReasoning, setShowReasoning] = useState(false);

  const scoreBg = match.match_score >= 90
    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-500/30'
    : match.match_score >= 75
    ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30'
    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';

  // FIX: If this specific card is the chosen worker, keep it completely vibrant even if the gig is locked!
  // Otherwise, if another card was chosen, gray this one out.
  const isGrayedOut = gigLocked && !chosenWorker;

  // Determine if a decision has been made yet
  const hasDecision = match.decision === 'accepted' || match.decision === 'rejected';

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 bg-white dark:bg-gray-900 shadow-sm
      ${isGrayedOut ? 'opacity-60 grayscale scale-[0.98]' : 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700'}
      ${chosenWorker ? 'ring-2 ring-brand-500 border-transparent dark:bg-brand-500/5' : 'border-gray-200 dark:border-gray-800'}`}>
      
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              {match.matched_user_name || 'Campus Peer'}
            </h4>
            {chosenWorker && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider">
                <BadgeCheck className="w-2.5 h-2.5" /> Hired
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {match.description || 'No description provided.'}
          </p>
        </div>
        
        <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg border font-mono text-xs font-bold ${scoreBg}`}>
          <span>{match.match_score}%</span>
          <span className="text-[9px] uppercase tracking-wider font-sans opacity-75">Match</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-gray-400" />
          <span className="truncate">{match.campus_location || 'Main Campus'}</span>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <Clock className="w-3 h-3 text-gray-400" />
          <span>{match.walk_time_mins ?? 5} min walk</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-brand-500" />
          <span className="font-medium text-gray-700 dark:text-gray-300">
            ${match.pay_min || 15}/hr - ${match.pay_max || 30}/hr
          </span>
        </div>
        {chosenWorker && (
          <div className="flex items-center gap-1 justify-end">
            <Hourglass className="w-3 h-3 text-amber-500" />
            <div className="text-right">
              <div className="font-medium text-amber-600 dark:text-amber-400 capitalize">
                {contractorDecision === 'completed' ? 'Done (Pending Approval)' : contractorDecision}
              </div>
              {scheduledFor && (
                <div className="text-[10px] text-amber-500 dark:text-amber-300">Due by {scheduledFor}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Algorithmic Reasoning Panel Toggle Button */}
      <button
        onClick={() => setShowReasoning(!showReasoning)}
        className="w-full mt-3 flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/80 border border-gray-100 dark:border-gray-800/40 rounded-md text-[10px] text-gray-500 transition-colors"
      >
        <span className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400">
          <Zap className="w-2.5 h-2.5 text-cyan-500" /> View Match Reasoning Breakdown
        </span>
        {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded Algorithmic Reasoning Panel */}
      {showReasoning && (
        <div className="mt-1.5 p-2 bg-slate-900 text-slate-300 rounded-md border border-slate-800 font-mono text-[10px] space-y-1 animate-fadeIn">
          <div className="flex justify-between border-b border-slate-800 pb-1 mb-1 text-slate-400 font-sans">
            <span>Metric Matrix</span>
            <span>Weight Assignment</span>
          </div>
          <div className="flex justify-between">
            <span>• Interest Alignment:</span>
            <span className="text-cyan-400">{(match.match_score * 0.6).toFixed(1)}% / 60%</span>
          </div>
          <div className="flex justify-between">
            <span>• Proximity Multiplier:</span>
            <span className="text-emerald-400">{((100 - (match.walk_time_mins ?? 5) * 2) * 0.2).toFixed(1)}% / 20%</span>
          </div>
          <div className="flex justify-between">
            <span>• Model Guardrail Enrichment:</span>
            <span className="text-purple-400">20.0% / 20%</span>
          </div>
          <div className="pt-1 mt-1 border-t border-slate-800/60 flex justify-between font-bold text-white">
            <span>Composite Score:</span>
            <span className="text-brand-400">{match.match_score}%</span>
          </div>
        </div>
      )}

      {/* ACTION ACTIONS LAYER */}
      {/* Show action controls for undecided matches, disabled if card is locked */}
      {!hasDecision && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onAccept(match.id)}
            disabled={gigLocked}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-md transition-all ${
              gigLocked
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/10'
            }`}
          >
            <CheckCircle className="w-3 h-3" /> Accept
          </button>
          <button
            onClick={() => onDecline(match.id)}
            disabled={gigLocked}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-md transition-colors ${
              gigLocked
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <XCircle className="w-3 h-3" /> Decline
          </button>
        </div>
      )}

      {/* Escrow and Wallet Resolution buttons */}
      {match.decision === 'accepted' && match.escrow_status === 'held' && contractorDecision === 'completed' && onFinishAndPay && (
        <button
          onClick={() => onFinishAndPay(match.id)}
          className="w-full mt-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-md transition-all shadow-md shadow-emerald-500/10"
        >
          Approve Release & Pay ${match.pay_max.toFixed(2)}
        </button>
      )}

      {match.decision === 'accepted' && match.escrow_status === 'held' && contractorDecision === 'pending' && onMarkComplete && (
        <button
          onClick={() => onMarkComplete(match.id)}
          className="w-full mt-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-md transition-all shadow-sm shadow-cyan-500/10"
        >
          Mark Work Complete
        </button>
      )}

      {match.decision === 'accepted' && match.escrow_status === 'held' && contractorDecision !== 'completed' && contractorDecision !== 'declined' && onReleaseEscrow && (
        <button
          onClick={() => onReleaseEscrow(match.id)}
          className="w-full mt-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-md transition-colors"
        >
          Cancel Contract & Unlock Funds
        </button>
      )}
    </div>
  );
}