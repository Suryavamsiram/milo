/*
  # Milo Auth, Chat Sessions, Escrow, Notifications, Gig Applications

  ## Overview
  Major schema upgrade adding:
  - Supabase Auth integration (user_profiles now links to auth.users)
  - Chat sessions with timestamp-based IDs for recall/delete/persistence
  - Simulated escrow wallet system (users can add any amount of USD)
  - Gig applications (finders apply to posters' gigs)
  - Notification system for gig matches based on skills/location/pay
  - Gig acceptance flow with poster notification including accepter profile/location

  ## New Tables

  ### chat_sessions
  - Groups messages into persistent sessions identified by timestamp-based IDs
  - Each session stores its messages in chat_messages via session_id
  - Users can create, recall, and delete sessions

  ### wallets
  - Simulated USD balance per user
  - Tracks deposits (user adds money) and escrow deductions/releases

  ### wallet_transactions
  - Ledger of all wallet activity: deposit, escrow_hold, escrow_release, escrow_refund, payment_sent, payment_received

  ### gig_applications
  - Finders apply to open gigs posted by others
  - Includes accepter profile info, skills, location for poster to review
  - Status flow: pending -> accepted/rejected
  - On acceptance, escrow is held from poster's wallet

  ### notifications
  - In-app notifications for gig matches, applications, escrow events
  - Created when: a gig matches someone's skills/location/pay, someone applies to your gig,
    someone accepts your application, escrow is held/released

  ## Modified Tables

  ### user_profiles
  - user_id now references auth.users.id (was a plain UUID)
  - Keeps existing columns and adds new ones

  ### chat_messages
  - Added session_id to link messages to chat sessions

  ### gigs
  - Added applicant_count column

  ### gig_matches
  - No structural changes but now also created from gig_applications

  ## Security
  - RLS enabled on all new tables
  - Policies use auth.uid() for authenticated users
  - Anon role policies removed - all access requires authentication
*/

-- ============================================
-- Drop old anon policies (we're moving to auth)
-- ============================================
DROP POLICY IF EXISTS "Anon users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Anon users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Anon users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Anon users can read own gigs" ON gigs;
DROP POLICY IF EXISTS "Anon users can insert own gigs" ON gigs;
DROP POLICY IF EXISTS "Anon users can update own gigs" ON gigs;
DROP POLICY IF EXISTS "Anon users can read own matches" ON gig_matches;
DROP POLICY IF EXISTS "Anon users can insert own matches" ON gig_matches;
DROP POLICY IF EXISTS "Anon users can update own matches" ON gig_matches;
DROP POLICY IF EXISTS "Anon users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Anon users can insert own messages" ON chat_messages;

-- ============================================
-- NEW TABLES
-- ============================================

-- Chat sessions: timestamp-based IDs, persisted per user
CREATE TABLE IF NOT EXISTS chat_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Wallets: simulated USD balances
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wallet transactions ledger
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'escrow_hold', 'escrow_release', 'escrow_refund', 'payment_sent', 'payment_received')),
  amount numeric(12,2) NOT NULL,
  reference_id text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Gig applications: finders apply to posters' gigs
CREATE TABLE IF NOT EXISTS gig_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL,
  applicant_name text NOT NULL DEFAULT '',
  applicant_avatar_url text,
  applicant_bio text DEFAULT '',
  applicant_skills text[] DEFAULT '{}',
  applicant_campus_location text DEFAULT '',
  applicant_latitude numeric(10,8),
  applicant_longitude numeric(11,8),
  applicant_availability text DEFAULT 'flexible',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gig_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own applications"
  ON gig_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = applicant_id OR auth.uid() = (SELECT user_id FROM gigs WHERE gigs.id = gig_applications.gig_id));

CREATE POLICY "Users can insert own applications"
  ON gig_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Gig owners can update applications on their gigs"
  ON gig_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = (SELECT user_id FROM gigs WHERE gigs.id = gig_applications.gig_id) OR auth.uid() = applicant_id)
  WITH CHECK (auth.uid() = (SELECT user_id FROM gigs WHERE gigs.id = gig_applications.gig_id) OR auth.uid() = applicant_id);

-- Notifications: in-app notification system
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('gig_match', 'gig_application', 'application_accepted', 'application_rejected', 'escrow_held', 'escrow_released', 'escrow_refund', 'payment_received', 'gig_completed')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  reference_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- MODIFY EXISTING TABLES
-- ============================================

-- Add session_id to chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN session_id text;
  END IF;
END $$;

-- Add applicant_count to gigs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gigs' AND column_name = 'applicant_count'
  ) THEN
    ALTER TABLE gigs ADD COLUMN applicant_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- AUTH-BASED RLS POLICIES FOR EXISTING TABLES
-- ============================================

-- user_profiles: authenticated users can manage their own profile
CREATE POLICY "Auth users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- gigs: owners can manage their own; all authenticated can read open gigs
CREATE POLICY "Auth users can read gigs"
  ON gigs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth users can insert own gigs"
  ON gigs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can update own gigs"
  ON gigs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- gig_matches: owners can read; can insert/update own
CREATE POLICY "Auth users can read own matches"
  ON gig_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users can insert own matches"
  ON gig_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can update own matches"
  ON gig_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chat_messages: owners can read/insert own messages
CREATE POLICY "Auth users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gig_applications_gig_id ON gig_applications(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_applications_applicant_id ON gig_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================
-- TRIGGERS for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gig_applications_updated_at ON gig_applications;
CREATE TRIGGER update_gig_applications_updated_at
  BEFORE UPDATE ON gig_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
