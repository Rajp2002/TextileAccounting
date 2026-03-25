-- ============================================================
-- MIGRATION: Remove plaintext test_password from profiles
--
-- SECURITY: The profiles.test_password column stored raw plaintext
-- passwords for development testing. Plaintext passwords must NEVER
-- be stored in a production database. This migration permanently
-- removes the column and all data it contains.
--
-- This is irreversible. The application code has already been
-- updated to never write to this column.
-- ============================================================

ALTER TABLE profiles DROP COLUMN IF EXISTS test_password;
