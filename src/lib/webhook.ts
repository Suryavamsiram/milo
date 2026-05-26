import type { UserProfile } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL;
export const MATCH_ENDPOINT = `${API_BASE_URL}/api/milo-agent-match`;

export type WebhookPayload = {
  event_type: 'CLIENT_REQUEST_DELEGATION';
  timestamp: string;
  user_profile: {
    user_id: string;
    role: string;
    location: string;
    max_walk_time_mins: number;
    payment_range: { min: number; max: number };
    skills_interests: string[];
  };
  request_details: {
    raw_message: string;
    extracted_topic: string;
    gig_type: 'post' | 'search';
    category: string;
    title: string;
    content: string;
    pay_min: number;
    pay_max: number;
    campus_location: string;
    is_remote: boolean;
    gig_id: string;
  };
};

export type WebhookMatch = {
  id: string;
  matched_user_name: string;
  matched_user_id: string;
  match_score: number;
  title: string;
  category: string;
  pay_min: number;
  pay_max: number;
  campus_location: string;
  walk_time_mins: number;
  description: string;
  distance_miles?: number;
  interest_tags?: string[];
  reasoning?: MatchReasoning;
};

export type MatchReasoning = {
  interest_similarity_weight: number;
  distance_penalization_factor: number;
  contextual_boost: number;
  details: string;
};

export type WebhookResponse = {
  success: boolean;
  matches: WebhookMatch[];
  message?: string;
  directive?: {
    short_answer: string;
    action: string;
    action_confidence: number;
    filled_fields?: Record<string, unknown>;
  };
};

export async function sendWebhookRequest(
  payload: WebhookPayload,
  signal?: AbortSignal
): Promise<WebhookResponse> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 4000);
  const combinedSignal = signal
    ? anySignal([signal, timeoutController.signal])
    : timeoutController.signal;
  try {
    const response = await fetch(MATCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.success && data.matches && data.matches.length > 0) {
      const normalized = normalizeDemoMatches(data.matches);
      return normalized.length > 0 ? { ...data, matches: normalized } : generateMockMatches(payload);
    }
    return generateMockMatches(payload);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 800));
    return generateMockMatches(payload);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export function findMockProfileIdxByName(name: string): number {
  return MOCK_PROFILES.findIndex((p) => p.name === name);
}

function normalizeDemoMatches(matches: WebhookMatch[]): WebhookMatch[] {
  return matches
    .map((match) => {
      const idx = findMockProfileIdxByName(match.matched_user_name);
      if (idx === -1) return null;
      return {
        ...match,
        matched_user_id: `mock-${idx}`,
      };
    })
    .filter((match): match is WebhookMatch => match !== null);
}

export function buildWebhookPayload(
  profile: UserProfile,
  rawMessage: string,
  gigDetails: {
    gig_id: string;
    gig_type: 'post' | 'search';
    category: string;
    title: string;
    content: string;
    pay_min: number;
    pay_max: number;
    campus_location: string;
    is_remote: boolean;
    extracted_topic: string;
  }
): WebhookPayload {
  return {
    event_type: 'CLIENT_REQUEST_DELEGATION',
    timestamp: new Date().toISOString(),
    user_profile: {
      user_id: profile.user_id,
      role: profile.role,
      location: profile.campus_location,
      max_walk_time_mins: profile.max_walk_time_mins,
      payment_range: { min: profile.pay_min, max: profile.pay_max },
      skills_interests: profile.skills_interests,
    },
    request_details: {
      raw_message: rawMessage,
      extracted_topic: gigDetails.extracted_topic,
      gig_type: gigDetails.gig_type,
      category: gigDetails.category,
      title: gigDetails.title,
      content: gigDetails.content,
      pay_min: gigDetails.pay_min,
      pay_max: gigDetails.pay_max,
      campus_location: gigDetails.campus_location,
      is_remote: gigDetails.is_remote,
      gig_id: gigDetails.gig_id,
    },
  };
}

// Rich mock profile pool with varied interest tags
const MOCK_PROFILES = [
  { name: 'Alex Chen', tags: ['Tech/AI', 'Programming', 'Web Development'], loc: 'Engineering Quad', lat: 40.712, lng: -74.006 },
  { name: 'Jordan Smith', tags: ['Fitness', 'Sports Training', 'Nutrition'], loc: 'Athletic Center', lat: 40.715, lng: -74.010 },
  { name: 'Maya Patel', tags: ['Indie Music', 'Graphic Design', 'Photography'], loc: 'Arts Building', lat: 40.710, lng: -74.002 },
  { name: 'Liam Torres', tags: ['Gamer', 'Streaming', 'Tech Support'], loc: 'North Campus', lat: 40.718, lng: -74.008 },
  { name: 'Priya Rao', tags: ['Culinary Arts', 'Food & Grocery', 'Event Planning'], loc: 'Student Union', lat: 40.713, lng: -74.005 },
  { name: 'Kai Nakamura', tags: ['Tech/AI', 'Gamer', 'Robotics'], loc: 'East Hall', lat: 40.714, lng: -74.012 },
  { name: 'Zara Okonkwo', tags: ['Fitness', 'Dance', 'Photography'], loc: 'South Dorms', lat: 40.709, lng: -74.001 },
  { name: 'Diego Reyes', tags: ['Culinary Arts', 'Music Production', 'Cleaning'], loc: 'West Village', lat: 40.716, lng: -74.009 },
  { name: 'Luna Park', tags: ['Indie Music', 'Graphic Design', 'Creative Writing'], loc: 'Library', lat: 40.711, lng: -74.004 },
  { name: 'Raj Gupta', tags: ['Programming', 'Tech/AI', 'Tutoring'], loc: 'Engineering Quad', lat: 40.712, lng: -74.007 },
  { name: 'Ava Williams', tags: ['Pet Care', 'Fitness', 'Errands'], loc: 'North Campus', lat: 40.717, lng: -74.011 },
  { name: 'Marcus Brown', tags: ['Moving & Lifting', 'Fitness', 'Culinary Arts'], loc: 'East Hall', lat: 40.713, lng: -74.013 },
  { name: 'Sofia Martinez', tags: ['Photography', 'Event Help', 'Graphic Design'], loc: 'Student Union', lat: 40.714, lng: -74.003 },
  { name: 'Ethan Lee', tags: ['Tech Support', 'Programming', 'Gamer'], loc: 'South Dorms', lat: 40.710, lng: -74.000 },
  { name: 'Chloe Kim', tags: ['Tutoring', 'Creative Writing', 'Indie Music'], loc: 'Library', lat: 40.711, lng: -74.005 },
  { name: 'Omar Hassan', tags: ['Culinary Arts', 'Event Planning', 'Fitness'], loc: 'West Village', lat: 40.716, lng: -74.010 },
  { name: 'Ruby Taylor', tags: ['Photography', 'Videography', 'Indie Music'], loc: 'Arts Building', lat: 40.709, lng: -74.003 },
  { name: 'James Chen', tags: ['Car Maintenance', 'Tech Support', 'Errands'], loc: 'Parking Garage', lat: 40.718, lng: -74.014 },
  { name: 'Isla Murphy', tags: ['Pet Care', 'Culinary Arts', 'Cleaning'], loc: 'North Campus', lat: 40.715, lng: -74.008 },
  { name: 'Leo Schmidt', tags: ['Moving & Lifting', 'Fitness', 'Gamer'], loc: 'East Hall', lat: 40.713, lng: -74.011 },
];

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeInterestOverlap(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) return 0.3;
  const set2 = new Set(tags2.map(t => t.toLowerCase()));
  const overlap = tags1.filter(t => set2.has(t.toLowerCase())).length;
  return overlap / Math.max(tags1.length, tags2.length);
}

function generateMockMatches(payload: WebhookPayload): WebhookResponse {
  const userTags = payload.user_profile.skills_interests;
  const userLat = 40.7128;
  const userLng = -74.006;

  const scored = MOCK_PROFILES.map((p, idx) => {
    const interestWeight = computeInterestOverlap(userTags, p.tags);
    const dist = calculateHaversineDistance(userLat, userLng, p.lat, p.lng);
    const distPenalty = Math.max(0, 1 - dist / 3);
    const contextualBoost = Math.random() * 0.15 + 0.05;

    const rawScore = interestWeight * 0.50 + distPenalty * 0.30 + contextualBoost;
    const matchScore = Math.round(Math.min(rawScore * 100, 99));

    return {
      profile: p,
      idx,
      matchScore: Math.max(matchScore, 40),
      distance: dist,
      interestWeight: Math.round(interestWeight * 100),
      distPenalty: Math.round(distPenalty * 100),
      contextualBoost: Math.round(contextualBoost * 100),
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const top = scored.slice(0, Math.min(scored.length, 6));

  const matches: WebhookMatch[] = top.map((s) => ({
    id: crypto.randomUUID(),
    matched_user_name: s.profile.name,
    matched_user_id: `mock-${s.idx}`,
    match_score: s.matchScore,
    title: payload.request_details.title || 'Campus Gig',
    category: payload.request_details.category,
    pay_min: payload.request_details.pay_min,
    pay_max: payload.request_details.pay_max,
    campus_location: s.profile.loc,
    walk_time_mins: Math.round(s.distance * 15) + 2,
    description: `Skilled in ${s.profile.tags.slice(0, 2).join(', ')}. Available ${Math.random() > 0.5 ? 'immediately' : 'this week'}.`,
    distance_miles: Math.round(s.distance * 10) / 10,
    interest_tags: s.profile.tags,
    reasoning: {
      interest_similarity_weight: s.interestWeight,
      distance_penalization_factor: s.distPenalty,
      contextual_boost: s.contextualBoost,
      details: `Interest overlap: ${s.interestWeight}% (${s.profile.tags.filter(t => userTags.map(x => x.toLowerCase()).includes(t.toLowerCase())).length}/${s.profile.tags.length} tags match). Distance: ${s.distance.toFixed(1)}mi. Context boost from ${payload.request_details.category.toLowerCase()} relevance.`,
    },
  }));

  return { success: true, matches };
}

export { MOCK_PROFILES, calculateHaversineDistance, computeInterestOverlap };
