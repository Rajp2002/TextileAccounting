-- Why a Base machine was marked unavailable.
--
-- The owner must give a short reason when they clear "Available for new
-- assignments and daily context" on a machine. It is shown on the machine
-- card beside the Inactive badge and cleared when the machine is available
-- again. Existing inactive machines simply have no reason recorded.

ALTER TABLE public.base_production_machines
  ADD COLUMN IF NOT EXISTS inactive_reason text
  CHECK (inactive_reason IS NULL OR char_length(btrim(inactive_reason)) BETWEEN 1 AND 200);

COMMENT ON COLUMN public.base_production_machines.inactive_reason IS
  'Owner-stated reason the machine is unavailable; NULL while is_active is true.';
