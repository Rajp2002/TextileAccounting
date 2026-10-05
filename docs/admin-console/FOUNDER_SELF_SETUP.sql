-- Reviewed manual setup template; NOT a migration or automatically executed.
-- Run only in the verified Supabase project, as postgres, after the complete
-- console migration set and identity/security setup approval. Keep admin gates
-- closed until real Auth/MFA/recovery acceptance. Enter no password here.
-- Replace the one UUID placeholder with YOUR copied Auth user UUID.
BEGIN;
DO $founder_setup$
DECLARE
  founder_id uuid := 'PASTE_YOUR_AUTH_USER_UUID_HERE'::uuid;
  founder_email constant text := 'rajpatel86420@gmail.com';
  existing_profile public.profiles%ROWTYPE;
  existing_grant private.platform_founder_grants%ROWTYPE;
  changed boolean := false;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed setup in SQL Editor with the postgres role.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('weavly-founder-setup:' || founder_id::text, 0));
  PERFORM 1 FROM auth.users
    WHERE id = founder_id AND lower(btrim(email)) = founder_email
      AND email_confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UUID/email not found or email unconfirmed. Verify the Auth user before setup.';
  END IF;
  -- A missing profile does not mean the Auth identity is a new/dedicated
  -- founder. Existing organization ownership survives profile deletion.
  IF EXISTS (SELECT 1 FROM public.organizations WHERE owner_id = founder_id) THEN
    RAISE EXCEPTION 'Account still owns a factory. Stop for reviewed account separation; nothing was changed.';
  END IF;
  SELECT * INTO existing_profile FROM public.profiles WHERE id = founder_id FOR UPDATE;
  IF FOUND THEN
    IF existing_profile.role IS DISTINCT FROM 'admin'
       OR existing_profile.org_id IS NOT NULL
       OR existing_profile.access_revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Existing profile is customer-linked, non-admin or revoked. Stop for reviewed account setup; nothing was changed.';
    END IF;
  ELSE
    INSERT INTO public.profiles (id, role, org_id, email)
      VALUES (founder_id, 'admin', NULL, founder_email);
    changed := true;
  END IF;
  IF EXISTS (SELECT 1 FROM private.platform_founder_grants
             WHERE enabled AND user_id <> founder_id) THEN
    RAISE EXCEPTION 'Another founder grant is enabled. Stop for an explicit grant review; nothing was changed.';
  END IF;
  SELECT * INTO existing_grant FROM private.platform_founder_grants
    WHERE user_id = founder_id FOR UPDATE;
  IF FOUND THEN
    IF NOT existing_grant.enabled OR existing_grant.revoked_at IS NOT NULL
       OR existing_grant.login_email IS DISTINCT FROM founder_email THEN
      RAISE EXCEPTION 'Existing grant is disabled, revoked or bound differently. Stop for an explicit grant review; nothing was changed.';
    END IF;
  ELSE
    INSERT INTO private.platform_founder_grants
      (user_id, enabled, login_email, grant_reason, created_by)
    VALUES (founder_id, true, founder_email,
      'Founder self-setup performed by project owner in SQL Editor', NULL);
    changed := true;
  END IF;
  IF changed THEN
    -- Operator action has no verified application principal/session. Do not
    -- pretend the recipient UUID identifies an authenticated application actor.
    INSERT INTO private.admin_audit_events
      (actor_id, session_hash, action, target_type, target_id, outcome,
       reason_code, before_safe, after_safe, request_id)
    VALUES (NULL, NULL, 'founder.provision', 'founder', founder_id::text,
      'success', 'operator_setup', NULL,
      jsonb_build_object('status', 'enabled', 'kind', 'founder_setup'),
      gen_random_uuid());
  END IF;
END;
$founder_setup$;
COMMIT;
