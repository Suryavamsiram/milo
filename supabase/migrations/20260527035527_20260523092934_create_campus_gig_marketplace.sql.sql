/*
  # Campus Gig Marketplace Schema

  ## Overview
  Full schema for the Milo campus gig marketplace platform.

  ## New Tables

  ### user_profiles
  - Stores onboarding data: campus zone, proximity preference, pay range, skills/interests
  - Links to Supabase auth users

  ### gigs
  - Core gig records (post or search type)
  - Contains full payload schema: category, pay range, place, status, escrow

  ### gig_matches
  - Ranked match results returned from the agentic backend
  - Tracks accept/reject decisions and escrow flow

  ### chat_messages
  - Persistent message thread per user session
  - Stores both user and agent messages, plus inline match card references

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
*/

-- User profiles table (onboarding data)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'poster' CHECK (role IN ('poster', 'finder', 'both')),
  campus_location text NOT NULL DEFAULT '',
  max_walk_time_mins integer NOT NULL DEFAULT 10 CHECK (max_walk_time_mins IN (10, 20, 40)),
  pay_min numeric(10,2) NOT NULL DEFAULT 10,
  pay_max numeric(10,2) NOT NULL DEFAULT 50,
  skills_interests text[] NOT NULL DEFAULT '{}',
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gigs table
CREATE TABLE IF NOT EXISTS gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'post' CHECK (type IN ('post', 'search')),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  pay_min numeric(10,2) NOT NULL DEFAULT 0,
  pay_max numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  campus_location text NOT NULL DEFAULT '',
  is_remote boolean NOT NULL DEFAULT false,
  poster_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','in_progress','completed','cancelled')),
  escrow_held boolean NOT NULL DEFAULT false,
  escrow_amount numeric(10,2) NOT NULL DEFAULT 0,
  escrow_released boolean NOT NULL DEFAULT false,
  webhook_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gigs"
  ON gigs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gigs"
  ON gigs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gigs"
  ON gigs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gig matches table
CREATE TABLE IF NOT EXISTS gig_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  matched_user_name text NOT NULL DEFAULT '',
  matched_user_id text NOT NULL DEFAULT '',
  match_score integer NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  pay_min numeric(10,2) NOT NULL DEFAULT 0,
  pay_max numeric(10,2) NOT NULL DEFAULT 0,
  campus_location text NOT NULL DEFAULT '',
  walk_time_mins integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  decision text CHECK (decision IN ('accepted','rejected')),
  escrow_status text NOT NULL DEFAULT 'pending' CHECK (escrow_status IN ('pending','held','released','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gig_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own matches"
  ON gig_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own matches"
  ON gig_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own matches"
  ON gig_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','agent')),
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','match_cards','status','error','telemetry')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gigs_user_id ON gigs(user_id);
CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs(status);
CREATE INDEX IF NOT EXISTS idx_gig_matches_gig_id ON gig_matches(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_matches_user_id ON gig_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gigs_updated_at
  BEFORE UPDATE ON gigs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gig_matches_updated_at
  BEFORE UPDATE ON gig_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();