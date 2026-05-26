import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserProfile = {
  id: string;
  user_id: string;
  name: string;
  role: 'poster' | 'finder' | 'both';
  campus_location: string;
  max_walk_time_mins: 10 | 20 | 40;
  pay_min: number;
  pay_max: number;
  skills_interests: string[];
  onboarding_complete: boolean;
  avatar_url: string | null;
  bio: string;
  latitude: number | null;
  longitude: number | null;
  skills: string[];
  availability: 'flexible' | 'mornings' | 'afternoons' | 'evenings' | 'weekends_only';
  created_at: string;
  updated_at: string;
  auth_user_id: string | null;
  email: string;
  balance: number;
  total_earned: number;
  total_spent: number;
};

export type Gig = {
  id: string;
  user_id: string;
  type: 'post' | 'search';
  title: string;
  content: string;
  category: string;
  pay_min: number;
  pay_max: number;
  currency: string;
  campus_location: string;
  is_remote: boolean;
  poster_name: string;
  status: 'open' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
  escrow_held: boolean;
  escrow_amount: number;
  escrow_released: boolean;
  webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  accepted_by_user_id: string | null;
  accepted_by_name: string;
  started_at: string | null;
  completed_at: string | null;
  contractor_marked_complete: boolean;
  redeems_requested: number;
};

export type MatchReasoning = {
  interest_similarity_weight: number;
  distance_penalization_factor: number;
  contextual_boost: number;
  details: string;
};

export type GigMatch = {
  id: string;
  gig_id: string;
  user_id: string;
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
  decision: 'accepted' | 'rejected' | null;
  escrow_status: 'pending' | 'held' | 'released' | 'disputed';
  created_at: string;
  updated_at: string;
  contractor_accepted: boolean;
  contractor_accepted_at: string | null;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'agent';
  content: string;
  message_type: 'text' | 'match_cards' | 'status' | 'error' | 'telemetry';
  metadata: Record<string, unknown>;
  session_id: string | null;
  created_at: string;
};

export type ChatSession = {
  id: string;
  user_id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type WalletTransaction = {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'escrow_hold' | 'escrow_release' | 'earning' | 'refund';
  amount: number;
  reference_id: string | null;
  reference_type: 'gig' | 'match' | 'deposit' | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  created_at: string;
};

export type GigApplication = {
  id: string;
  gig_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_avatar_url: string | null;
  applicant_bio: string;
  applicant_skills: string[];
  applicant_campus_location: string;
  applicant_latitude: number | null;
  applicant_longitude: number | null;
  applicant_availability: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};
