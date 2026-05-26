import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import type { ConversationPhase } from '../lib/miloAgent';
import { getMiloGreeting } from '../lib/miloAgent';
import { supabase } from '../lib/supabase';
import { MATCH_ENDPOINT, MOCK_PROFILES } from '../lib/webhook';

export type ChatEntry = {
  id: string;
  role: 'user' | 'agent' | 'system_cards';
  content: string;
  type: 'text' | 'telemetry' | 'match_cards' | 'system_cards' | 'status' | 'error';
  matches?: GigMatch[];
  showTelemetry?: boolean;
  timestamp: Date;
};

type UseMiloChatOptions = {
  profile: UserProfile;
  userId: string;
  sessionId: string | null;
  matches: GigMatch[];
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onFinishAndPay: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function makeEntry(
  role: 'user' | 'agent' | 'system_cards',
  content: string,
  type: ChatEntry['type'] = 'text',
  extra?: Partial<ChatEntry>
): ChatEntry {
  return { id: crypto.randomUUID(), role, content, type, timestamp: new Date(), ...extra };
}

function dbMessageToEntry(msg: ChatMessage): ChatEntry {
  const meta = (msg.metadata as Record<string, unknown>) || {};
  let matches: GigMatch[] | undefined;
  if (msg.message_type === 'match_cards' && meta.matches && Array.isArray(meta.matches)) {
    matches = meta.matches as GigMatch[];
  }
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    type: (msg.message_type as ChatEntry['type']) || 'text',
    matches,
    showTelemetry: msg.message_type === 'telemetry' ? true : undefined,
    timestamp: new Date(msg.created_at),
  };
}

/** Normalize a matched_user_id to mock-N format if it corresponds to a mock profile name. */
function normalizeMockUserId(matchedUserName: string, rawMatchedUserId: string): string {
  // If already in mock-N format, return as-is
  if (rawMatchedUserId.startsWith('mock-')) return rawMatchedUserId;
  // Otherwise look up by name
  const mockIdx = MOCK_PROFILES.findIndex((p) =>
    matchedUserName && p.name && matchedUserName.startsWith(p.name)
  );
  if (mockIdx !== -1) return `mock-${mockIdx}`;
  // Not a mock profile — return the original ID
  return rawMatchedUserId;
}

export function useMiloChat({
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
}: UseMiloChatOptions) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [phase, setPhase] = useState<ConversationPhase>('mode_select');
  const [isThinking, setIsThinking] = useState(false);
  const loadedSessionRef = useRef<string | null>(null);

  // Dynamic state that maps the user's intent FOR THIS SPECIFIC CHAT
  const [activeRole, setActiveRole] = useState<'finder' | 'worker'>(
    profile.role === 'both' ? 'worker' : (profile.role as 'finder' | 'worker')
  );

  useEffect(() => {
    if (!sessionId || sessionId === loadedSessionRef.current) return;
    loadedSessionRef.current = sessionId;

    async function loadMessages() {
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          setEntries(data.map((m) => dbMessageToEntry(m as ChatMessage)));
          const last = data[data.length - 1] as ChatMessage;
          if (last.message_type === 'match_cards' || (last.message_type as string) === 'system_cards') {
            setPhase('browsing_matches');
          } else {
            setPhase('mode_select');
          }
        } else {
          setEntries([makeEntry('agent', getMiloGreeting())]);
          setPhase('mode_select');
        }
      } catch (err) {
        setEntries([makeEntry('agent', getMiloGreeting())]);
        setPhase('mode_select');
      }
    }
    loadMessages();
  }, [sessionId]);

  const agentSay = useCallback(
    (content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>) => {
      const entry = makeEntry('agent', content, type, extra);
      setEntries((prev) => [...prev, entry]);

      const metadata: Record<string, unknown> = {};
      if (type === 'match_cards' && extra?.matches) {
        metadata.matches = extra.matches;
      }
      void onPersistMessage({
        role: 'agent',
        content,
        message_type: type === 'match_cards' ? 'match_cards' : type === 'telemetry' ? 'telemetry' : 'text',
        metadata,
        session_id: sessionId,
      });
      return entry;
    },
    [onPersistMessage, sessionId]
  );

  const handleUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const lower = trimmed.toLowerCase();

      if (
        lower.includes('complete order') ||
        lower.includes('approve payment') ||
        lower.includes('finish order') ||
        lower.includes('release payment')
      ) {
        const activeHeldMatch = matches.find(
          (m) => m.decision === 'accepted' && m.escrow_status === 'held'
        );
        if (activeHeldMatch) {
          setIsThinking(true);
          await onFinishAndPay(activeHeldMatch.id);

          if (activeRole === 'worker') {
            agentSay(`Payment processed completely! **$${activeHeldMatch.pay_max}** has arrived safely in your account balance from ${activeHeldMatch.matched_user_name}.`, 'status');
          } else {
            agentSay(`Payment complete! $${activeHeldMatch.pay_max} released out of your escrow holding to ${activeHeldMatch.matched_user_name}.`, 'status');
          }

          setIsThinking(false);
          return;
        }
      }

      setIsThinking(true);
      const userEntry = makeEntry('user', trimmed);

      const historicalMessages = entries
        .filter(
          (e) =>
            (e.type === 'text' || e.type === 'status') &&
            e.content &&
            !e.content.includes('Welcome! I am Milo')
        )
        .map((e) => ({
          role: e.role === 'agent' ? 'assistant' : 'user',
          content: e.content,
        }));

      historicalMessages.push({ role: 'user', content: trimmed });
      setEntries((prev) => [...prev, userEntry]);

      void onPersistMessage({
        role: 'user',
        content: trimmed,
        message_type: 'text',
        metadata: {},
        session_id: sessionId,
      });

      const telemetryId = crypto.randomUUID();
      const telemetryEntry: ChatEntry = {
        id: telemetryId,
        role: 'agent',
        content: '',
        type: 'telemetry',
        timestamp: new Date(),
      };
      setEntries((prev) => [...prev, telemetryEntry]);

      try {
        const payload = {
          session_id: sessionId || 'fallback-session',
          messages: historicalMessages,
          user_profile: {
            user_id: userId,
            role: profile.role || 'both',
            location: profile.campus_location || 'Main Campus',
            max_walk_time_mins: profile.max_walk_time_mins || 15,
            payment_range: {
              min: profile.pay_min ?? 10,
              max: profile.pay_max ?? 50,
            },
            skills_interests: profile.skills_interests || ['tutoring'],
          },
        };

        const response = await fetch(MATCH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Server returned status: ${response.status}`);

        const data = await response.json();
        setEntries((prev) => prev.filter((e) => e.id !== telemetryId));

        // Dynamically shift the transaction role based on what the backend determined
        const actionDirective = data.directive?.action;
        if (actionDirective === 'search_gigs') setActiveRole('worker');
        if (actionDirective === 'post_gig') setActiveRole('finder');

        const serverMessage = data.message || data.milo_response || 'Checking campus listings...';
        agentSay(serverMessage, 'text');

        if (Array.isArray(data.matches) && data.matches.length > 0) {
          // First, create a real gig row in the DB so the FK constraint on gig_matches passes.
          const topMatch = data.matches[0];
          const gigResult = await onSaveGig({
            type: actionDirective === 'search_gigs' ? 'search' : 'post',
            title: topMatch.title || 'Campus Gig',
            content: topMatch.description || `Gig from Milo match session`,
            category: topMatch.category || 'Other',
            pay_min: topMatch.pay_min ?? profile.pay_min ?? 10,
            pay_max: topMatch.pay_max ?? profile.pay_max ?? 50,
            currency: 'USD',
            campus_location: topMatch.campus_location || profile.campus_location || 'Main Campus',
            is_remote: false,
            poster_name: profile.name,
            status: 'open',
            escrow_held: false,
            escrow_amount: 0,
            escrow_released: false,
            webhook_payload: null,
          });

          // Use the real gig ID from the database, or fall back to a UUID if insert failed
          const resolvedGigId = gigResult.data?.id ?? crypto.randomUUID();

          const compiledMatches: GigMatch[] = data.matches.map((m: any) => {
            const normalizedMatchedUserId = normalizeMockUserId(m.matched_user_name || '', m.matched_user_id || '');

            return {
              ...m,
              gig_id: m.gig_id || resolvedGigId,
              matched_user_id: normalizedMatchedUserId,
              // user_id is always the poster/current user — matches are stored under their row
              // so they can query them back and the demo dashboard can find them
              user_id: userId,
              decision: m.decision ?? null,
              escrow_status: m.escrow_status ?? 'pending',
              pay_max: m.pay_max ?? profile.pay_max ?? 50,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });

          await onSaveMatches(resolvedGigId, compiledMatches);

          const systemCardsEntry = makeEntry('system_cards', '', 'system_cards', {
            matches: compiledMatches,
          });
          setEntries((prev) => [...prev, systemCardsEntry]);

          void onPersistMessage({
            role: 'agent',
            content: '',
            message_type: 'match_cards',
            metadata: { matches: compiledMatches },
            session_id: sessionId,
          });

          setPhase('browsing_matches');
        } else {
          setPhase('mode_select');
        }
      } catch (err) {
        setEntries((prev) => prev.filter((e) => e.id !== telemetryId));
        agentSay("I hit a temporary synchronization bottleneck. Let's step back—what can I find for you?", 'error');
        setPhase('mode_select');
      } finally {
        setIsThinking(false);
      }
    },
    [
      entries,
      isThinking,
      profile,
      userId,
      sessionId,
      matches,
      onSaveGig,
      onSaveMatches,
      onPersistMessage,
      agentSay,
      onFinishAndPay,
      activeRole,
    ]
  );

  const handleAcceptMatch = useCallback(
    async (matchId: string, allMatches: GigMatch[]) => {
      await onUpdateMatchDecision(matchId, 'accepted');
      const targetMatch = allMatches.find((m) => m.id === matchId);

      if (activeRole === 'worker') {
        agentSay(
          targetMatch
            ? `Excellent! You accepted the gig from **${targetMatch.matched_user_name}**. They have safely escrowed **$${targetMatch.pay_max}** for you. When you finish the task, type 'Complete Order' here to receive your funds.`
            : 'Gig assignment accepted. Client funds are initialized in escrow holding.',
          'status'
        );
      } else {
        agentSay(
          targetMatch
            ? `You accepted the match. **$${targetMatch.pay_max}** is initialized in escrow out of your profile balance. Once work concludes, type 'Complete Order' to release the payment to ${targetMatch.matched_user_name}.`
            : 'Match confirmed. Escrow status transformed to held.',
          'status'
        );
      }
    },
    [activeRole, onUpdateMatchDecision, agentSay]
  );

  const handleDeclineMatch = useCallback(
    async (matchId: string) => {
      await onUpdateMatchDecision(matchId, 'rejected');
    },
    [onUpdateMatchDecision]
  );

  const handleReleaseEscrow = useCallback(
    async (matchId: string, allMatches: GigMatch[]) => {
      await onReleaseEscrow(matchId);
      const targetMatch = allMatches.find((m) => m.id === matchId);

      if (activeRole === 'worker') {
        agentSay(targetMatch ? `Funds released! **$${targetMatch.pay_max}** has been deposited to your account.` : 'Escrow contract settled successfully.', 'status');
      } else {
        agentSay(targetMatch ? `Escrow securely dispatched: $${targetMatch.pay_max} transferred to ${targetMatch.matched_user_name}.` : 'Escrow contract successfully paid.', 'status');
      }
    },
    [activeRole, onReleaseEscrow, agentSay]
  );

  const handleFinishAndPay = useCallback(
    async (matchId: string, allMatches: GigMatch[]) => {
      await onFinishAndPay(matchId);
      const targetMatch = allMatches.find((m) => m.id === matchId);

      if (activeRole === 'worker') {
        agentSay(
          targetMatch
            ? `Transaction completed. **$${targetMatch.pay_max}** was released out of holding directly into your profile balance from ${targetMatch.matched_user_name}!`
            : 'Payment cleared. Order finalized!',
          'status'
        );
      } else {
        agentSay(
          targetMatch
            ? `Transaction completed. **$${targetMatch.pay_max}** was released directly out of holding to ${targetMatch.matched_user_name}.`
            : 'Payment cleared. Order finalized!',
          'status'
        );
      }
    },
    [activeRole, onFinishAndPay, agentSay]
  );

  return {
    entries,
    phase,
    isThinking,
    handleUserMessage,
    handleAcceptMatch,
    handleDeclineMatch,
    handleReleaseEscrow,
    handleFinishAndPay,
  };
}
