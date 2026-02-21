-- Add email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Optional: Create an index on email for faster lookups if needed later
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
