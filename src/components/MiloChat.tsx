import { useRef, useEffect, useState } from 'react';
import { Send, Bot, User, Zap } from 'lucide-react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import { useMiloChat } from '../hooks/useMiloChat';
import { TelemetryCard } from './TelemetryCard';
import { MatchCard } from './MatchCard';

type Props = {
  profile: UserProfile;
  userId: string;
  sessionId: string;
  matches: GigMatch[];
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onFinishAndPay: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

export function MiloChat({
  profile,
  userId,
  sessionId,
  matches,
  onSaveGig,
  onSaveMatches,
  onUpdateMatchDecision,
  onReleaseEscrow,
  onFinishAndPay,
  onPersistMessage,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const matchesRef = useRef<Record<string, GigMatch[]>>({});

  const {
    entries,
    isThinking,
    handleUserMessage,
    handleAcceptMatch,
    handleDeclineMatch,
    handleReleaseEscrow,
  } = useMiloChat({
    profile,
    userId,
    sessionId,
    matches,
    onSaveGig,
    onSaveMatches,
    onUpdateMatchDecision,
    onReleaseEscrow,
    onFinishAndPay,
    onPersistMessage,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isThinking]);

  // Track matches per entry so accept/decline works on stale closures
  useEffect(() => {
    for (const entry of entries) {
      if (entry.matches) {
        matchesRef.current[entry.id] = entry.matches;
      }
    }
  }, [entries]);

  const submit = () => {
    const val = input.trim();
    if (!val) return;
    setInput('');
    void handleUserMessage(val);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const QUICK_REPLIES = [
    'Post a gig',
    'Find a gig',
    'I need help moving furniture',
    'Looking for tutoring gigs',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Milo</h2>
            <p className="text-xs text-emerald-400">Your Agentic Concierge · Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-slate-400">AI-Powered</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {entries.map((entry) => {
          const isAgent = entry.role === 'agent';

          if (entry.type === 'telemetry') {
            return (
              <div key={entry.id} className="flex gap-3">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 max-w-[85%]">
                  <TelemetryCard />
                </div>
              </div>
            );
          }

          if (entry.type === 'match_cards' && entry.matches) {
            const entryMatches = entry.matches;
            return (
              <div key={entry.id} className="flex gap-3">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 max-w-[90%] space-y-3">
                  <p className="text-xs text-slate-500 font-medium">
                    {entryMatches.length} match{entryMatches.length !== 1 ? 'es' : ''} found
                  </p>
                  {entryMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      onAccept={(id) => void handleAcceptMatch(id, entryMatches)}
                      onDecline={(id) => void handleDeclineMatch(id)}
                      onReleaseEscrow={(id) => void handleReleaseEscrow(id, entryMatches)}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div
              key={entry.id}
              className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isAgent
                    ? 'bg-gradient-to-br from-cyan-400 to-blue-500'
                    : 'bg-slate-700'
                }`}
              >
                {isAgent ? (
                  <Bot className="w-4 h-4 text-white" />
                ) : (
                  <User className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isAgent
                    ? entry.type === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-tl-sm'
                      : entry.type === 'status'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-tl-sm'
                      : 'bg-slate-800/80 text-slate-200 rounded-tl-sm'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-tr-sm'
                }`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
              />
            </div>
          );
        })}

        {isThinking && (
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-3 bg-slate-800/80 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {entries.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              onClick={() => void handleUserMessage(reply)}
              className="px-3 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-full text-slate-300 hover:text-white transition-all"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800/60">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message Milo..."
              rows={1}
              className="w-full px-4 py-3 pr-4 bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-white placeholder-slate-500 text-sm resize-none focus:outline-none transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={submit}
            disabled={!input.trim() || isThinking}
            className="w-11 h-11 flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none flex-shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
