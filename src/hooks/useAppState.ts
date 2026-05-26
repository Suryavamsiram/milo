import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type UserProfile, type Gig, type GigMatch, type ChatMessage, type ChatSession, type WalletTransaction, type Notification } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { MOCK_PROFILES } from '../lib/webhook';
import {
  getDemoState,
  subscribeDemoStore,
  setImpersonatedProfileIdx as setDemoImpersonated,
  setMatchExtras as setDemoMatchExtras,
  adjustDemoWallet,
  type DemoStoreShape,
} from '../lib/demoStore';

export function useAppState() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeGigs, setActiveGigs] = useState<Gig[]>([]);
  const [allOpenGigs, setAllOpenGigs] = useState<Gig[]>([]);
  const [matches, setMatches] = useState<GigMatch[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoState, setDemoState] = useState<DemoStoreShape>(() => getDemoState());
  const gigGenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeDemoStore(setDemoState);
  }, []);

  const impersonatedProfileIdx = demoState.impersonatedProfileIdx;
  const impersonatedProfile = impersonatedProfileIdx != null ? MOCK_PROFILES[impersonatedProfileIdx] : null;
  const devMode = impersonatedProfileIdx != null;

  const userId = profile?.user_id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const authUid = session?.user?.id;
    if (!authUid) {
      setProfile(null); setActiveGigs([]); setAllOpenGigs([]); setMatches([]);
      setMessages([]); setSessions([]); setBalance(0); setTransactions([]);
      setNotifications([]); setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        // In this DB, user_profiles.auth_user_id links to auth.users.id
        const { data: profileData } = await supabase.from('user_profiles').select('*').eq('auth_user_id', authUid).maybeSingle();
        if (!profileData) {
          setLoading(false);
          return;
        }
        const p = profileData as UserProfile;
        setProfile(p);
        setBalance(p.balance ?? 0);
        const dbUserId = p.user_id;

        const [gigsRes, openGigsRes, matchesRes, messagesRes, sessionsRes, txRes, notifsRes] = await Promise.all([
          supabase.from('gigs').select('*').eq('user_id', dbUserId).in('status', ['open', 'matched', 'in_progress']).order('created_at', { ascending: false }),
          supabase.from('gigs').select('*').eq('type', 'post').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
          supabase.from('gig_matches').select('*').eq('user_id', dbUserId).order('created_at', { ascending: false }),
          supabase.from('chat_messages').select('*').eq('user_id', dbUserId).order('created_at', { ascending: true }).limit(200),
          supabase.from('chat_sessions').select('*').eq('user_id', dbUserId).eq('is_active', true).order('updated_at', { ascending: false }),
          supabase.from('transactions').select('*').eq('user_id', dbUserId).order('created_at', { ascending: false }).limit(50),
          supabase.from('notifications').select('*').eq('user_id', dbUserId).order('created_at', { ascending: false }).limit(30),
        ]);

        if (gigsRes.data) setActiveGigs(gigsRes.data as Gig[]);
        if (openGigsRes.data) setAllOpenGigs(openGigsRes.data as Gig[]);
        if (matchesRes.data) setMatches(matchesRes.data as GigMatch[]);
        if (messagesRes.data) setMessages(messagesRes.data as ChatMessage[]);
        if (sessionsRes.data) {
          setSessions(sessionsRes.data as ChatSession[]);
          if (sessionsRes.data.length > 0 && !currentSessionId) {
            setCurrentSessionId(sessionsRes.data[0].id);
          }
        }
        if (txRes.data) setTransactions(txRes.data as WalletTransaction[]);
        if (notifsRes.data) setNotifications(notifsRes.data as Notification[]);
      } catch (err) {
        console.warn('Supabase fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session?.user?.id]);

  // Realtime notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  // Periodic sample gig generator
  useEffect(() => {
    if (!userId || !profile) return;
    const scheduleNext = () => {
      const delay = (5 + Math.random() * 5) * 60 * 1000;
      gigGenRef.current = setTimeout(async () => {
        const categories = ['Tech Support', 'Moving & Lifting', 'Tutoring', 'Pet Care', 'Cleaning', 'Culinary Arts', 'Photography', 'Graphic Design', 'Errands', 'Car Maintenance'];
        const locations = ['East Hall', 'North Campus', 'Student Union', 'Library', 'Engineering Quad', 'South Dorms', 'Arts Building', 'West Village'];
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const payMin = Math.floor(Math.random() * 20) + 15;
        const payMax = payMin + Math.floor(Math.random() * 25) + 10;

        await supabase.from('gigs').insert([{
          user_id: userId,
          type: 'post',
          title: `${cat} Help Needed`,
          content: `Looking for someone skilled in ${cat.toLowerCase()} to help out this week.`,
          category: cat,
          pay_min: payMin,
          pay_max: payMax,
          currency: 'USD',
          campus_location: loc,
          is_remote: Math.random() > 0.7,
          poster_name: profile.name,
          status: 'open',
          escrow_held: false,
          escrow_amount: 0,
          escrow_released: false,
        }]);

        if (profile.skills_interests.some((s) => s.toLowerCase().includes(cat.toLowerCase().split(' ')[0]))) {
          await supabase.from('notifications').insert([{
            user_id: userId,
            type: 'gig_match',
            title: 'New Gig Available',
            message: `A new ${cat} gig just opened up near ${loc} paying $${payMin}-$${payMax}. Check it out!`,
          }]);
        }

        const { data: openGigs } = await supabase.from('gigs').select('*').eq('type', 'post').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
        if (openGigs) setAllOpenGigs(openGigs as Gig[]);

        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => { if (gigGenRef.current) clearTimeout(gigGenRef.current); };
  }, [userId, profile]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    if (data.user) {
      await supabase.from('user_profiles').insert([{ auth_user_id: data.user.id, name, onboarding_complete: false, email }]);
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setDemoImpersonated(null);
  }, []);

  const saveProfile = useCallback(async (data: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!userId) return { error: 'Not authenticated' };
    const payload = { ...data, user_id: userId };
    const { data: saved, error } = await supabase.from('user_profiles').upsert([payload], { onConflict: 'user_id' }).select().single();
    if (!error && saved) setProfile(saved as UserProfile);
    return { error };
  }, [userId]);

  const createSession = useCallback(async (title?: string) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const { data, error } = await supabase.from('chat_sessions').insert([{ id, user_id: userId, session_name: title || 'New Chat', is_active: true }]).select().single();
    if (!error && data) {
      const s = data as ChatSession;
      setSessions((prev) => [s, ...prev]);
      setCurrentSessionId(s.id);
      setMessages([]);
      return s;
    }
    return null;
  }, [userId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase.from('chat_messages').delete().eq('session_id', sessionId);
    await supabase.from('chat_sessions').update({ is_active: false }).eq('id', sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]); }
  }, [currentSessionId]);

  const switchSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    const { data } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    if (data) setMessages(data as ChatMessage[]);
  }, []);

  const addMessage = useCallback(async (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => {
    if (!userId) return;
    const optimistic: ChatMessage = { ...msg, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    await supabase.from('chat_messages').insert([{ ...msg, user_id: userId }]);
    if (msg.session_id) {
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', msg.session_id);
    }
  }, [userId]);

  const saveGig = useCallback(async (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'accepted_by_user_id' | 'accepted_by_name' | 'started_at' | 'completed_at' | 'contractor_marked_complete' | 'redeems_requested'>) => {
    if (!userId) return { data: null, error: 'Not authenticated' };
    const { data, error } = await supabase.from('gigs').insert([{ ...gig, user_id: userId }]).select().single();
    if (!error && data) {
      setActiveGigs((prev) => [data as Gig, ...prev]);
      const { data: openGigs } = await supabase.from('gigs').select('*').eq('type', 'post').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
      if (openGigs) setAllOpenGigs(openGigs as Gig[]);
      return { data: data as Gig, error: null };
    }
    return { data: null, error };
  }, [userId]);

  const saveMatches = useCallback(async (gigId: string, incomingMatches: GigMatch[]) => {
    if (!userId) return;
    const rows = incomingMatches.map((m) => ({ ...m, gig_id: m.gig_id || gigId }));
    const { error } = await supabase.from('gig_matches').insert(rows);
    if (error) {
      console.warn('Failed to insert matches:', error);
    }
    setMatches((prev) => [...incomingMatches, ...prev]);
  }, [userId]);

  const updateBalance = useCallback(async (newBalance: number) => {
    if (!userId) return;
    await supabase.from('user_profiles').update({ balance: newBalance }).eq('user_id', userId);
    setBalance(newBalance);
    setProfile((prev) => prev ? { ...prev, balance: newBalance } : prev);
  }, [userId]);

  const updateMatchDecision = useCallback(async (matchId: string, decision: 'accepted' | 'rejected') => {
    await supabase.from('gig_matches').update({ decision, escrow_status: decision === 'accepted' ? 'held' : 'pending' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, decision, escrow_status: decision === 'accepted' ? 'held' : 'pending' } : m));
    if (decision === 'accepted') {
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        await supabase.from('gigs').update({ status: 'matched', escrow_held: true, escrow_amount: match.pay_max }).eq('id', match.gig_id);
        setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'matched', escrow_held: true, escrow_amount: match.pay_max } : g));

        if (match.user_id === userId) {
          const newBal = balance - match.pay_max;
          if (newBal >= 0) {
            await updateBalance(newBal);
            await supabase.from('transactions').insert([{
              user_id: userId,
              type: 'escrow_hold',
              amount: match.pay_max,
              reference_id: match.gig_id,
              reference_type: 'gig',
              description: `Escrow held for ${match.matched_user_name}`,
              status: 'completed',
            }]);
          }
        }
      }
    }
  }, [matches, balance, userId, updateBalance]);

  const releaseEscrow = useCallback(async (matchId: string) => {
    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
  }, []);

  const depositFunds = useCallback(async (amount: number) => {
    if (!userId) return { error: 'No wallet' };
    const newBal = balance + amount;
    await updateBalance(newBal);
    const { data: tx } = await supabase.from('transactions').insert([{
      user_id: userId, type: 'deposit', amount, description: `Deposited $${amount.toFixed(2)}`, status: 'completed', reference_type: 'deposit',
    }]).select().single();
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    return { error: null };
  }, [userId, balance, updateBalance]);

  const holdEscrow = useCallback(async (amount: number, gigId: string) => {
    if (!userId) return { error: 'Insufficient funds' };
    if (balance < amount) return { error: 'Insufficient balance' };
    const newBal = balance - amount;
    await updateBalance(newBal);
    const { data: tx } = await supabase.from('transactions').insert([{
      user_id: userId, type: 'escrow_hold', amount, reference_id: gigId, reference_type: 'gig', description: `Escrow held $${amount.toFixed(2)}`, status: 'completed',
    }]).select().single();
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    await supabase.from('notifications').insert([{ user_id: userId, type: 'escrow_held', title: 'Escrow Held', message: `$${amount.toFixed(2)} has been held in escrow for your gig.` }]);
    return { error: null };
  }, [userId, balance, updateBalance]);

  const releaseEscrowPayment = useCallback(async (amount: number, recipientId: string, gigId: string) => {
    if (!userId) return { error: 'No wallet' };
    const { data: tx } = await supabase.from('transactions').insert([{
      user_id: userId, type: 'escrow_release', amount, reference_id: gigId, reference_type: 'gig', description: `Escrow released $${amount.toFixed(2)}`, status: 'completed',
    }]).select().single();
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);

    const { data: workerProfile } = await supabase.from('user_profiles').select('*').eq('user_id', recipientId).maybeSingle();
    if (workerProfile) {
      const wp = workerProfile as UserProfile;
      const newWorkerBal = (wp.balance ?? 0) + amount;
      await supabase.from('user_profiles').update({ balance: newWorkerBal, total_earned: (wp.total_earned ?? 0) + amount }).eq('user_id', recipientId);
      await supabase.from('transactions').insert([{
        user_id: recipientId, type: 'earning', amount, reference_id: gigId, reference_type: 'gig', description: `Payment received $${amount.toFixed(2)}`, status: 'completed',
      }]);
      await supabase.from('notifications').insert([{ user_id: recipientId, type: 'payment_received', title: 'Payment Received', message: `You received $${amount.toFixed(2)} for completing a gig.` }]);
    }

    await supabase.from('gigs').update({ status: 'completed', escrow_released: true }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'completed', escrow_released: true } : g));
    await supabase.from('notifications').insert([{ user_id: userId, type: 'gig_completed', title: 'Gig Completed', message: `Your gig has been completed. $${amount.toFixed(2)} released to the finder.` }]);
    return { error: null };
  }, [userId]);

  const applyToGig = useCallback(async (_gig: Gig, _msg: string) => {
    return { error: null };
  }, []);

  const acceptApplication = useCallback(async (_appId: string, gigId: string, _applicantName: string, amount: number) => {
    const escrowResult = await holdEscrow(amount, gigId);
    await supabase.from('gigs').update({ status: 'matched', escrow_held: true, escrow_amount: amount }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'matched', escrow_held: true, escrow_amount: amount } : g));
    setAllOpenGigs((prev) => prev.filter((g) => g.id !== gigId));
    return escrowResult;
  }, [holdEscrow]);

  const rejectApplication = useCallback(async (_appId: string) => {}, []);

  const markNotificationRead = useCallback(async (notifId: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  const markGigComplete = useCallback(async (gigId: string, _matchId: string) => {
    if (!userId) return;
    await supabase.from('gigs').update({ contractor_marked_complete: true, status: 'in_progress' }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, contractor_marked_complete: true, status: 'in_progress' } : g));
    const gig = activeGigs.find((g) => g.id === gigId);
    if (gig) {
      await supabase.from('notifications').insert([{ user_id: gig.user_id, type: 'gig_completion_pending', title: 'Gig Completion Pending', message: `Contractor marked the gig "${gig.title}" as complete. Please approve payment or request a redo.` }]);
    }
  }, [userId, activeGigs]);

  const approvePayment = useCallback(async (gigId: string, matchId: string, amount: number, recipientId: string) => {
    if (!userId) return;
    await releaseEscrowPayment(amount, recipientId, gigId);
    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
  }, [userId, releaseEscrowPayment]);

  const requestRedo = useCallback(async (gigId: string, matchId: string) => {
    if (!userId) return;
    await supabase.from('gigs').update({ status: 'matched' }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'matched' } : g));
    const match = matches.find((m) => m.id === matchId);
    if (match) {
      await supabase.from('notifications').insert([{ user_id: match.matched_user_id, type: 'gig_redo', title: 'Redo Requested', message: 'The poster has requested a redo for the gig. Please continue working.' }]);
    }
  }, [userId, matches]);

  const devLogin = useCallback(async (profileIdx: number) => {
    setDemoImpersonated(profileIdx);
    return { error: null };
  }, []);

  const devSwitchBack = useCallback(async () => {
    setDemoImpersonated(null);
  }, []);

  const contractorAccept = useCallback(async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    setDemoMatchExtras(matchId, { contractor_decision: 'accepted', accepted_at: new Date().toISOString() });
    await supabase.from('gig_matches').update({ contractor_accepted: true, contractor_accepted_at: new Date().toISOString() }).eq('id', matchId);
    await supabase.from('gigs').update({ status: 'in_progress', accepted_by_user_id: match.matched_user_id, accepted_by_name: match.matched_user_name, started_at: new Date().toISOString() }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'in_progress' } : g));
    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'application_accepted',
      title: 'Contractor Accepted',
      message: `${match.matched_user_name} accepted your gig and started the task.`,
      data: { gig_id: match.gig_id },
    }]);
  }, [matches]);

  const contractorDecline = useCallback(async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    setDemoMatchExtras(matchId, { contractor_decision: 'declined' });

    const newBal = balance + match.pay_max;
    await updateBalance(newBal);
    await supabase.from('transactions').insert([{
      user_id: userId,
      type: 'refund',
      amount: match.pay_max,
      reference_id: match.gig_id,
      reference_type: 'gig',
      description: `Refund: ${match.matched_user_name} declined the gig`,
      status: 'completed',
    }]);

    await supabase.from('gig_matches').update({ decision: 'rejected', escrow_status: 'pending' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, decision: 'rejected', escrow_status: 'pending' } : m));
    await supabase.from('gigs').update({ status: 'open', escrow_held: false, escrow_amount: 0 }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'open', escrow_held: false, escrow_amount: 0 } : g));

    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'refund',
      title: 'Match Declined - Escrow Refunded',
      message: `${match.matched_user_name} declined the gig. $${match.pay_max.toFixed(2)} was refunded to your wallet.`,
    }]);
  }, [matches, userId, balance, updateBalance]);

  const contractorMarkComplete = useCallback(async (matchId: string, scheduledFor: string | null) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    setDemoMatchExtras(matchId, {
      contractor_decision: 'completed',
      scheduled_for: scheduledFor,
      completed_at: new Date().toISOString(),
    });
    await supabase.from('gigs').update({ contractor_marked_complete: true }).eq('id', match.gig_id);
    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'gig_completion_pending',
      title: 'Gig Marked Complete',
      message: `${match.matched_user_name} marked "${match.title}" as complete. Approve payment from your match to release escrow.`,
      data: { gig_id: match.gig_id },
    }]);
  }, [matches]);

  const finishAndPayMatch = useCallback(async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    adjustDemoWallet(match.matched_user_name, match.pay_max);

    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
    await supabase.from('gigs').update({ status: 'completed', escrow_released: true, completed_at: new Date().toISOString() }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'completed', escrow_released: true } : g));

    if (match.user_id === userId) {
      const { data: tx } = await supabase.from('transactions').insert([{
        user_id: userId,
        type: 'escrow_release',
        amount: match.pay_max,
        reference_id: match.gig_id,
        reference_type: 'gig',
        description: `Paid ${match.matched_user_name} for ${match.title}`,
        status: 'completed',
      }]).select().single();
      if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    }

    const matchedUserIsMock = match.matched_user_id.startsWith('mock-');
    if (!matchedUserIsMock) {
      const { data: workerProfile } = await supabase.from('user_profiles').select('*').eq('user_id', match.matched_user_id).maybeSingle();
      if (workerProfile) {
        const wp = workerProfile as UserProfile;
        const newWorkerBal = (wp.balance ?? 0) + match.pay_max;
        await supabase.from('user_profiles').update({ balance: newWorkerBal, total_earned: (wp.total_earned ?? 0) + match.pay_max }).eq('user_id', match.matched_user_id);
        await supabase.from('transactions').insert([{
          user_id: match.matched_user_id,
          type: 'earning',
          amount: match.pay_max,
          reference_id: match.gig_id,
          reference_type: 'gig',
          description: `Earned $${match.pay_max.toFixed(2)} from ${match.title}`,
          status: 'completed',
        }]);
        await supabase.from('notifications').insert([{
          user_id: match.matched_user_id,
          type: 'payment_received',
          title: 'Payment Received',
          message: `You earned $${match.pay_max.toFixed(2)} for completing "${match.title}".`,
        }]);
        if (match.matched_user_id === userId) {
          setBalance(newWorkerBal);
          setProfile((prev) => prev ? { ...prev, balance: newWorkerBal, total_earned: (prev.total_earned ?? 0) + match.pay_max } : prev);
        }
      }
    }

    setDemoMatchExtras(matchId, { contractor_decision: 'paid' });
  }, [matches, userId]);

  const totalEscrow = activeGigs.reduce((sum, g) => sum + (g.escrow_held && !g.escrow_released ? g.escrow_amount : 0), 0);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Expose wallet-like interface for backward compat in components
  const wallet = userId ? { id: userId, user_id: userId, balance, created_at: '', updated_at: '' } as any : null;

  return {
    userId, session, authLoading, profile, activeGigs, allOpenGigs, matches, messages,
    sessions, currentSessionId, wallet, transactions, notifications, applications: [] as any[],
    loading, totalEscrow, unreadCount, devMode,
    impersonatedProfileIdx, impersonatedProfile, demoState,
    signUp, signIn, signOut, saveProfile,
    createSession, deleteSession, switchSession, setCurrentSessionId,
    addMessage, saveGig, saveMatches, updateMatchDecision, releaseEscrow,
    depositFunds, holdEscrow, releaseEscrowPayment,
    applyToGig, acceptApplication, rejectApplication,
    markGigComplete, approvePayment, requestRedo,
    markNotificationRead, markAllNotificationsRead,
    devLogin, devSwitchBack,
    contractorAccept, contractorDecline, contractorMarkComplete, finishAndPayMatch,
  };
}
