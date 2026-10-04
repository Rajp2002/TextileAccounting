-- LT01B (CS-2): keep the warping and overhead basis of each new saved costing.
--
-- The save payload did not store warping_mode or overhead_mode, and stored
-- overhead_override_per_m only in direct mode although the engine applies a
-- non-null override in monthly mode too. Reopening then inferred the basis
-- from what remained, so an in-house warping costing with a kept reference
-- rate, or a monthly costing with an applied overhead, reopened on changed
-- inputs. Saved money was never affected.
--
-- Additive and nullable. Existing rows stay NULL: their original modes were
-- never stored and are not guessed, so readers keep the earlier inference for
-- them. The snapshot protection trigger compares every column outside its
-- mutable list, so the new columns are immutable after insert without a
-- trigger change. No calculation, rounding or snapshot version changes.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS warping_mode text,
  ADD COLUMN IF NOT EXISTS overhead_mode text;

DO $input_basis_checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_warping_mode_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_warping_mode_check
      CHECK (warping_mode IS NULL OR warping_mode IN ('in_house', 'outsourced'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_overhead_mode_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_overhead_mode_check
      CHECK (overhead_mode IS NULL OR overhead_mode IN ('direct', 'monthly_expenses'));
  END IF;
END;
$input_basis_checks$;

COMMENT ON COLUMN public.estimator_quotes.warping_mode IS
  'Warping mode the saved costing was calculated with. NULL for costings saved before 2026-10-04, whose mode was not stored.';
COMMENT ON COLUMN public.estimator_quotes.overhead_mode IS
  'Overhead mode the saved costing was calculated with. NULL for costings saved before 2026-10-04; for those, overhead_override_per_m is set only in direct mode.';

-- Accept the two keys in the attested save payload. The allowlist was added to
-- save_estimator_costing_revision_v2 by 20260825060131; extend it in place the
-- same way rather than copying the large concurrency body. Grants, owner,
-- SECURITY DEFINER and search_path are unchanged by CREATE OR REPLACE.
DO $allow_input_basis$
DECLARE
  v_function record;
  v_body text;
BEGIN
  SELECT
    proc.oid,
    proc.prosrc,
    pg_get_function_arguments(proc.oid) AS arguments,
    pg_get_function_result(proc.oid) AS result_type
  INTO STRICT v_function
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  JOIN pg_language AS language ON language.oid = proc.prolang
  WHERE namespace.nspname = 'public'
    AND language.lanname = 'plpgsql'
    AND proc.proname = 'save_estimator_costing_revision_v2';

  IF position('''warping_mode''' IN v_function.prosrc) > 0 THEN
    RETURN;
  END IF;

  v_body := replace(
    v_function.prosrc,
    E'''server_attestation_id''\n    ])',
    E'''server_attestation_id'', ''warping_mode'', ''overhead_mode''\n    ])'
  );

  IF v_body = v_function.prosrc THEN
    RAISE EXCEPTION 'Could not extend the costing payload allowlist';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_v2(%s) '
      || 'RETURNS %s LANGUAGE plpgsql VOLATILE SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
    v_function.arguments,
    v_function.result_type,
    v_body
  );
END;
$allow_input_basis$;
