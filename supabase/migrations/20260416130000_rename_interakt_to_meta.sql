-- ============================================================
-- MIGRATION: Rename Interakt columns to Meta
-- ============================================================

-- 1. Rename columns in whatsapp_delivery_log
ALTER TABLE whatsapp_delivery_log 
    RENAME COLUMN interakt_callback_data TO meta_callback_data;

ALTER TABLE whatsapp_delivery_log 
    RENAME COLUMN interakt_message_id TO meta_message_id;

-- 2. Rename indexes
-- (Postgres usually renames the index internally if it depends on the column, 
-- but we'll explicitly drop and recreate for clarity if needed, or just leave as is. 
-- Actually, the index names include 'interakt' so let's update them.)

DROP INDEX IF EXISTS idx_whatsapp_log_interakt_message_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_log_meta_message_id
    ON whatsapp_delivery_log(meta_message_id)
    WHERE meta_message_id IS NOT NULL;

DROP INDEX IF EXISTS idx_whatsapp_log_message_id_lookup;
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_meta_message_id_lookup
    ON whatsapp_delivery_log(meta_message_id)
    WHERE meta_message_id IS NOT NULL;
