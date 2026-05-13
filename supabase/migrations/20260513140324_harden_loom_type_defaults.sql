-- Harden loom type defaults and null handling

UPDATE public.machines
SET loom_type = 'uncategorized'
WHERE loom_type IS NULL OR trim(loom_type) = '';

UPDATE public.machines
SET loom_type_custom_label = NULL
WHERE loom_type <> 'other';

ALTER TABLE public.machines
ALTER COLUMN loom_type SET DEFAULT 'uncategorized';

ALTER TABLE public.machines
ALTER COLUMN loom_type SET NOT NULL;

ALTER TABLE public.machines
DROP CONSTRAINT IF EXISTS machines_loom_type_custom_label_length_check;

ALTER TABLE public.machines
ADD CONSTRAINT machines_loom_type_custom_label_length_check
CHECK (
  loom_type_custom_label IS NULL
  OR length(trim(loom_type_custom_label)) <= 80
);
