import { useState, useMemo } from 'react';
import { ArrowLeft, MapPin, DollarSign, Clock, Tag, Users, Search, Filter, Send, CheckCircle, User } from 'lucide-react';
import type { Gig, GigApplication, UserProfile } from '../lib/supabase';

type Props = {
  profile: UserProfile;
  allOpenGigs: Gig[];
  applications: GigApplication[];
  onApplyToGig: (gig: Gig, message: string) => Promise<{ error: string | null | unknown }>;
  onBack: () => void;
};

const CATEGORIES = ['All', 'Tutoring & Academic Help', 'Tech Support & Repairs', 'Moving & Lifting', 'Cleaning & Organization', 'Photography & Videography', 'Graphic Design & Creative Work', 'Food & Grocery Runs', 'Pet Care', 'Event Help & Setup', 'Other'];

export function GigsPage({ profile, allOpenGigs, applications, onApplyToGig, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applied, setApplied] = useState<Set<string>>(() => {
    const s = new Set<string>();
    applications.filter((a) => a.applicant_id === profile.user_id).forEach((a) => s.add(a.gig_id));
    return s;
  });

  const filtered = useMemo(() => {
    return allOpenGigs.filter((g) => {
      if (g.user_id === profile.user_id) return false;
      if (category !== 'All' && g.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.content.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.campus_location.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allOpenGigs, category, search, profile.user_id]);

  const handleApply = async (gig: Gig) => {
    if (!applyMessage.trim()) return;
    const result = await onApplyToGig(gig, applyMessage.trim());
    if (!result.error) { setApplied((prev) => new Set([...prev, gig.id])); setApplyingTo(null); setApplyMessage(''); }
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
          <div><h2 className="text-sm font-bold text-gray-900 dark:text-white">Available Gigs</h2><p className="text-[10px] text-gray-400">{filtered.length} gigs found</p></div>
        </div>
      </header>

      <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gigs..."
            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-2 py-1 text-[10px] rounded-md border whitespace-nowrap transition-colors ${
                category === cat ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-300 dark:border-brand-600 text-brand-600 dark:text-brand-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
              }`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10"><Filter className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" /><p className="text-xs text-gray-400">No gigs found</p><p className="text-[10px] text-gray-300">Try adjusting your search</p></div>
        ) : (
          filtered.map((gig) => (
            <div key={gig.id} className="p-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-300 dark:hover:border-brand-700 card-hover">
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-gray-900 dark:text-white font-medium truncate">{gig.title}</h3>
                  <div className="flex items-center gap-1 mt-0.5"><Tag className="w-2.5 h-2.5 text-brand-500" /><span className="text-[10px] text-gray-400">{gig.category}</span></div>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 flex-shrink-0 ml-2">{gig.status}</span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2 line-clamp-2">{gig.content || gig.category}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><DollarSign className="w-3 h-3 text-brand-500" />${gig.pay_min}-${gig.pay_max}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><MapPin className="w-3 h-3 text-gray-400" />{gig.campus_location || 'Campus'}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Users className="w-3 h-3 text-amber-500" />{gig.accepted_by_name || 'Open'}</span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Clock className="w-3 h-3 text-gray-400" />{new Date(gig.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 bg-brand-500 rounded flex items-center justify-center text-white text-[9px] font-bold">{gig.poster_name.slice(0, 2).toUpperCase()}</div>
                <span className="text-[10px] text-gray-500">{gig.poster_name}</span>
              </div>
              {applied.has(gig.id) ? (
                <div className="flex items-center gap-1 text-[10px] text-brand-600 dark:text-brand-400"><CheckCircle className="w-3 h-3" />Applied</div>
              ) : applyingTo === gig.id ? (
                <div className="space-y-1.5">
                  <textarea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)} placeholder="Why are you a good fit?" rows={2}
                    className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none" />
                  <div className="flex gap-1.5">
                    <button onClick={() => handleApply(gig)} disabled={!applyMessage.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 rounded-md text-white disabled:text-gray-400 text-[10px] font-medium transition-colors">
                      <Send className="w-3 h-3" />Submit
                    </button>
                    <button onClick={() => { setApplyingTo(null); setApplyMessage(''); }}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-500 text-[10px] font-medium transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setApplyingTo(gig.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 rounded-md text-white text-[10px] font-medium transition-colors">
                  <User className="w-3 h-3" />Apply
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
