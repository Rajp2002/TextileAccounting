ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS beam_tracking_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.beam_tracking_enabled IS
  'If false (default), the Beams tab in Inventory is hidden behind an opt-in prompt. Suitable for smaller factories where beam tracking adds no value.';
