-- Active time in the app, per owner per India day.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section A.
-- The browser counts a minute only while the page is visible and the owner touched,
-- scrolled or typed in the last 60 seconds, then flushes at most 10 minutes at a time.
-- This table holds one row per org, owner and day; nothing about page content or
-- typed values is stored. Only the server writes it, through record_account_activity,
-- which never accepts more minutes than the time since the previous flush.

CREATE TABLE private.account_activity_days (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  active_minutes integer NOT NULL DEFAULT 0 CHECK (active_minutes BETWEEN 0 AND 1440),
  area_minutes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(area_minutes) = 'object'),
  phone_minutes integer NOT NULL DEFAULT 0 CHECK (phone_minutes >= 0),
  tablet_minutes integer NOT NULL DEFAULT 0 CHECK (tablet_minutes >= 0),
  desktop_minutes integer NOT NULL DEFAULT 0 CHECK (desktop_minutes >= 0),
  installed_minutes integer NOT NULL DEFAULT 0 CHECK (installed_minutes >= 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_flush_at timestamptz,
  PRIMARY KEY (org_id, user_id, day)
);
CREATE INDEX account_activity_days_last_seen_idx ON private.account_activity_days (org_id, last_seen_at DESC);
ALTER TABLE private.account_activity_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.account_activity_days FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.account_activity_days IS
  'Owner active minutes per India day (spec 2026-10-30 section A). Written only by public.record_account_activity; read only by founder reporting functions.';

CREATE FUNCTION public.record_account_activity(
  p_user_id uuid, p_org_id uuid, p_minutes integer, p_area_minutes jsonb, p_device text, p_installed boolean
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_existing private.account_activity_days%ROWTYPE;
  v_found boolean;
  v_allowed integer;
  v_area_total integer := 0;
  v_areas jsonb := '{}'::jsonb;
  v_merged jsonb;
  v_key text;
  v_value jsonb;
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_IDENTITY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_minutes IS NULL OR p_minutes < 0 OR p_minutes > 10 THEN
    RAISE EXCEPTION 'ACTIVITY_MINUTES_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_device IS NULL OR p_device NOT IN ('phone', 'tablet', 'desktop') THEN
    RAISE EXCEPTION 'ACTIVITY_DEVICE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_area_minutes IS NULL OR jsonb_typeof(p_area_minutes) <> 'object' THEN
    RAISE EXCEPTION 'ACTIVITY_AREAS_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_area_minutes) LOOP
    IF v_key NOT IN ('estimator', 'saved_costings', 'rate_book', 'plan_billing', 'settings', 'support', 'other')
      OR jsonb_typeof(v_value) <> 'number'
      OR (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric)
      OR (v_value #>> '{}')::numeric < 0 OR (v_value #>> '{}')::numeric > 10 THEN
      RAISE EXCEPTION 'ACTIVITY_AREAS_INVALID' USING ERRCODE = '22023';
    END IF;
    v_area_total := v_area_total + (v_value #>> '{}')::integer;
  END LOOP;

  -- Serialize flushes for one owner-day so two windows cannot both claim the same minutes.
  INSERT INTO private.account_activity_days (org_id, user_id, day)
  VALUES (p_org_id, p_user_id, v_day)
  ON CONFLICT (org_id, user_id, day) DO NOTHING;
  SELECT * INTO v_existing FROM private.account_activity_days
  WHERE org_id = p_org_id AND user_id = p_user_id AND day = v_day
  FOR UPDATE;
  v_found := v_existing.last_flush_at IS NOT NULL;

  v_allowed := least(
    p_minutes,
    CASE WHEN v_found THEN ceil(extract(epoch FROM now() - v_existing.last_flush_at) / 60)::integer + 1 ELSE 6 END,
    1440 - v_existing.active_minutes
  );
  v_allowed := greatest(v_allowed, 0);

  -- Area minutes never exceed the accepted total; scale down and floor when they would.
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_area_minutes) LOOP
    v_areas := v_areas || jsonb_build_object(v_key,
      CASE WHEN v_area_total > v_allowed
        THEN floor((v_value #>> '{}')::numeric * v_allowed / v_area_total)::integer
        ELSE (v_value #>> '{}')::integer END);
  END LOOP;
  v_merged := v_existing.area_minutes;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_areas) LOOP
    IF (v_value #>> '{}')::integer > 0 THEN
      v_merged := v_merged || jsonb_build_object(v_key, coalesce((v_merged ->> v_key)::integer, 0) + (v_value #>> '{}')::integer);
    END IF;
  END LOOP;

  UPDATE private.account_activity_days SET
    active_minutes = active_minutes + v_allowed,
    area_minutes = v_merged,
    phone_minutes = phone_minutes + CASE WHEN p_device = 'phone' THEN v_allowed ELSE 0 END,
    tablet_minutes = tablet_minutes + CASE WHEN p_device = 'tablet' THEN v_allowed ELSE 0 END,
    desktop_minutes = desktop_minutes + CASE WHEN p_device = 'desktop' THEN v_allowed ELSE 0 END,
    installed_minutes = installed_minutes + CASE WHEN p_installed THEN v_allowed ELSE 0 END,
    last_seen_at = now(),
    last_flush_at = now()
  WHERE org_id = p_org_id AND user_id = p_user_id AND day = v_day;

  RETURN v_allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.record_account_activity(uuid, uuid, integer, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_activity(uuid, uuid, integer, jsonb, text, boolean) TO service_role;
COMMENT ON FUNCTION public.record_account_activity(uuid, uuid, integer, jsonb, text, boolean) IS
  'Adds one flush of owner active minutes to today''s India-day row. Accepts at most the minutes since the previous flush plus one (6 for the first flush of the day) and at most 1440 a day. Service role only; the route derives the org and user from the verified session.';
