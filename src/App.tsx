import { useState } from 'react';
import { Sparkles, LogOut, Settings, Wallet, Briefcase, Bell, MessageSquare, Plus, HardHat, Sun, Moon, Users } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ChatPage } from './components/ChatPage';
import { SettingsPage } from './components/SettingsPage';
import { GigsPage } from './components/GigsPage';
import { WalletPage } from './components/WalletPage';
import { NotificationsPanel } from './components/NotificationsPanel';
import { ContractorPortal } from './components/ContractorPortal';
import { DevLoginPanel } from './components/DevLoginPanel';
import { DemoProfileDashboard } from './components/DemoProfileDashboard';
import { useAppState } from './hooks/useAppState';
import { useTheme } from './lib/theme';
import type { Gig } from './lib/supabase';

type Page = 'onboarding' | 'chat' | 'settings' | 'gigs' | 'wallet' | 'contractor';

function App() {
  const [page, setPage] = useState<Page>('chat');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const {
    userId, session, authLoading, profile, activeGigs, allOpenGigs, matches, sessions,
    currentSessionId, wallet, transactions, notifications, applications, loading,
    totalEscrow, unreadCount, devMode, impersonatedProfileIdx,
    signUp, signIn, signOut, saveProfile,
    createSession, deleteSession, switchSession, addMessage,
    saveGig, saveMatches, updateMatchDecision, releaseEscrow,
    depositFunds, applyToGig,
    markGigComplete, approvePayment, requestRedo,
    markNotificationRead, markAllNotificationsRead,
    devLogin, devSwitchBack,
    contractorAccept, contractorDecline, contractorMarkComplete, finishAndPayMatch,
  } = useAppState();

  const handleSignUp = async (email: string, password: string, name: string) => {
    const result = await signUp(email, password, name);
    if (result.error) return { error: result.error.message };
    return { error: null };
  };
  const handleSignIn = async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.error) return { error: result.error.message };
    return { error: null };
  };
  const handleSaveGig = async (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => {
    return saveGig(gig);
  };

  const handleApprovePaymentNotification = async (gigId: string) => {
    const match = matches.find((m) => m.gig_id === gigId && m.decision === 'accepted' && m.escrow_status === 'held');
    if (match) {
      await finishAndPayMatch(match.id);
    }
  };

  const handleRequestRedoNotification = async (gigId: string) => {
    const match = matches.find((m) => m.gig_id === gigId && m.decision === 'accepted' && m.escrow_status === 'held');
    if (match) {
      await requestRedo(gigId, match.id);
    }
  };

  const navigateTo = (p: Page) => {
    setPage(p);
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center animate-pulse">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onSignUp={handleSignUp} onSignIn={handleSignIn} />;
  }

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // When impersonating a demo profile, hijack the entire view to show that profile's dashboard.
  // The original user's Supabase session is still active so the contractor actions can mutate
  // their gigs/matches/wallet on behalf of the demo profile.
  if (impersonatedProfileIdx != null) {
    return (
      <DemoProfileDashboard
        profileIdx={impersonatedProfileIdx}
        matches={matches}
        posterProfile={profile}
        onBack={() => { void devSwitchBack(); }}
        onAccept={contractorAccept}
        onDecline={contractorDecline}
        onMarkComplete={contractorMarkComplete}
      />
    );
  }

  if (!profile?.onboarding_complete || page === 'onboarding') {
    return (
      <OnboardingWizard
        onComplete={async (data) => {
          await saveProfile({ ...data, onboarding_complete: true });
          await createSession('Welcome Chat');
          setPage('chat');
        }}
      />
    );
  }

  if (page === 'settings') {
    return <SettingsPage profile={profile} onSave={async (data) => { await saveProfile(data); }} onBack={() => setPage('chat')} />;
  }
  if (page === 'gigs') {
    return <GigsPage profile={profile} allOpenGigs={allOpenGigs} applications={applications} onApplyToGig={applyToGig} onBack={() => setPage('chat')} />;
  }
  if (page === 'wallet') {
    return <WalletPage wallet={wallet} transactions={transactions} totalEscrow={totalEscrow} onDeposit={depositFunds} onBack={() => setPage('chat')} />;
  }
  if (page === 'contractor') {
    return (
      <ContractorPortal
        profile={profile} activeGigs={activeGigs} matches={matches} wallet={wallet}
        notifications={notifications}
        onMarkComplete={markGigComplete} onApprovePayment={approvePayment}
        onRequestRedo={requestRedo} onBack={() => setPage('chat')}
      />
    );
  }

  // Chat page (default)
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-none">Milo</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">Campus Gig Marketplace</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Toggle theme">
              {theme === 'light' ? <Moon className="w-4 h-4 text-gray-500" /> : <Sun className="w-4 h-4 text-gray-400" />}
            </button>
            <button onClick={() => setShowNotifications(true)} className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => navigateTo('gigs')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Gigs">
              <Briefcase className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button onClick={() => navigateTo('contractor')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Contractor Portal">
              <HardHat className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button onClick={() => navigateTo('wallet')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Wallet">
              <Wallet className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button onClick={() => navigateTo('settings')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Settings">
              <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button onClick={() => setShowDevPanel(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Dev Profiles">
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            {devMode && (
              <button onClick={devSwitchBack} className="px-2.5 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-lg">
                Switch Back
              </button>
            )}
            <button onClick={signOut} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Sign Out">
              <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>

            {profile && (
              <div className="flex items-center gap-2 ml-1.5 pl-2.5 border-l border-gray-200 dark:border-gray-800">
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-gray-900 dark:text-white font-semibold">{profile.name}</p>
                  <p className="text-[10px] text-gray-400">{profile.role} - {profile.campus_location || 'No location'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Session Bar */}
      <div className="bg-white dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800/50">
        <div className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button onClick={async () => { await createSession(); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-md font-medium whitespace-nowrap flex-shrink-0 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors">
            <Plus className="w-3 h-3" /> New
          </button>
          {sessions.map((s) => (
            <button key={s.id} onClick={() => switchSession(s.id)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md whitespace-nowrap flex-shrink-0 transition-colors ${
                currentSessionId === s.id
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}>
              <MessageSquare className="w-3 h-3" />
              {s.title}
              <span onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="ml-1 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors text-[10px]">x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {currentSessionId ? (
          <ChatPage
            profile={profile} userId={userId!} sessionId={currentSessionId}
            activeGigs={activeGigs} matches={matches} totalEscrow={totalEscrow}
            onOpenSettings={() => navigateTo('settings')}
            onSaveGig={handleSaveGig} onSaveMatches={saveMatches}
            onUpdateMatchDecision={updateMatchDecision} onReleaseEscrow={releaseEscrow}
            onFinishAndPay={finishAndPayMatch}
            onContractorMarkComplete={(matchId) => contractorMarkComplete(matchId, null)}
            onPersistMessage={addMessage}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-400 dark:text-gray-500 text-sm">No active chat</p>
            <button onClick={async () => { await createSession(); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-lg text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Start New Chat
            </button>
          </div>
        )}
      </div>

      {showNotifications && (
        <NotificationsPanel notifications={notifications} unreadCount={unreadCount}
          onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead}
          onApprovePayment={handleApprovePaymentNotification}
          onRequestRedo={handleRequestRedoNotification}
          onClose={() => setShowNotifications(false)} />
      )}
      {showDevPanel && (
        <DevLoginPanel onLogin={devLogin} onClose={() => setShowDevPanel(false)} />
      )}
    </div>
  );
}

export default App;
