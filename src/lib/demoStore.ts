// Client-side overlay state for impersonated demo profiles.
// Lives in localStorage so the original user and impersonated profile
// (which share the same browser tab) both see updates.

export type ContractorDecision = 'pending' | 'accepted' | 'declined' | 'completed' | 'paid';

export type MatchExtras = {
  contractor_decision: ContractorDecision;
  scheduled_for: string | null;
  accepted_at: string | null;
  completed_at: string | null;
};

export type DemoStoreShape = {
  matchExtras: Record<string, MatchExtras>;
  demoWallets: Record<string, number>;
  impersonatedProfileIdx: number | null;
};

const STORAGE_KEY = 'milo-demo-store-v1';

const DEFAULT_STATE: DemoStoreShape = {
  matchExtras: {},
  demoWallets: {},
  impersonatedProfileIdx: null,
};

function readStore(): DemoStoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<DemoStoreShape>;
    return {
      matchExtras: parsed.matchExtras ?? {},
      demoWallets: parsed.demoWallets ?? {},
      impersonatedProfileIdx: parsed.impersonatedProfileIdx ?? null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeStore(state: DemoStoreShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const listeners = new Set<(state: DemoStoreShape) => void>();
let currentState = readStore();

function broadcast() {
  for (const l of listeners) l(currentState);
}

export function getDemoState(): DemoStoreShape {
  return currentState;
}

export function subscribeDemoStore(listener: (state: DemoStoreShape) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function updateState(updater: (prev: DemoStoreShape) => DemoStoreShape) {
  currentState = updater(currentState);
  writeStore(currentState);
  broadcast();
}

export function setImpersonatedProfileIdx(idx: number | null) {
  updateState((prev) => ({ ...prev, impersonatedProfileIdx: idx }));
}

export function getMatchExtras(matchId: string): MatchExtras {
  return currentState.matchExtras[matchId] ?? {
    contractor_decision: 'pending',
    scheduled_for: null,
    accepted_at: null,
    completed_at: null,
  };
}

export function setMatchExtras(matchId: string, extras: Partial<MatchExtras>) {
  updateState((prev) => ({
    ...prev,
    matchExtras: {
      ...prev.matchExtras,
      [matchId]: { ...getMatchExtras(matchId), ...extras },
    },
  }));
}

export function getDemoWallet(profileName: string): number {
  return currentState.demoWallets[profileName] ?? 0;
}

export function adjustDemoWallet(profileName: string, delta: number) {
  updateState((prev) => ({
    ...prev,
    demoWallets: {
      ...prev.demoWallets,
      [profileName]: (prev.demoWallets[profileName] ?? 0) + delta,
    },
  }));
}

// Set a demo wallet to an absolute amount
export function setDemoWallet(profileName: string, amount: number) {
  updateState((prev) => ({
    ...prev,
    demoWallets: {
      ...prev.demoWallets,
      [profileName]: amount,
    },
  }));
}

// Seed all demo profiles with a fixed starting balance. Importing MOCK_PROFILES so callers
// can just call `seedDemoWallets(100)` during development to populate wallets.
import { MOCK_PROFILES } from './webhook';
export function seedDemoWallets(amount: number) {
  const map: Record<string, number> = {};
  for (const p of MOCK_PROFILES) map[p.name] = amount;
  updateState((prev) => ({ ...prev, demoWallets: { ...prev.demoWallets, ...map } }));
}

// Cross-tab sync (in case dev tools opens a duplicate)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    currentState = readStore();
    broadcast();
  });
}
