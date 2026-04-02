-- ============================================================
-- MIGRATION: JWT App Metadata Custom Claim Update
-- ============================================================
-- Updates the Postgres auth hook that Supabase Auth calls to
-- inject org_id and role into BOTH the root `claims` object 
-- AND the `app_metadata` object.
-- 
-- Root `claims`: Keeps all 50+ existing RLS policies working flawlessly.
-- `app_metadata`: Exposes the O(1) properties natively to Next.js Server Components.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id              UUID;
    v_role                TEXT;
    v_fullname            TEXT;
    v_onboarding_complete BOOLEAN;
    v_user_id             UUID;
BEGIN
    v_user_id := (event->>'user_id')::UUID;

    -- Fetch the user's details from profiles in a single query
    SELECT p.org_id, p.role, p.full_name
    INTO v_org_id, v_role, v_fullname
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- If no profile found (race condition during signup), return unchanged
    IF v_org_id IS NULL THEN
        RETURN event;
    END IF;

    -- Fetch onboarding_complete from organizations
    SELECT o.onboarding_complete
    INTO v_onboarding_complete
    FROM public.organizations o
    WHERE o.id = v_org_id;

    -- Create app_metadata object if it doesn't exist
    IF event->'claims'->'app_metadata' IS NULL THEN
        event := jsonb_set(event, '{claims,app_metadata}', '{}'::jsonb);
    END IF;

    -- Inject into BOTH root claims and app_metadata
    IF v_org_id IS NOT NULL THEN
        -- Legacy root claim for backend RLS
        event := jsonb_set(event, '{claims,org_id}', to_jsonb(v_org_id::TEXT));
        -- New app_metadata claim for frontend Next.js Server Components
        event := jsonb_set(event, '{claims,app_metadata,org_id}', to_jsonb(v_org_id::TEXT));
    END IF;

    IF v_role IS NOT NULL THEN
        -- Legacy root claim for backend RLS
        event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
        -- New app_metadata claim for frontend Next.js Server Components
        event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(v_role));
    END IF;

    IF v_fullname IS NOT NULL THEN
        event := jsonb_set(event, '{claims,app_metadata,full_name}', to_jsonb(v_fullname));
    END IF;

    event := jsonb_set(event, '{claims,onboarding_complete}', to_jsonb(COALESCE(v_onboarding_complete, false)));
    event := jsonb_set(event, '{claims,app_metadata,onboarding_complete}', to_jsonb(COALESCE(v_onboarding_complete, false)));

    RETURN event;
END;
$$;

-- Ensure permissions remain intact
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
