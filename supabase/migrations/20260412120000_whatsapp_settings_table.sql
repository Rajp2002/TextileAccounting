-- ============================================================
-- MIGRATION: WhatsApp Settings Table
-- ============================================================
-- Stores Supabase URL and Service Role Key for pg_cron/pg_net usage.
-- This replaces the restricted "ALTER DATABASE SET" pattern which
-- fails on some Supabase environments due to permission denied (42501).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but add no policies (public cannot read/write)
-- Only service_role and postgres can access it.
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Metadata for ease of use
COMMENT ON TABLE public.whatsapp_settings IS 'Stores Supabase internal credentials for the WhatsApp edge function pipeline.';
