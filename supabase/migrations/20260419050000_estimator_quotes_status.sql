-- Add status column to estimator_quotes
ALTER TABLE estimator_quotes 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected'));
