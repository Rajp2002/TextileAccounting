-- Migration: Add default warping and sizing modes to factory_cost_profile
-- Supports starting preferences CD04 (warping mode) and CD05 (sizing mode)

ALTER TABLE public.factory_cost_profile
  ADD COLUMN IF NOT EXISTS default_warping_mode text
    CHECK (default_warping_mode IN ('in_house', 'outsourced'))
    DEFAULT 'in_house',
  ADD COLUMN IF NOT EXISTS default_sizing_mode text
    CHECK (default_sizing_mode IN ('in_house', 'outsourced'))
    DEFAULT 'in_house';

COMMENT ON COLUMN public.factory_cost_profile.default_warping_mode IS
  'Starting warping mode for new cost estimates: in_house (absorbed in overhead) or outsourced (per-kg rate).';

COMMENT ON COLUMN public.factory_cost_profile.default_sizing_mode IS
  'Starting sizing mode for new cost estimates: in_house (absorbed in overhead) or outsourced (per-kg rate).';
