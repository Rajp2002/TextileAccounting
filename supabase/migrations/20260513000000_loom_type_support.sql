-- Migration: Add Loom Type Support with Custom Labels
-- Date: 2026-05-13

-- 1. Add loom_type_custom_label if it does not exist.
ALTER TABLE machines ADD COLUMN IF NOT EXISTS loom_type_custom_label text;

-- 2. Add length check for loom_type_custom_label.
ALTER TABLE machines ADD CONSTRAINT machines_loom_type_custom_label_length_check CHECK (length(loom_type_custom_label) <= 80);

-- 3. Drop the existing loom_type check constraint safely.
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'machines'::regclass
      AND c.contype = 'c'
      AND a.attname = 'loom_type'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE machines DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 4. Map known old values to new values before constraint
UPDATE machines SET loom_type = 'jacquard' WHERE loom_type IN ('jacquard_electronic', 'jacquard_mechanical');

-- 5. Normalize unsupported/null/empty existing loom_type values to "uncategorized"
UPDATE machines
SET loom_type = 'uncategorized'
WHERE loom_type IS NULL
   OR trim(loom_type) = ''
   OR loom_type NOT IN (
     'jacquard',
     'rapier',
     'water_jet',
     'air_jet',
     'power_loom',
     'shuttle',
     'other',
     'uncategorized'
   );

-- 6. Recreate the loom_type check constraint with the expanded canonical list.
ALTER TABLE machines ADD CONSTRAINT machines_loom_type_check CHECK (loom_type IN (
  'jacquard',
  'rapier',
  'water_jet',
  'air_jet',
  'power_loom',
  'shuttle',
  'other',
  'uncategorized'
));
