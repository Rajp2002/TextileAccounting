-- Add test_password column for testing purposes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS test_password TEXT;
