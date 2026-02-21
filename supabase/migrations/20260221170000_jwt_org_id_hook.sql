-- ============================================================
-- MIGRATION: JWT org_id Custom Claim Hook (PERF-001)
-- ============================================================
-- Creates a Postgres function that Supabase Auth will call to
-- inject org_id into the JWT on every token creation/refresh.
-- This eliminates the per-row subquery in every RLS policy.
--
-- AFTER running this migration, you MUST enable the hook in:
-- Supabase Dashboard → Authentication → Hooks →
--   "Customize Access Token (JWT) Claims" → select this function
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id  UUID;
    v_role    TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := (event->>'user_id')::UUID;

    -- Fetch the user's org_id and role from profiles in a single query
    SELECT p.org_id, p.role
    INTO v_org_id, v_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- Inject into the JWT claims object
    IF v_org_id IS NOT NULL THEN
        event := jsonb_set(event, '{claims,org_id}', to_jsonb(v_org_id::TEXT));
    END IF;

    IF v_role IS NOT NULL THEN
        event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    END IF;

    RETURN event;
END;
$$;

-- Grant the auth admin the right to call this function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for safety
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
