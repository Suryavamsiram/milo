import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Settings, MapPin, DollarSign, Shield, Mic, MicOff, X, Loader2 } from 'lucide-react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import { useMiloChat } from '../hooks/useMiloChat';
import { MatchCard } from './MatchCard';
import { getDemoState, subscribeDemoStore } from '../lib/demoStore';

type Props = {
  profile: UserProfile;
  userId: string;
  sessionId: string;
  activeGigs: Gig[];
  matches: GigMatch[];
  totalEscrow: number;
  onOpenSettings: () => void;
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onFinishAndPay: (matchId: string) => Promise<void>;
  onContractorMarkComplete: (matchId: string, scheduledFor?: string | null) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

/** Animated searching indicator shown while telemetry entry is in the list */
function SearchingAnimation() {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-3 h-3 text-white" />
      </div>
      <div className="px-3 py-2.5 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-xl rounded-tl-sm flex items-center gap-2.5">
        <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin flex-shrink-0" />
        <span className="text-xs text-brand-600 dark:text-brand-300 font-medium">
          Searching campus listings…
        </span>
        <div className="flex gap-0.5 items-center">
          {[0, 120, 240].map((d) => (
            <div
              key={d}
              className="w-1 h-1 bg-brand-400 rounded-full animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatPage({
  profile, userId, sessionId, activeGigs, matches, totalEscrow,
  onOpenSettings, onSaveGig, onSaveMatches, onUpdateMatchDecision, onReleaseEscrow, onFinishAndPay, onContractorMarkComplete, onPersistMessage,
}: Props) {
  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-gigs'>('browse');
  const [isListening, setIsListening] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const dismissItem = (id: string) => {
    setDismissedItems((prev) => new Set([...prev, id]));
  };

  const { entries, isThinking, handleUserMessage, handleAcceptMatch, handleDeclineMatch, handleReleaseEscrow, handleFinishAndPay } = useMiloChat({
    profile, userId, sessionId, matches, onSaveGig, onSaveMatches, onUpdateMatchDecision, onReleaseEscrow, onFinishAndPay, onPersistMessage,
  });

  // Subscribe to demoStore so MatchCard can react to contractor decisions.
  const [demoExtras, setDemoExtras] = useState(() => getDemoState().matchExtras);
  useEffect(() => subscribeDemoStore((s) => setDemoExtras(s.matchExtras)), []);

  const heldMatch = matches.find((m) => m.decision === 'accepted' && m.escrow_status === 'held');
  const completionMatch = heldMatch && demoExtras?.[heldMatch.id]?.contractor_decision === 'completed' ? heldMatch : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries, isThinking]);

  const submit = () => {
    const val = input.trim();
    if (!val) return;
    setInput('');
    void handleUserMessage(val);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const pendingMatches = matches.filter((m) => m.decision === null && m.escrow_status === 'pending');
  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex gap-1.5 mb-2">
              {(['browse', 'my-gigs'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}>
                  {tab === 'browse' ? 'Browse' : 'My Gigs'}
                </button>
              ))}
            </div>
            {totalEscrow > 0 && (
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Escrow: ${totalEscrow.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeTab === 'browse' ? (
              <>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Available</h3>
                {activeGigs.filter((g) => g.type === 'post' && g.status === 'open').length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No gigs available. Ask Milo!</p>
                ) : (
                  activeGigs.filter((g) => g.type === 'post' && g.status === 'open' && !dismissedItems.has(g.id)).slice(0, 5).map((gig) => (
                    <div key={gig.id} className="p-2.5 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 card-hover relative group">
                      <button
                        onClick={() => dismissItem(gig.id)}
                        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-xs text-gray-900 dark:text-white font-medium truncate pr-4">{gig.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{gig.category}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><DollarSign className="w-2.5 h-2.5 text-brand-500" />${gig.pay_min}-${gig.pay_max}</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><MapPin className="w-2.5 h-2.5 text-gray-400" />{gig.campus_location || 'Campus'}</span>
                      </div>
                    </div>
                  ))
                )}
                {pendingMatches.filter((m) => !dismissedItems.has(m.id)).length > 0 && (
                  <>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Pending</h3>
                    {pendingMatches.filter((m) => !dismissedItems.has(m.id)).map((m) => (
                      <div key={m.id} className="p-2.5 bg-amber-50 dark:bg-amber-500/5 rounded-lg border border-amber-200 dark:border-amber-500/20 relative group">
                        <button
                          onClick={() => dismissItem(m.id)}
                          className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-900 dark:text-white font-medium">{m.matched_user_name}</span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{m.match_score}%</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Your Gigs</h3>
                {activeGigs.length === 0 ? (
                  <p className="text-xs text-gray-400">No active gigs. Tell Milo what you need!</p>
                ) : (
                  activeGigs.slice(0, 10).map((gig) => (
                    <div key={gig.id} className="p-2.5 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${gig.status === 'open' ? 'bg-gray-300 dark:bg-gray-600' : gig.status === 'matched' ? 'bg-brand-500' : gig.status === 'in_progress' ? 'bg-cyan-500' : 'bg-blue-500'}`} />
                        <span className="text-[10px] text-gray-400 capitalize">{gig.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-gray-900 dark:text-white font-medium truncate">{gig.title}</p>
                    </div>
                  ))
                )}
                {acceptedMatches.length > 0 && (
                  <>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Accepted</h3>
                    {acceptedMatches.map((m) => (
                      <div key={m.id} className="p-2.5 bg-brand-50 dark:bg-brand-500/5 rounded-lg border border-brand-200 dark:border-brand-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-900 dark:text-white font-medium">{m.matched_user_name}</span>
                          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">{m.escrow_status}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              <Menu className="w-4 h-4 text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-gray-900 dark:text-white">Milo</h2>
                <p className="text-[10px] text-brand-500 font-medium">Agentic Concierge</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-md">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">AI</span>
            </span>
            <button onClick={onOpenSettings} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              <Settings className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 bg-white dark:bg-gray-950">
          {completionMatch && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-600/40 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-100 mb-3">
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold">Order is ready to complete</div>
                <div className="text-xs text-emerald-700 dark:text-emerald-200">
                  {completionMatch.matched_user_name} marked the work complete. Approve payment to release escrow and finish the gig.
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleFinishAndPay(completionMatch.id, matches)}
                    className="w-full sm:w-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    COMPLETE ORDER & PAY ${completionMatch.pay_max.toFixed(2)}
                  </button>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-200 sm:pt-1">
                    Or reply <span className="font-semibold">COMPLETE ORDER</span> in chat.
                  </div>
                </div>
              </div>
            </div>
          )}
          {!completionMatch && heldMatch && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100 mb-3">
              <div className="text-sm font-semibold">Escrow is held for an active gig</div>
              <div className="text-[10px] mt-1 text-amber-700 dark:text-amber-200">
                If the worker has finished, reply <span className="font-semibold">COMPLETE ORDER</span> to release payment.
              </div>
            </div>
          )}

          {entries.map((entry) => {
            const isAgent = entry.role === 'agent';

            // ── Telemetry / searching animation ───────────────────────────────
            if (entry.type === 'telemetry') {
              return <SearchingAnimation key={entry.id} />;
            }

            // ── System cards: full-width match grid ───────────────────────────
            if (entry.role === 'system_cards' && entry.matches && entry.matches.length > 0) {
              return (
                <div key={entry.id} className="space-y-3">
                  <div className="px-3 py-2 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-2xl">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Match results</p>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      I found {entry.matches.length} candidate{entry.matches.length !== 1 ? 's' : ''} that match your request. Review and select the worker you'd like to hire.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {entry.matches.map((m) => {
                      const acceptedInThisEntry = entry.matches!.some((em) => em.decision === 'accepted');
                      const isAcceptedMatch = m.decision === 'accepted';
                      const gigLocked = acceptedInThisEntry && !isAcceptedMatch;
                      const contractorDecision = demoExtras?.[m.id]?.contractor_decision ?? 'pending';
                      const scheduledFor = demoExtras?.[m.id]?.scheduled_for ?? null;
                      return (
                        <MatchCard
                          key={m.id}
                          match={m}
                          gigLocked={gigLocked}
                          chosenWorker={isAcceptedMatch}
                          contractorDecision={contractorDecision}
                          scheduledFor={scheduledFor}
                          onAccept={(id) => void handleAcceptMatch(id, entry.matches!)}
                          onDecline={(id) => void handleDeclineMatch(id)}
                          onReleaseEscrow={(id) => void handleReleaseEscrow(id, entry.matches!)}
                          onFinishAndPay={(id) => void handleFinishAndPay(id, entry.matches!)}
                          onMarkComplete={(id) => void onContractorMarkComplete(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // ── Inline match_cards (agent bubble style) ───────────────────────
            if (entry.type === 'match_cards' && entry.matches && entry.matches.length > 0) {
              return (
                <div key={entry.id} className="flex gap-2">
                  <div className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 max-w-[92%] space-y-2">
                    <p className="text-[10px] text-gray-400 font-bold">
                      {entry.matches.length} match{entry.matches.length !== 1 ? 'es' : ''} found
                    </p>
                    {entry.matches.map((m) => {
                      const acceptedInThisEntry = entry.matches!.some((em) => em.decision === 'accepted');
                      const isAcceptedMatch = m.decision === 'accepted';
                      const gigLocked = acceptedInThisEntry && !isAcceptedMatch;
                      const contractorDecision = demoExtras?.[m.id]?.contractor_decision ?? 'pending';
                      const scheduledFor = demoExtras?.[m.id]?.scheduled_for ?? null;
                      return (
                        <MatchCard
                          key={m.id}
                          match={m}
                          gigLocked={gigLocked}
                          chosenWorker={isAcceptedMatch}
                          contractorDecision={contractorDecision}
                          scheduledFor={scheduledFor}
                          onAccept={(id) => void handleAcceptMatch(id, entry.matches!)}
                          onDecline={(id) => void handleDeclineMatch(id)}
                          onReleaseEscrow={(id) => void handleReleaseEscrow(id, entry.matches!)}
                          onFinishAndPay={(id) => void handleFinishAndPay(id, entry.matches!)}
                          onMarkComplete={(id) => void onContractorMarkComplete(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // ── Standard text / status / error bubble ─────────────────────────
            return (
              <div key={entry.id} className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${isAgent ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  {isAgent ? <Bot className="w-3 h-3 text-white" /> : <User className="w-3 h-3 text-gray-500 dark:text-gray-300" />}
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    isAgent
                      ? entry.type === 'error'
                        ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 rounded-tl-sm'
                        : entry.type === 'status'
                        ? 'bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 text-brand-700 dark:text-brand-300 rounded-tl-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-tl-sm'
                      : 'bg-brand-500 text-white rounded-tr-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
                />
              </div>
            );
          })}

          {/* Generic thinking dots (shown while API call is in flight and telemetry not yet in list) */}
          {isThinking && !entries.some((e) => e.type === 'telemetry') && (
            <div className="flex gap-2">
              <div className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-white" />
              </div>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl rounded-tl-sm">
                <div className="flex gap-1 items-center h-3">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex gap-1.5 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message Milo..."
                rows={1}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none focus:outline-none transition-all"
                style={{ minHeight: '42px', maxHeight: '100px' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
                }}
              />
            </div>
            <button
              onClick={toggleVoice}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={isListening ? 'Stop' : 'Voice'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={submit}
              disabled={!input.trim() || isThinking}
              className="w-9 h-9 flex items-center justify-center bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white disabled:text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
