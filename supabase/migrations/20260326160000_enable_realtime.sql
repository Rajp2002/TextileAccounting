-- Migration to enable Supabase Realtime for dynamically synced tables

BEGIN;

-- Check if publication exists, though Supabase creates it by default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

-- Add yarn_batches to realtime publication safely
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'yarn_batches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE yarn_batches;
  END IF;
END $$;

-- Add orders to realtime publication safely
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- Add production_logs to realtime publication safely
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'production_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE production_logs;
  END IF;
END $$;

COMMIT;
