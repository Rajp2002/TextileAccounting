-- Migration: Add leftover_weight_kg to yarn_batches
ALTER TABLE yarn_batches
    ADD COLUMN IF NOT EXISTS leftover_weight_kg DECIMAL NOT NULL DEFAULT 0;
