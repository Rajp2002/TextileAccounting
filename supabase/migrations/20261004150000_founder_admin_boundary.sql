-- AD01: additive platform boundary. No founder identity/grant/session is seeded.
-- Created with Supabase CLI as 20261004092626, ordered after the reconciled
-- baseline per AD00 to avoid an earlier timestamp preceding Free migrations.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.platform_founder_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  enabled boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  grant_reason text NOT NULL CHECK (length(btrim(grant_reason)) BETWEEN 3 AND 500),
  created_by uuid REFERENCES auth.users(id),
  CHECK (NOT enabled OR revoked_at IS NULL)
);
CREATE UNIQUE INDEX one_enabled_platform_founder ON private.platform_founder_grants ((enabled)) WHERE enabled;

CREATE TABLE private.platform_admin_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_interactive_at timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  aal_verified_at timestamptz NOT NULL,
  CHECK (last_interactive_at >= created_at),
  CHECK (absolute_expires_at <= created_at + interval '8 hours')
);
CREATE INDEX platform_admin_sessions_user ON private.platform_admin_sessions (user_id, absolute_expires_at);

CREATE TABLE private.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash text,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  target_type text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 60),
  target_id text NOT NULL CHECK (length(target_id) BETWEEN 1 AND 200),
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  reason_code text CHECK (length(reason_code) <= 80),
  before_safe jsonb,
  after_safe jsonb,
  request_id uuid NOT NULL
);
CREATE INDEX admin_audit_events_page ON private.admin_audit_events (occurred_at DESC, id DESC);

ALTER TABLE private.platform_founder_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.platform_founder_grants, private.platform_admin_sessions, private.admin_audit_events FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.admin_assert_founder_session(p_actor_id uuid, p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.platform_founder_grants g
    JOIN public.profiles p ON p.id = g.user_id
    JOIN auth.sessions s ON s.user_id = g.user_id AND s.id = p_session_id
    JOIN private.platform_admin_sessions a ON a.user_id = g.user_id AND a.session_id = s.id
    WHERE g.user_id = p_actor_id AND g.enabled AND g.revoked_at IS NULL
      AND p.role::text = 'admin' AND p.access_revoked_at IS NULL
      AND s.aal::text = 'aal2' AND (s.not_after IS NULL OR s.not_after > now())
      AND a.revoked_at IS NULL AND a.absolute_expires_at > now()
      AND a.last_interactive_at > now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'Founder session denied' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION private.admin_safe_audit_values(p_values jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_values IS NULL OR (
    jsonb_typeof(p_values) = 'object' AND length(p_values::text) <= 2000
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(p_values) e WHERE
      e.key NOT IN ('status','priority','category','version','needsFounderReply','nextUpdateDueAt','followUpDueAt','resolutionCode','source','requesterBound','kind','count','mode','verificationState','reasonCode')
      OR jsonb_typeof(e.value) NOT IN ('string','number','boolean','null')
      OR length(e.value::text) > 200)
  );
$$;

CREATE FUNCTION private.admin_append_audit(
  p_actor_id uuid, p_session_id uuid, p_action text, p_target_type text,
  p_target_id text, p_outcome text, p_request_id uuid,
  p_reason_code text DEFAULT NULL, p_before_safe jsonb DEFAULT NULL, p_after_safe jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  IF p_action !~ '^[a-zA-Z0-9_.:-]{1,100}$' OR p_target_type !~ '^[a-zA-Z0-9_.:-]{1,60}$'
     OR p_target_id !~ '^[a-zA-Z0-9_.:/-]{1,200}$'
     OR (p_reason_code IS NOT NULL AND p_reason_code !~ '^[a-zA-Z0-9_.:-]{1,80}$')
     OR NOT private.admin_safe_audit_values(p_before_safe) OR NOT private.admin_safe_audit_values(p_after_safe)
  THEN RAISE EXCEPTION 'Audit metadata is not allowlisted' USING ERRCODE = '22023'; END IF;
  INSERT INTO private.admin_audit_events(actor_id,session_hash,action,target_type,target_id,outcome,request_id,reason_code,before_safe,after_safe)
  VALUES (p_actor_id,encode(extensions.digest(p_session_id::text,'sha256'),'hex'),p_action,p_target_type,p_target_id,p_outcome,p_request_id,p_reason_code,p_before_safe,p_after_safe)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The exposed functions are fixed service-only operations. Auth schema remains
-- private, and no provider session details are returned through the Data API.
CREATE FUNCTION public.admin_founder_session(p_user_id uuid,p_session_id uuid,p_operation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_aal text; v_session private.platform_admin_sessions; v_revoked_count bigint;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Server operation required' USING ERRCODE = '42501';
  END IF;
  IF p_operation NOT IN ('candidate','establish','check','touch','revoke') THEN
    RAISE EXCEPTION 'Invalid session operation' USING ERRCODE = '22023';
  END IF;
  IF p_operation = 'revoke' THEN
    -- Tombstones outlive provider session deletion and prevent re-establishment.
    UPDATE private.platform_admin_sessions SET revoked_at = coalesce(revoked_at,now())
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
    IF v_revoked_count > 0 THEN
      INSERT INTO private.admin_audit_events(actor_id,session_hash,action,target_type,target_id,outcome,reason_code,after_safe,request_id)
      VALUES(p_user_id,encode(extensions.digest(p_session_id::text,'sha256'),'hex'),'founder.session.revoke','session','all','success','logout',jsonb_build_object('count',v_revoked_count),gen_random_uuid());
    END IF;
    RETURN jsonb_build_object('allowed',true,'revoked',v_revoked_count > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.platform_founder_grants g JOIN public.profiles p ON p.id=g.user_id
      WHERE g.user_id=p_user_id AND g.enabled AND g.revoked_at IS NULL AND p.role::text='admin' AND p.access_revoked_at IS NULL)
  THEN RETURN jsonb_build_object('allowed',false,'code','FORBIDDEN'); END IF;
  SELECT s.aal::text INTO v_aal FROM auth.sessions s
  WHERE s.id=p_session_id AND s.user_id=p_user_id AND (s.not_after IS NULL OR s.not_after > now());
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_EXPIRED'); END IF;
  IF p_operation='candidate' THEN RETURN jsonb_build_object('allowed',true); END IF;
  IF v_aal IS DISTINCT FROM 'aal2' THEN RETURN jsonb_build_object('allowed',false,'code','MFA_REQUIRED'); END IF;
  -- Concurrent establishment is serialized by the unique key. Conflicts are
  -- never updated: refresh/MFA retry cannot resurrect or reset an old session.
  IF p_operation='establish' THEN
    INSERT INTO private.platform_admin_sessions(session_id,user_id,absolute_expires_at,aal_verified_at)
    VALUES(p_session_id,p_user_id,now()+interval '8 hours',now()) ON CONFLICT DO NOTHING;
  END IF;
  SELECT * INTO v_session FROM private.platform_admin_sessions WHERE session_id=p_session_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_REQUIRED'); END IF;
  IF v_session.revoked_at IS NOT NULL OR v_session.absolute_expires_at <= now()
     OR v_session.last_interactive_at <= now()-interval '15 minutes'
  THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_EXPIRED'); END IF;
  IF p_operation='touch' THEN UPDATE private.platform_admin_sessions SET last_interactive_at=now() WHERE session_id=p_session_id; END IF;
  RETURN jsonb_build_object('allowed',true);
END;
$$;

CREATE FUNCTION public.admin_record_audit(
  p_actor_id uuid,p_session_id uuid,p_action text,p_target_type text,p_target_id text,p_outcome text,
  p_request_id uuid,p_reason_code text DEFAULT NULL,p_before_safe jsonb DEFAULT NULL,p_after_safe jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  RETURN private.admin_append_audit(p_actor_id,p_session_id,p_action,p_target_type,p_target_id,p_outcome,p_request_id,p_reason_code,p_before_safe,p_after_safe);
END;
$$;

REVOKE ALL ON FUNCTION private.admin_assert_founder_session(uuid,uuid),private.admin_safe_audit_values(jsonb),private.admin_append_audit(uuid,uuid,text,text,text,text,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_founder_session(uuid,uuid,text),public.admin_record_audit(uuid,uuid,text,text,text,text,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_founder_session(uuid,uuid,text),public.admin_record_audit(uuid,uuid,text,text,text,text,uuid,text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.admin_record_denial(p_actor_id uuid,p_session_id uuid,p_reason_code text,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  IF p_reason_code NOT IN ('FORBIDDEN','MFA_REQUIRED','SESSION_REQUIRED','SESSION_EXPIRED','UNAUTHENTICATED')
  THEN RAISE EXCEPTION 'Invalid denial reason' USING ERRCODE='22023'; END IF;
  -- Provider-bound identity suffices to log a denial; this does not grant access
  -- or reveal audit records. Already-deleted provider sessions supply no actor.
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id=p_session_id AND user_id=p_actor_id) THEN RETURN NULL; END IF;
  INSERT INTO private.admin_audit_events(actor_id,session_hash,action,target_type,target_id,outcome,reason_code,request_id)
  VALUES(p_actor_id,encode(extensions.digest(p_session_id::text,'sha256'),'hex'),'founder.access','console','admin','denied',p_reason_code,p_request_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_record_denial(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_denial(uuid,uuid,text,uuid) TO service_role;

-- Retire generic-admin direct cross-factory access. Retained formal workflows
-- use individually founder-guarded server methods; tenant/public policies stay.
DROP POLICY IF EXISTS "Admins view all grievances" ON public.grievances;
DROP POLICY IF EXISTS "Admins manage all grievances" ON public.grievances;
DROP POLICY IF EXISTS "Admins manage notice registry" ON public.notice_registry;
DROP POLICY IF EXISTS "Admins view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admins manage compliance settings" ON public.compliance_settings;
DROP POLICY IF EXISTS "Admins manage dpas" ON public.dpas;
DROP POLICY IF EXISTS "Admins manage organization_dpas" ON public.organization_dpas;
DROP POLICY IF EXISTS "Admins view all breach reports" ON public.breach_reports;
DROP POLICY IF EXISTS "View active dpas" ON public.dpas;
CREATE POLICY "View active dpas" ON public.dpas FOR SELECT USING (is_active=true);
DROP POLICY IF EXISTS platform_security_admin_control ON public.platform_security;
DROP POLICY IF EXISTS audit_log_admin_global_security_insert ON public.audit_log;
DROP POLICY IF EXISTS requires_premium_subscription ON public.audit_log;
CREATE POLICY requires_premium_subscription ON public.audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (public.org_has_subscription_tier(org_id,'premium')) WITH CHECK (public.org_has_subscription_tier(org_id,'premium'));
REVOKE EXECUTE ON FUNCTION public.emergency_lockdown() FROM PUBLIC,anon,authenticated,service_role;
REVOKE UPDATE ON public.platform_security FROM authenticated;
REVOKE UPDATE (is_locked_down,locked_at,locked_by) ON public.platform_security FROM authenticated;

-- Preserve the existing tenant isolation implementations outside the exposed
-- API and wrap them in a current founder/session-bound server-only operation.
ALTER FUNCTION public.lockdown_tenant(uuid,text,text,uuid) SET SCHEMA private;
ALTER FUNCTION public.unlock_tenant(uuid,uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.lockdown_tenant(uuid,text,text,uuid),private.unlock_tenant(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lockdown_tenant(uuid,text,text),public.unlock_tenant(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.admin_legacy_lockdown_tenant(p_org_id uuid,p_reason text,p_severity text,p_actor_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
  result:=private.lockdown_tenant(p_org_id,p_reason,p_severity,p_actor_id);
  PERFORM private.admin_append_audit(p_actor_id,p_session_id,'legacy.tenant.lock','factory',p_org_id::text,'success',gen_random_uuid(),'legacy_operation',NULL,jsonb_build_object('status','locked'));
  RETURN result;
END;
$$;
CREATE FUNCTION public.admin_legacy_unlock_tenant(p_org_id uuid,p_actor_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
  result:=private.unlock_tenant(p_org_id,p_actor_id);
  PERFORM private.admin_append_audit(p_actor_id,p_session_id,'legacy.tenant.unlock','factory',p_org_id::text,'success',gen_random_uuid(),'legacy_operation',NULL,jsonb_build_object('status','unlocked'));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_legacy_lockdown_tenant(uuid,text,text,uuid,uuid),public.admin_legacy_unlock_tenant(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_legacy_lockdown_tenant(uuid,text,text,uuid,uuid),public.admin_legacy_unlock_tenant(uuid,uuid,uuid) TO service_role;
