import { Briefcase, Shield, CheckCircle, Clock, XCircle, DollarSign, MapPin, Activity } from 'lucide-react';
import type { Gig, GigMatch, UserProfile } from '../lib/supabase';

type Props = {
  profile: UserProfile;
  activeGigs: Gig[];
  matches: GigMatch[];
  totalEscrow: number;
};

const statusIcon = {
  open: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  matched: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  in_progress: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
  completed: <CheckCircle className="w-3.5 h-3.5 text-blue-400" />,
  cancelled: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
};

const statusLabel = {
  open: 'Open',
  matched: 'Matched',
  in_progress: 'In Progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export function Sidebar({ profile, activeGigs, matches, totalEscrow }: Props) {
  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');

  return (
    <aside className="w-72 flex-shrink-0 bg-slate-900/50 border-r border-slate-800/50 flex flex-col h-full overflow-y-auto">
      {/* Profile */}
      <div className="p-5 border-b border-slate-800/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{profile.name}</p>
            <p className="text-xs text-slate-400 capitalize">{profile.role} · {profile.campus_location}</p>
          </div>
        </div>

        {/* Escrow balance */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-semibold">Escrow Balance</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalEscrow.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Held in trust · Safe</p>
        </div>
      </div>

      {/* Active Gigs */}
      <div className="p-5 border-b border-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Active Gigs</h3>
          {activeGigs.length > 0 && (
            <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
              {activeGigs.length}
            </span>
          )}
        </div>

        {activeGigs.length === 0 ? (
          <p className="text-xs text-slate-600">No active gigs yet. Ask Milo to post or find one!</p>
        ) : (
          <div className="space-y-2">
            {activeGigs.slice(0, 5).map((gig) => (
              <div key={gig.id} className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
                <div className="flex items-center gap-1.5 mb-1">
                  {statusIcon[gig.status]}
                  <span className="text-xs text-slate-400">{statusLabel[gig.status]}</span>
                  <span className="ml-auto text-xs text-slate-500 uppercase">{gig.type}</span>
                </div>
                <p className="text-xs text-slate-300 font-medium truncate">{gig.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <DollarSign className="w-3 h-3" />
                    <span>${gig.pay_min}–${gig.pay_max}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{gig.campus_location || 'Campus'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match History */}
      <div className="p-5 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Match History</h3>
          {acceptedMatches.length > 0 && (
            <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              {acceptedMatches.length}
            </span>
          )}
        </div>

        {acceptedMatches.length === 0 ? (
          <p className="text-xs text-slate-600">Accepted matches will appear here.</p>
        ) : (
          <div className="space-y-2">
            {acceptedMatches.slice(0, 6).map((m) => (
              <div key={m.id} className="p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/30">
                <p className="text-xs text-white font-medium truncate">{m.matched_user_name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{m.match_score}% match</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    m.escrow_status === 'released' ? 'bg-blue-500/10 text-blue-400'
                    : m.escrow_status === 'held' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-slate-700/50 text-slate-500'
                  }`}>
                    {m.escrow_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
