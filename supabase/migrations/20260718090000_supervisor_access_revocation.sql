-- Owner-managed supervisor access revocation.
-- The profile remains in its organization so historical operational records
-- keep a stable actor reference; active authorization rejects revoked profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_supervisors
  ON public.profiles (org_id, full_name)
  WHERE role = 'supervisor' AND access_revoked_at IS NULL;

COMMENT ON COLUMN public.profiles.access_revoked_at IS
  'When set, this profile is retained for historical attribution but cannot access the application.';

COMMENT ON COLUMN public.profiles.access_revoked_by IS
  'Owner profile that removed this account from active factory access.';

-- Do not mint organization or role claims for a revoked profile. The
-- server-side authorization boundary independently checks the same marker.
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
