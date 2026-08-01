-- Sprint 5: make Rate Book history explicit without changing any costing
-- snapshot. Rate changes continue to update future Saved Quality recipes only;
-- estimator_quotes remains an immutable financial record.

ALTER TABLE public.cost_rate_history
  ADD COLUMN IF NOT EXISTS previous_value numeric(12,4),
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'recorded';

WITH ordered_history AS (
  SELECT
    history.id,
    history.value,
    history.previous_value,
    ROW_NUMBER() OVER (
      PARTITION BY history.org_id, history.rate_id
      ORDER BY history.effective_date ASC, history.created_at ASC, history.id ASC
    ) AS sequence_number,
    LAG(history.value) OVER (
      PARTITION BY history.org_id, history.rate_id
      ORDER BY history.effective_date ASC, history.created_at ASC, history.id ASC
    ) AS prior_value
  FROM public.cost_rate_history AS history
)
UPDATE public.cost_rate_history AS history
SET previous_value = ordered_history.prior_value,
    event_type = CASE
      WHEN ordered_history.sequence_number = 1 THEN 'recorded'
      WHEN ordered_history.prior_value = ordered_history.value THEN 'reviewed'
      ELSE 'changed'
    END
FROM ordered_history
WHERE history.id = ordered_history.id;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cost_rate_history'::regclass
      AND conname = 'cost_rate_history_event_type_check'
  ) THEN
    ALTER TABLE public.cost_rate_history
      ADD CONSTRAINT cost_rate_history_event_type_check
      CHECK (event_type IN ('recorded', 'reviewed', 'changed', 'archived', 'restored'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cost_rate_history'::regclass
      AND conname = 'cost_rate_history_previous_value_check'
  ) THEN
    ALTER TABLE public.cost_rate_history
      ADD CONSTRAINT cost_rate_history_previous_value_check
      CHECK (previous_value IS NULL OR previous_value >= 0);
  END IF;
END;
$constraints$;

ALTER TABLE public.cost_rate_history
  ALTER COLUMN event_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS cost_rate_history_org_rate_activity_idx
  ON public.cost_rate_history(org_id, rate_id, created_at DESC);

COMMENT ON COLUMN public.cost_rate_history.event_type IS
  'Explicit owner-visible lifecycle event. Archived/restored events do not count as rate review.';

COMMENT ON COLUMN public.cost_rate_history.previous_value IS
  'The immediately preceding current rate when this event changed or reviewed the value.';

COMMENT ON TABLE public.cost_rate_history IS
  'Tenant-scoped append-only Rate Book activity. It preserves value history and explicit review/archive/restore events; it never edits estimator_quotes.';

-- Existing save_cost_rate_atomic writes the rate row first and then appends a
-- history row. Infer the event from the row version so the old RPC remains the
-- canonical value propagation boundary without duplicating its implementation.
CREATE OR REPLACE FUNCTION public.infer_cost_rate_history_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rate public.cost_rate_book%ROWTYPE;
BEGIN
  -- Dedicated review/lifecycle functions provide their event explicitly.
  IF NEW.event_type <> 'recorded' OR NEW.previous_value IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_rate
  FROM public.cost_rate_book AS rate
  WHERE rate.id = NEW.rate_id
    AND rate.org_id = NEW.org_id;

  IF FOUND THEN
    NEW.previous_value := v_rate.previous_value;
    IF v_rate.previous_value IS NULL THEN
      NEW.event_type := 'recorded';
    ELSIF v_rate.current_value = v_rate.previous_value THEN
      NEW.event_type := 'reviewed';
    ELSE
      NEW.event_type := 'changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS infer_cost_rate_history_event ON public.cost_rate_history;
CREATE TRIGGER infer_cost_rate_history_event
  BEFORE INSERT ON public.cost_rate_history
  FOR EACH ROW EXECUTE FUNCTION public.infer_cost_rate_history_event();

REVOKE ALL ON TABLE public.cost_rate_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cost_rate_history TO authenticated;

-- A dedicated review does not call the value-change RPC and does not touch
-- templates, factory defaults, or estimator_quotes.
CREATE OR REPLACE FUNCTION public.review_cost_rate_atomic(
  p_rate_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing public.cost_rate_book%ROWTYPE;
  v_rate public.cost_rate_book%ROWTYPE;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can review costing rates.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator or Full Suite subscription is required.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is locked. Costing rates cannot be reviewed.';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'This rate changed or is missing its version. Refresh before reviewing it.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.cost_rate_book AS rate
  WHERE rate.id = p_rate_id
    AND rate.org_id = v_org_id
    AND rate.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rate no longer exists or is archived.';
  END IF;
  IF v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'This rate changed in another tab. Refresh before reviewing it.';
  END IF;

  UPDATE public.cost_rate_book
  SET last_reviewed_at = current_date,
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = v_existing.id
    AND org_id = v_org_id
  RETURNING * INTO v_rate;

  INSERT INTO public.cost_rate_history (
    org_id, rate_id, value, previous_value, effective_date,
    source, notes, changed_by, event_type
  ) VALUES (
    v_org_id, v_rate.id, v_rate.current_value, v_rate.current_value,
    v_rate.effective_date, v_rate.source,
    'Owner confirmed the displayed current rate without changing its value.',
    v_user_id, 'reviewed'
  );

  RETURN jsonb_build_object('rate', to_jsonb(v_rate));
END;
$$;

REVOKE ALL ON FUNCTION public.review_cost_rate_atomic(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_cost_rate_atomic(uuid, timestamptz) TO authenticated;

-- Archive and restore are lifecycle events on a Rate Book entry, not archive
-- operations on a Saved Quality or an estimator snapshot. Keep the state
-- update and its append-only activity row in one transaction.
CREATE OR REPLACE FUNCTION public.set_cost_rate_active_atomic(
  p_rate_id uuid,
  p_expected_updated_at timestamptz,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing public.cost_rate_book%ROWTYPE;
  v_rate public.cost_rate_book%ROWTYPE;
  v_event_type text;
  v_action_label text;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can archive or restore costing rates.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator or Full Suite subscription is required.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is locked. Rate Book entries cannot be archived or restored.';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'This rate changed or is missing its version. Refresh before changing its Rate Book status.';
  END IF;
  IF p_is_active IS NULL THEN
    RAISE EXCEPTION 'Choose whether to archive or restore this Rate Book entry.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.cost_rate_book AS rate
  WHERE rate.id = p_rate_id
    AND rate.org_id = v_org_id
    AND rate.is_active = NOT p_is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    v_action_label := CASE WHEN p_is_active THEN 'restoring' ELSE 'archiving' END;
    RAISE EXCEPTION 'This rate changed in another tab or was already %.', v_action_label;
  END IF;
  IF v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_action_label := CASE WHEN p_is_active THEN 'restoring' ELSE 'archiving' END;
    RAISE EXCEPTION 'This rate changed in another tab. Refresh before % it.', v_action_label;
  END IF;

  v_event_type := CASE WHEN p_is_active THEN 'restored' ELSE 'archived' END;
  UPDATE public.cost_rate_book
  SET is_active = p_is_active,
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = v_existing.id
    AND org_id = v_org_id
  RETURNING * INTO v_rate;

  INSERT INTO public.cost_rate_history (
    org_id, rate_id, value, previous_value, effective_date,
    source, notes, changed_by, event_type
  ) VALUES (
    v_org_id, v_rate.id, v_rate.current_value, v_rate.current_value,
    v_rate.effective_date, v_rate.source,
    CASE WHEN p_is_active
      THEN 'Owner restored this rate to the active Rate Book.'
      ELSE 'Owner archived this rate from the active Rate Book.'
    END,
    v_user_id, v_event_type
  );

  RETURN jsonb_build_object('id', v_rate.id, 'updated_at', v_rate.updated_at, 'is_active', v_rate.is_active);
END;
$$;

REVOKE ALL ON FUNCTION public.set_cost_rate_active_atomic(uuid, timestamptz, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cost_rate_active_atomic(uuid, timestamptz, boolean) TO authenticated;
