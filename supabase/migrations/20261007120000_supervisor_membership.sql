-- Base supervisors record the daily production sheet for one factory.
--
-- A supervisor is deliberately NOT a tenant member: the profile has no
-- org_id and the access token carries no org claim. Every existing org-scoped
-- RLS policy and owner RPC, including the retired Full Suite policies that
-- still name user_role = 'supervisor', compares the caller's org to the row,
-- so all of them refuse supervisors by construction. The factory link lives
-- in factory_supervisors, which no RLS policy reads; only the SECURITY
-- DEFINER functions in this and the next migration use it.

-- ── Factory codes and supervisor membership ─────────────────────────────────

CREATE TABLE public.supervisor_join_codes (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  joining_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.factory_supervisors (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT factory_supervisors_decision_recorded CHECK ((status = 'pending') = (decided_at IS NULL))
);

CREATE INDEX factory_supervisors_org_status_idx ON public.factory_supervisors(org_id, status);

ALTER TABLE public.supervisor_join_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_supervisors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervisor_join_codes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.factory_supervisors FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.supervisor_join_codes IS
  'One shareable factory code per Base organization. Read and written only through owner and join functions.';
COMMENT ON TABLE public.factory_supervisors IS
  'Links a supervisor profile (which has no org_id) to one factory. No RLS policy reads this table.';

-- ── Retired Full Suite supervisors ──────────────────────────────────────────
-- Their profiles still carry an org_id. Revoke them so the retired policies
-- can never match a live token, and so an active supervisor never has an org.

UPDATE public.profiles
SET access_revoked_at = now()
WHERE role = 'supervisor'
  AND access_revoked_at IS NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_active_supervisor_has_no_org
  CHECK (role <> 'supervisor' OR org_id IS NULL OR access_revoked_at IS NOT NULL);

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- The base_production branch of public.org_has_subscription_tier without its
-- membership clause (a supervisor has no profile org). Keep the two in step;
-- __tests__/db/supervisor-membership.dbtest.ts compares them.
CREATE FUNCTION private.org_has_active_base(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_subscriptions AS subscription
    WHERE subscription.org_id = p_org_id
      AND subscription.status IN (
        'active', 'authenticated', 'pending', 'paused',
        'halted', 'cancelled', 'completed'
      )
      AND (subscription.current_start IS NULL OR subscription.current_start <= now())
      AND (
        (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
        OR subscription.current_end + interval '24 hours' >= now()
      )
      AND subscription.plan_tier = 'base'
  );
$function$;

-- The caller's factory when they are an approved, unrevoked supervisor of a
-- factory with active Base. NULL for everyone else, including owners.
CREATE FUNCTION private.active_supervisor_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT membership.org_id
  FROM public.profiles AS profile
  JOIN public.factory_supervisors AS membership ON membership.user_id = profile.id
  WHERE profile.id = (SELECT auth.uid())
    AND profile.role = 'supervisor'
    AND profile.access_revoked_at IS NULL
    AND membership.status = 'approved'
    AND private.org_has_active_base(membership.org_id);
$function$;

-- public.check_org_lockdown answers false for callers outside the org, which
-- includes supervisors. Read the lock directly; a missing org is locked.
CREATE FUNCTION private.supervisor_org_locked(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE((
    SELECT organization.is_locked_down FROM public.organizations AS organization
    WHERE organization.id = p_org_id
  ), true);
$function$;

-- Eight characters without 0/O/1/I. Bytes 0-5 of a v4 UUID are fully random
-- and 256 is a multiple of 32, so each character is uniform.
CREATE FUNCTION private.generate_supervisor_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $function$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
BEGIN
  FOR i IN 1..8 LOOP
    v_code := v_code || substr(v_alphabet, (get_byte(uuid_send(gen_random_uuid()), 0) % 32) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$function$;

REVOKE ALL ON FUNCTION private.org_has_active_base(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.active_supervisor_org() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.supervisor_org_locked(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.generate_supervisor_join_code() FROM PUBLIC, anon, authenticated, service_role;

-- ── Access token claims ─────────────────────────────────────────────────────
-- Unchanged for owners, admins and revoked profiles. An active supervisor gets
-- a role for routing and never an org claim.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_role TEXT;
    v_full_name TEXT;
    v_onboarding_complete BOOLEAN;
BEGIN
    SELECT p.org_id, p.role, p.full_name
      INTO v_org_id, v_role, v_full_name
      FROM public.profiles p
     WHERE p.id = (event->>'user_id')::UUID
       AND p.access_revoked_at IS NULL;

    IF v_role = 'supervisor' AND v_org_id IS NULL THEN
        event := jsonb_set(
            event,
            '{claims}',
            (event->'claims') - 'org_id' - 'onboarding_complete'
        );
        event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
        event := jsonb_set(event, '{claims,full_name}', to_jsonb(COALESCE(v_full_name, '')));
        RETURN event;
    END IF;

    IF v_org_id IS NULL OR v_role IS NULL THEN
        event := jsonb_set(
            event,
            '{claims}',
            (event->'claims') - 'org_id' - 'user_role' - 'full_name' - 'onboarding_complete'
        );
        RETURN event;
    END IF;

    SELECT o.onboarding_complete
      INTO v_onboarding_complete
      FROM public.organizations o
     WHERE o.id = v_org_id;

    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,org_id}', to_jsonb(v_org_id::TEXT));
    event := jsonb_set(event, '{claims,full_name}', to_jsonb(COALESCE(v_full_name, '')));
    event := jsonb_set(
        event,
        '{claims,onboarding_complete}',
        to_jsonb(COALESCE(v_onboarding_complete, false))
    );

    RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) FROM PUBLIC;

-- ── Owner management ────────────────────────────────────────────────────────

-- The caller's org when they are an unrevoked owner with Base production
-- access. Writes are also refused while the org is locked.
CREATE FUNCTION private.require_owner_base_org(p_write boolean)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT profile.org_id INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid())
    AND profile.role = 'owner'
    AND profile.access_revoked_at IS NULL;
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base owner access is required' USING ERRCODE = '42501';
  END IF;
  IF p_write AND private.supervisor_org_locked(v_org_id) THEN
    RAISE EXCEPTION 'Organization is locked. Business writes are disabled until compliance unlock.' USING ERRCODE = '42501';
  END IF;
  RETURN v_org_id;
END;
$function$;

CREATE FUNCTION private.unique_supervisor_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := private.generate_supervisor_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.supervisor_join_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$function$;

CREATE FUNCTION private.supervisor_access_state(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'joining_enabled', COALESCE(code.joining_enabled, false),
    'code', code.code,
    'pending', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'full_name', profile.full_name, 'email', profile.email,
        'phone', profile.phone, 'requested_at', membership.requested_at
      ) ORDER BY membership.requested_at, membership.user_id)
      FROM public.factory_supervisors AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.org_id = p_org_id AND membership.status = 'pending'
    ), '[]'::jsonb),
    'approved', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id, 'full_name', profile.full_name, 'email', profile.email,
        'phone', profile.phone, 'requested_at', membership.requested_at, 'decided_at', membership.decided_at
      ) ORDER BY profile.full_name, membership.user_id)
      FROM public.factory_supervisors AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.org_id = p_org_id AND membership.status = 'approved'
        AND profile.access_revoked_at IS NULL
    ), '[]'::jsonb)
  )
  FROM (SELECT p_org_id AS org_id) AS anchor
  LEFT JOIN public.supervisor_join_codes AS code ON code.org_id = anchor.org_id;
$function$;

CREATE FUNCTION public.get_supervisor_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN private.supervisor_access_state(private.require_owner_base_org(false));
END;
$function$;

CREATE FUNCTION public.set_supervisor_joining(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(true);
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Choose whether supervisors can join' USING ERRCODE = '22023';
  END IF;
  UPDATE public.supervisor_join_codes
  SET joining_enabled = p_enabled, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE org_id = v_org_id;
  IF NOT FOUND THEN
    INSERT INTO public.supervisor_join_codes(org_id, code, joining_enabled, updated_by)
    VALUES (v_org_id, private.unique_supervisor_join_code(), p_enabled, (SELECT auth.uid()));
  END IF;
  RETURN private.supervisor_access_state(v_org_id);
END;
$function$;

CREATE FUNCTION public.regenerate_supervisor_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(true);
  v_code text := private.unique_supervisor_join_code();
BEGIN
  UPDATE public.supervisor_join_codes
  SET code = v_code, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE org_id = v_org_id;
  IF NOT FOUND THEN
    INSERT INTO public.supervisor_join_codes(org_id, code, joining_enabled, updated_by)
    VALUES (v_org_id, v_code, false, (SELECT auth.uid()));
  END IF;
  RETURN v_code;
END;
$function$;

CREATE FUNCTION public.approve_supervisor(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(true);
BEGIN
  UPDATE public.factory_supervisors
  SET status = 'approved', decided_at = now(), decided_by = (SELECT auth.uid()), updated_at = now()
  WHERE user_id = p_user_id AND org_id = v_org_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This request is no longer waiting for approval.' USING ERRCODE = '22023';
  END IF;
END;
$function$;

-- A pending supervisor has written nothing, so the request and its profile
-- are deleted. The application then deletes the auth account so the email
-- can be used again.
CREATE FUNCTION public.decline_supervisor(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(true);
BEGIN
  PERFORM 1 FROM public.factory_supervisors
  WHERE user_id = p_user_id AND org_id = v_org_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This request is no longer waiting for approval.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.profiles WHERE id = p_user_id AND role = 'supervisor' AND org_id IS NULL;
END;
$function$;

-- The profile stays so saved production keeps its attribution; revocation
-- strips the token claims and stops every supervisor check.
CREATE FUNCTION public.remove_supervisor(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(true);
BEGIN
  UPDATE public.factory_supervisors
  SET status = 'removed', decided_at = now(), decided_by = (SELECT auth.uid()), updated_at = now()
  WHERE user_id = p_user_id AND org_id = v_org_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This supervisor is no longer active.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
  SET access_revoked_at = now(), access_revoked_by = (SELECT auth.uid())
  WHERE id = p_user_id;
END;
$function$;

-- Every supervisor ever linked to the owner's factory, for "saved by" labels.
CREATE FUNCTION public.get_supervisor_display_names()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_owner_base_org(false);
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('user_id', membership.user_id, 'full_name', profile.full_name)
      ORDER BY profile.full_name, membership.user_id)
    FROM public.factory_supervisors AS membership
    JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE membership.org_id = v_org_id
  ), '[]'::jsonb);
END;
$function$;

-- ── Supervisor status ───────────────────────────────────────────────────────

CREATE FUNCTION public.get_supervisor_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'status', membership.status,
      'org_id', membership.org_id,
      'factory_name', organization.name,
      'plan_active', private.org_has_active_base(membership.org_id),
      'locked', private.supervisor_org_locked(membership.org_id),
      'today', (now() AT TIME ZONE 'Asia/Kolkata')::date
    )
    FROM public.profiles AS profile
    JOIN public.factory_supervisors AS membership ON membership.user_id = profile.id
    JOIN public.organizations AS organization ON organization.id = membership.org_id
    WHERE profile.id = (SELECT auth.uid())
      AND profile.role = 'supervisor'
      AND profile.access_revoked_at IS NULL
      AND membership.status IN ('pending', 'approved')
  ), jsonb_build_object(
    'status', 'none', 'org_id', NULL, 'factory_name', NULL,
    'plan_active', false, 'locked', false,
    'today', (now() AT TIME ZONE 'Asia/Kolkata')::date
  ));
$function$;

-- ── Joining (server action only, before the supervisor has a session) ───────

CREATE FUNCTION public.lookup_supervisor_join_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_code text := upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF v_code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT jsonb_build_object('org_id', organization.id, 'factory_name', organization.name)
    FROM public.supervisor_join_codes AS code
    JOIN public.organizations AS organization ON organization.id = code.org_id
    WHERE code.code = v_code
      AND code.joining_enabled
      AND NOT private.supervisor_org_locked(organization.id)
      AND private.org_has_active_base(organization.id)
  );
END;
$function$;

CREATE FUNCTION public.register_supervisor_join_request(
  p_user_id uuid, p_code text, p_full_name text, p_email text, p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_factory jsonb := public.lookup_supervisor_join_code(p_code);
  v_name text := btrim(COALESCE(p_full_name, ''));
BEGIN
  IF v_factory IS NULL THEN
    RAISE EXCEPTION 'Check the code with your factory owner.' USING ERRCODE = '22023';
  END IF;
  IF p_user_id IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 80 OR NULLIF(btrim(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'A name, email and account are required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.profiles(id, org_id, role, full_name, email, phone)
  VALUES (p_user_id, NULL, 'supervisor', v_name, lower(btrim(p_email)), NULLIF(btrim(p_phone), ''));
  INSERT INTO public.factory_supervisors(user_id, org_id, status)
  VALUES (p_user_id, (v_factory ->> 'org_id')::uuid, 'pending');
  RETURN v_factory;
END;
$function$;

-- ── Grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION private.require_owner_base_org(boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.unique_supervisor_join_code() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.supervisor_access_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_supervisor_access() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_supervisor_joining(boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.regenerate_supervisor_join_code() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approve_supervisor(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.decline_supervisor(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.remove_supervisor(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_supervisor_display_names() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_supervisor_status() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lookup_supervisor_join_code(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_supervisor_join_request(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_supervisor_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_supervisor_joining(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_supervisor_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supervisor_display_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supervisor_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_supervisor_join_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_supervisor_join_request(uuid, text, text, text, text) TO service_role;
