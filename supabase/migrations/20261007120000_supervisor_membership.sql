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
