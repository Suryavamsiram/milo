import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type UserProfile, type Gig, type GigMatch, type ChatMessage, type ChatSession, type Wallet, type WalletTransaction, type GigApplication, type Notification } from '../lib/supabase';
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
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [applications, setApplications] = useState<GigApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoState, setDemoState] = useState<DemoStoreShape>(() => getDemoState());
  const gigGenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeDemoStore(setDemoState);
  }, []);

  const impersonatedProfileIdx = demoState.impersonatedProfileIdx;
  const impersonatedProfile = impersonatedProfileIdx != null ? MOCK_PROFILES[impersonatedProfileIdx] : null;
  const devMode = impersonatedProfileIdx != null;

  const userId = session?.user?.id ?? null;

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
    if (!userId) {
      setProfile(null); setActiveGigs([]); setAllOpenGigs([]); setMatches([]);
      setMessages([]); setSessions([]); setWallet(null); setTransactions([]);
      setNotifications([]); setApplications([]); setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [profileRes, gigsRes, openGigsRes, matchesRes, messagesRes, sessionsRes, walletRes, txRes, notifsRes, appsRes] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('gigs').select('*').eq('user_id', userId).in('status', ['open', 'matched', 'in_progress']).order('created_at', { ascending: false }),
          supabase.from('gigs').select('*').eq('type', 'post').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
          supabase.from('gig_matches').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(200),
          supabase.from('chat_sessions').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
          supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('wallet_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
          supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
          supabase.from('gig_applications').select('*').or(`applicant_id.eq.${userId}`).order('created_at', { ascending: false }),
        ]);

        if (profileRes.data) setProfile(profileRes.data as UserProfile);
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
        if (walletRes.data) setWallet(walletRes.data as Wallet);
        if (txRes.data) setTransactions(txRes.data as WalletTransaction[]);
        if (notifsRes.data) setNotifications(notifsRes.data as Notification[]);
        if (appsRes.data) setApplications(appsRes.data as GigApplication[]);

        if (!walletRes.data) {
          const { data: newWallet } = await supabase.from('wallets').insert([{ user_id: userId, balance: 0 }]).select().maybeSingle();
          if (newWallet) setWallet(newWallet as Wallet);
        }
      } catch (err) {
        console.warn('Supabase fetch failed, using local state:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

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

  // Periodic sample gig generator (every 5-10 minutes)
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
        const posterIdx = Math.floor(Math.random() * MOCK_PROFILES.length);
        const poster = MOCK_PROFILES[posterIdx];

        const { data: posterProfile } = await supabase.from('user_profiles').select('user_id').ilike('name', poster.name).maybeSingle();
        const posterUserId = posterProfile?.user_id || userId;

        await supabase.from('gigs').insert([{
          user_id: posterUserId,
          type: 'post',
          title: `${cat} Help Needed`,
          content: `Looking for someone skilled in ${cat.toLowerCase()} to help out this week.`,
          category: cat,
          pay_min: payMin,
          pay_max: payMax,
          currency: 'USD',
          campus_location: loc,
          is_remote: Math.random() > 0.7,
          poster_name: poster.name,
          status: 'open',
          escrow_held: false,
          escrow_amount: 0,
          escrow_released: false,
          webhook_payload: null,
          applicant_count: 0,
        }]);

        if (profile.skills_interests.some((s) => s.toLowerCase().includes(cat.toLowerCase().split(' ')[0]))) {
          await supabase.from('notifications').insert([{
            user_id: userId,
            type: 'gig_match',
            title: 'New Gig Available',
            body: `A new ${cat} gig just opened up near ${loc} paying $${payMin}-$${payMax}. Check it out!`,
            reference_id: null,
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
      await supabase.from('user_profiles').insert([{ user_id: data.user.id, name, onboarding_complete: false }]);
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
    const id = `session-${Date.now()}`;
    const { data, error } = await supabase.from('chat_sessions').insert([{ id, user_id: userId, title: title || 'New Chat' }]).select().single();
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
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
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

  const saveGig = useCallback(async (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => {
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

  // FIX: Don't override user_id on every match row — respect what's already set.
  // Also log insert errors instead of silently swallowing them.
  const saveMatches = useCallback(async (gigId: string, incomingMatches: GigMatch[]) => {
    if (!userId) return;
    const rows = incomingMatches.map((m) => ({ ...m, gig_id: m.gig_id || gigId }));
    const { error } = await supabase.from('gig_matches').insert(rows);
    if (error) {
      console.warn('Failed to insert matches:', error);
    }
    setMatches((prev) => [...incomingMatches, ...prev]);
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
          if (wallet && wallet.balance >= match.pay_max) {
            const newBalance = wallet.balance - match.pay_max;
            await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);
            await supabase.from('wallet_transactions').insert([{
              wallet_id: wallet.id,
              user_id: userId,
              type: 'escrow_hold',
              amount: match.pay_max,
              reference_id: match.gig_id,
              description: `Escrow held for ${match.matched_user_name}`,
            }]);
            setWallet((prev) => prev ? { ...prev, balance: newBalance } : prev);
          }
        }
      }
    }
  }, [matches, wallet, userId]);

  const releaseEscrow = useCallback(async (matchId: string) => {
    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
  }, []);

  const depositFunds = useCallback(async (amount: number) => {
    if (!userId || !wallet) return { error: 'No wallet' };
    const newBalance = wallet.balance + amount;
    const { error: walletError } = await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);
    if (walletError) return { error: walletError };
    const { data: tx } = await supabase.from('wallet_transactions').insert([{ wallet_id: wallet.id, user_id: userId, type: 'deposit', amount, description: `Deposited $${amount.toFixed(2)}` }]).select().single();
    setWallet((prev) => prev ? { ...prev, balance: newBalance } : null);
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    return { error: null };
  }, [userId, wallet]);

  const holdEscrow = useCallback(async (amount: number, gigId: string) => {
    if (!userId || !wallet) return { error: 'Insufficient funds' };
    if (wallet.balance < amount) return { error: 'Insufficient balance' };
    const newBalance = wallet.balance - amount;
    await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);
    const { data: tx } = await supabase.from('wallet_transactions').insert([{ wallet_id: wallet.id, user_id: userId, type: 'escrow_hold', amount, reference_id: gigId, description: `Escrow held $${amount.toFixed(2)}` }]).select().single();
    setWallet((prev) => prev ? { ...prev, balance: newBalance } : null);
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    await supabase.from('notifications').insert([{ user_id: userId, type: 'escrow_held', title: 'Escrow Held', body: `$${amount.toFixed(2)} has been held in escrow for your gig.`, reference_id: gigId }]);
    return { error: null };
  }, [userId, wallet]);

  const releaseEscrowPayment = useCallback(async (amount: number, recipientId: string, gigId: string) => {
    if (!userId || !wallet) return { error: 'No wallet' };
    const { data: tx } = await supabase.from('wallet_transactions').insert([{ wallet_id: wallet.id, user_id: userId, type: 'escrow_release', amount, reference_id: gigId, description: `Escrow released $${amount.toFixed(2)}` }]).select().single();
    if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);

    const { data: finderWallet } = await supabase.from('wallets').select('*').eq('user_id', recipientId).maybeSingle();
    if (finderWallet) {
      const fw = finderWallet as Wallet;
      await supabase.from('wallets').update({ balance: fw.balance + amount }).eq('id', fw.id);
      await supabase.from('wallet_transactions').insert([{ wallet_id: fw.id, user_id: recipientId, type: 'payment_received', amount, reference_id: gigId, description: `Payment received $${amount.toFixed(2)}` }]);
      await supabase.from('notifications').insert([{ user_id: recipientId, type: 'payment_received', title: 'Payment Received', body: `You received $${amount.toFixed(2)} for completing a gig.`, reference_id: gigId }]);
    }

    await supabase.from('gigs').update({ status: 'completed', escrow_released: true }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'completed', escrow_released: true } : g));
    await supabase.from('notifications').insert([{ user_id: userId, type: 'gig_completed', title: 'Gig Completed', body: `Your gig has been completed. $${amount.toFixed(2)} released to the finder.`, reference_id: gigId }]);
    return { error: null };
  }, [userId, wallet]);

  const applyToGig = useCallback(async (gig: Gig, msg: string) => {
    if (!userId || !profile) return { error: 'Not authenticated' };
    const { data, error } = await supabase.from('gig_applications').insert([{ gig_id: gig.id, applicant_id: userId, applicant_name: profile.name, applicant_avatar_url: profile.avatar_url, applicant_bio: profile.bio, applicant_skills: profile.skills_interests, applicant_campus_location: profile.campus_location, applicant_latitude: profile.latitude, applicant_longitude: profile.longitude, applicant_availability: profile.availability, message: msg }]).select().single();
    if (!error && data) {
      setApplications((prev) => [data as GigApplication, ...prev]);
      await supabase.from('gigs').update({ applicant_count: gig.applicant_count + 1 }).eq('id', gig.id);
      setAllOpenGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, applicant_count: g.applicant_count + 1 } : g));
      await supabase.from('notifications').insert([{ user_id: gig.user_id, type: 'gig_application', title: 'New Application', body: `${profile.name} applied to your gig: ${gig.title}`, reference_id: gig.id }]);
      return { error: null };
    }
    return { error };
  }, [userId, profile]);

  const acceptApplication = useCallback(async (appId: string, gigId: string, _applicantName: string, amount: number) => {
    await supabase.from('gig_applications').update({ status: 'accepted' }).eq('id', appId);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'accepted' } : a));
    const escrowResult = await holdEscrow(amount, gigId);
    await supabase.from('gigs').update({ status: 'matched', escrow_held: true, escrow_amount: amount }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'matched', escrow_held: true, escrow_amount: amount } : g));
    setAllOpenGigs((prev) => prev.filter((g) => g.id !== gigId));
    const app = applications.find((a) => a.id === appId);
    if (app) {
      await supabase.from('notifications').insert([{ user_id: app.applicant_id, type: 'application_accepted', title: 'Application Accepted', body: `Your application for the gig has been accepted! $${amount.toFixed(2)} is in escrow.`, reference_id: gigId }]);
    }
    return escrowResult;
  }, [applications, holdEscrow]);

  const rejectApplication = useCallback(async (appId: string) => {
    await supabase.from('gig_applications').update({ status: 'rejected' }).eq('id', appId);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'rejected' } : a));
    const app = applications.find((a) => a.id === appId);
    if (app) {
      await supabase.from('notifications').insert([{ user_id: app.applicant_id, type: 'application_rejected', title: 'Application Not Selected', body: 'Your application for the gig was not selected this time.', reference_id: app.gig_id }]);
    }
  }, [applications]);

  const markNotificationRead = useCallback(async (notifId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, is_read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [userId]);

  const markGigComplete = useCallback(async (gigId: string, _matchId: string) => {
    if (!userId) return;
    await supabase.from('gigs').update({ status: 'in_progress' }).eq('id', gigId);
    setActiveGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, status: 'in_progress' } : g));
    const gig = activeGigs.find((g) => g.id === gigId);
    if (gig) {
      await supabase.from('notifications').insert([{ user_id: gig.user_id, type: 'gig_completion_pending', title: 'Gig Completion Pending', body: `Contractor marked the gig "${gig.title}" as complete. Please approve payment or request a redo.`, reference_id: gigId }]);
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
      await supabase.from('notifications').insert([{ user_id: match.matched_user_id, type: 'gig_redo', title: 'Redo Requested', body: 'The poster has requested a redo for the gig. Please continue working.', reference_id: gigId }]);
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
    await supabase.from('gigs').update({ status: 'in_progress' }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'in_progress' } : g));
    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'application_accepted',
      title: 'Contractor Accepted',
      body: `${match.matched_user_name} accepted your gig and started the task.`,
      reference_id: match.gig_id,
    }]);
  }, [matches]);

  const contractorDecline = useCallback(async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    setDemoMatchExtras(matchId, { contractor_decision: 'declined' });

    const { data: posterWallet } = await supabase.from('wallets').select('*').eq('user_id', match.user_id).maybeSingle();
    if (posterWallet) {
      const pw = posterWallet as Wallet;
      const newBalance = pw.balance + match.pay_max;
      await supabase.from('wallets').update({ balance: newBalance }).eq('id', pw.id);
      await supabase.from('wallet_transactions').insert([{
        wallet_id: pw.id,
        user_id: match.user_id,
        type: 'escrow_refund',
        amount: match.pay_max,
        reference_id: match.gig_id,
        description: `Refund: ${match.matched_user_name} declined the gig`,
      }]);
      if (userId === match.user_id) {
        setWallet((prev) => prev ? { ...prev, balance: newBalance } : prev);
      }
    }

    await supabase.from('gig_matches').update({ decision: 'rejected', escrow_status: 'pending' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, decision: 'rejected', escrow_status: 'pending' } : m));
    await supabase.from('gigs').update({ status: 'open', escrow_held: false, escrow_amount: 0 }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'open', escrow_held: false, escrow_amount: 0 } : g));

    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'escrow_refund',
      title: 'Match Declined - Escrow Refunded',
      body: `${match.matched_user_name} declined the gig. $${match.pay_max.toFixed(2)} was refunded to your wallet.`,
      reference_id: match.gig_id,
    }]);
  }, [matches, userId]);

  const contractorMarkComplete = useCallback(async (matchId: string, scheduledFor: string | null) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    setDemoMatchExtras(matchId, {
      contractor_decision: 'completed',
      scheduled_for: scheduledFor,
      completed_at: new Date().toISOString(),
    });
    await supabase.from('notifications').insert([{
      user_id: match.user_id,
      type: 'gig_completion_pending',
      title: 'Gig Marked Complete',
      body: `${match.matched_user_name} marked "${match.title}" as complete. Approve payment from your match to release escrow.`,
      reference_id: match.gig_id,
    }]);
  }, [matches]);

  // FIX: finishAndPayMatch now properly credits the worker's wallet with
  // a payment_received transaction, instead of only logging escrow_release
  // (which was displayed as a deduction).
  const finishAndPayMatch = useCallback(async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !wallet) return;

    // Credit the demo (mock) profile's wallet locally
    adjustDemoWallet(match.matched_user_name, match.pay_max);

    // Mark match released, gig completed
    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
    await supabase.from('gigs').update({ status: 'completed', escrow_released: true }).eq('id', match.gig_id);
    setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'completed', escrow_released: true } : g));

    // If the current user is the poster, log escrow_release (informational — balance already reflects hold)
    if (match.user_id === userId) {
      const { data: tx } = await supabase.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        user_id: userId,
        type: 'escrow_release',
        amount: match.pay_max,
        reference_id: match.gig_id,
        description: `Paid ${match.matched_user_name} for ${match.title}`,
      }]).select().single();
      if (tx) setTransactions((prev) => [tx as WalletTransaction, ...prev]);
    }

    // Credit the worker's wallet. Mock profiles are handled by adjustDemoWallet.
    // Real users get their wallet credited with a payment_received transaction.
    const matchedUserIsMock = match.matched_user_id.startsWith('mock-');
    if (!matchedUserIsMock && match.matched_user_id === userId) {
      // Current user is the worker who earned this money
      const earnedAmount = match.pay_max;
      const newBalance = wallet.balance + earnedAmount;
      await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);
      const { data: earnedTx } = await supabase.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        user_id: userId,
        type: 'payment_received',
        amount: earnedAmount,
        reference_id: match.gig_id,
        description: `Earned $${earnedAmount.toFixed(2)} from ${match.title}`,
      }]).select().single();
      setWallet((prev) => prev ? { ...prev, balance: newBalance } : prev);
      if (earnedTx) setTransactions((prev) => [earnedTx as WalletTransaction, ...prev]);
    } else if (!matchedUserIsMock) {
      // The worker is another real user — credit their wallet
      const { data: workerWallet } = await supabase.from('wallets').select('*').eq('user_id', match.matched_user_id).maybeSingle();
      if (workerWallet) {
        const ww = workerWallet as Wallet;
        const newBalance = ww.balance + match.pay_max;
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', ww.id);
        await supabase.from('wallet_transactions').insert([{
          wallet_id: ww.id,
          user_id: match.matched_user_id,
          type: 'payment_received',
          amount: match.pay_max,
          reference_id: match.gig_id,
          description: `Earned $${match.pay_max.toFixed(2)} from ${match.title}`,
        }]);
        await supabase.from('notifications').insert([{
          user_id: match.matched_user_id,
          type: 'payment_received',
          title: 'Payment Received',
          body: `You earned $${match.pay_max.toFixed(2)} for completing "${match.title}".`,
          reference_id: match.gig_id,
        }]);
      }
    }

    setDemoMatchExtras(matchId, { contractor_decision: 'paid' });
  }, [matches, wallet, userId]);

  const totalEscrow = activeGigs.reduce((sum, g) => sum + (g.escrow_held && !g.escrow_released ? g.escrow_amount : 0), 0);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    userId, session, authLoading, profile, activeGigs, allOpenGigs, matches, messages,
    sessions, currentSessionId, wallet, transactions, notifications, applications,
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
