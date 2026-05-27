/*
  # Profile Extensions for Milo

  ## Overview
  Adds profile fields for avatar, bio, skills list, and location coordinates.

  ## Changes to user_profiles table
  - Add avatar_url for profile pictures
  - Add bio for user description
  - Add latitude/longitude for map positioning
  - Add skills list for display
*/

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS latitude numeric(10,8);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS longitude numeric(11,8);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS availability text DEFAULT 'flexible' CHECK (availability IN ('flexible', 'mornings', 'afternoons', 'evenings', 'weekends_only'));