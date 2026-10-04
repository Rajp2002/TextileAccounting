-- Founder email/password + first TOTP setup follow-up. Generated via Supabase
-- CLI as 20261004105024, ordered after the integrated 153000 dependency point.
-- No identities/grants/factors are created. Only protected intent metadata is
-- written; QR codes, URIs, secrets, passwords and OTPs are never stored here.

ALTER TABLE private.platform_founder_grants
  ADD COLUMN login_email text NOT NULL DEFAULT 'rajpatel86420@gmail.com'
  CHECK (login_email=lower(btrim(login_email)) AND length(login_email) BETWEEN 3 AND 254
    AND login_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$');

CREATE FUNCTION private.admin_founder_grant_valid(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.platform_founder_grants g
    JOIN public.profiles p ON p.id=g.user_id
    JOIN auth.users u ON u.id=g.user_id
    WHERE g.user_id=p_user_id AND g.enabled AND g.revoked_at IS NULL
      AND p.role::text='admin' AND p.access_revoked_at IS NULL
      AND u.email_confirmed_at IS NOT NULL AND lower(btrim(u.email))=g.login_email
  );
$$;
REVOKE ALL ON FUNCTION private.admin_founder_grant_valid(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.admin_founder_identity_valid(p_user_id uuid,p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.admin_founder_grant_valid(p_user_id) AND EXISTS (
    SELECT 1 FROM auth.sessions WHERE user_id=p_user_id AND id=p_session_id AND (not_after IS NULL OR not_after>now())
  );
$$;
REVOKE ALL ON FUNCTION private.admin_founder_identity_valid(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.admin_assert_founder_session(p_actor_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.admin_founder_identity_valid(p_actor_id,p_session_id) OR NOT EXISTS (
    SELECT 1 FROM private.platform_admin_sessions a JOIN auth.sessions s ON s.id=a.session_id AND s.user_id=a.user_id
    WHERE a.session_id=p_session_id AND a.user_id=p_actor_id AND s.aal::text='aal2'
      AND a.revoked_at IS NULL AND a.absolute_expires_at>now()
      AND a.last_interactive_at>now()-interval '15 minutes'
  ) THEN RAISE EXCEPTION 'Founder session denied' USING ERRCODE='42501'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_founder_session(p_user_id uuid,p_session_id uuid,p_operation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_aal text;v_session private.platform_admin_sessions;v_revoked_count bigint;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  IF p_operation IS NULL OR p_operation NOT IN ('candidate','establish','check','touch','revoke') THEN RAISE EXCEPTION 'Invalid session operation' USING ERRCODE='22023'; END IF;
  IF p_operation='revoke' THEN
    -- Restricting access remains possible after an email/profile/grant change.
    UPDATE private.platform_admin_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=p_user_id;
    GET DIAGNOSTICS v_revoked_count=ROW_COUNT;
    IF v_revoked_count>0 THEN
      INSERT INTO private.admin_audit_events(actor_id,session_hash,action,target_type,target_id,outcome,reason_code,after_safe,request_id)
      VALUES(p_user_id,encode(extensions.digest(p_session_id::text,'sha256'),'hex'),'founder.session.revoke','session','all','success','logout',jsonb_build_object('count',v_revoked_count),gen_random_uuid());
    END IF;
    RETURN jsonb_build_object('allowed',true,'revoked',v_revoked_count>0);
  END IF;
  IF NOT private.admin_founder_grant_valid(p_user_id) THEN RETURN jsonb_build_object('allowed',false,'code','FORBIDDEN'); END IF;
  SELECT aal::text INTO v_aal FROM auth.sessions WHERE id=p_session_id AND user_id=p_user_id AND (not_after IS NULL OR not_after>now());
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_EXPIRED'); END IF;
  IF p_operation='candidate' THEN
    IF v_aal IS NULL OR v_aal NOT IN ('aal1','aal2') THEN RETURN jsonb_build_object('allowed',false,'code','MFA_REQUIRED'); END IF;
    RETURN jsonb_build_object('allowed',true);
  END IF;
  IF v_aal IS DISTINCT FROM 'aal2' THEN RETURN jsonb_build_object('allowed',false,'code','MFA_REQUIRED'); END IF;
  IF p_operation='establish' THEN
    INSERT INTO private.platform_admin_sessions(session_id,user_id,absolute_expires_at,aal_verified_at)
    VALUES(p_session_id,p_user_id,now()+interval '8 hours',now()) ON CONFLICT DO NOTHING;
  END IF;
  SELECT * INTO v_session FROM private.platform_admin_sessions WHERE session_id=p_session_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_REQUIRED'); END IF;
  IF v_session.revoked_at IS NOT NULL OR v_session.absolute_expires_at<=now() OR v_session.last_interactive_at<=now()-interval '15 minutes'
    THEN RETURN jsonb_build_object('allowed',false,'code','SESSION_EXPIRED'); END IF;
  IF p_operation='touch' THEN UPDATE private.platform_admin_sessions SET last_interactive_at=now() WHERE session_id=p_session_id; END IF;
  RETURN jsonb_build_object('allowed',true);
END;
$$;

CREATE TABLE private.platform_founder_mfa_setup_intents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  session_id uuid NOT NULL,
  intent_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  factor_id uuid,
  verification_id uuid,
  state text NOT NULL CHECK (state IN ('enrolling','pending','verifying','complete','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK (expires_at<=created_at+interval '10 minutes'),
  CHECK (lease_expires_at<=expires_at),
  CHECK ((state IN ('pending','verifying','complete'))=(factor_id IS NOT NULL) OR state='abandoned'),
  CHECK ((state='verifying')=(verification_id IS NOT NULL))
);
ALTER TABLE private.platform_founder_mfa_setup_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.platform_founder_mfa_setup_intents FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_founder_mfa_setup(
  p_user_id uuid,p_session_id uuid,p_operation text,p_factor_id uuid DEFAULT NULL,p_intent_id uuid DEFAULT NULL,p_verification_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_intent private.platform_founder_mfa_setup_intents;
  v_has_intent boolean;v_aal text;v_provider_factor uuid;v_abandoned_factor uuid;
  v_now timestamptz:=clock_timestamp();v_result jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  IF p_operation IS NULL OR p_operation NOT IN ('begin','bind','status','verify','verify_failed','complete','restart','abandon')
    THEN RAISE EXCEPTION 'Invalid setup operation' USING ERRCODE='22023'; END IF;
  -- Per-user serialization is shared by enrollment, verification and restart.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('weavly-founder-mfa:'||p_user_id::text,0));
  v_now:=clock_timestamp();
  IF NOT private.admin_founder_identity_valid(p_user_id,p_session_id) THEN RETURN jsonb_build_object('allowed',false,'code','FORBIDDEN'); END IF;
  SELECT s.aal::text,s.factor_id INTO v_aal,v_provider_factor FROM auth.sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id;
  IF (p_operation='complete' AND v_aal IS DISTINCT FROM 'aal2')
    OR (p_operation NOT IN ('complete','status') AND v_aal IS DISTINCT FROM 'aal1')
    OR (p_operation='status' AND (v_aal IS NULL OR v_aal NOT IN ('aal1','aal2')))
    THEN RETURN jsonb_build_object('allowed',false,'code','MFA_REQUIRED'); END IF;
  SELECT * INTO v_intent FROM private.platform_founder_mfa_setup_intents WHERE user_id=p_user_id FOR UPDATE;
  v_has_intent:=FOUND;
  IF p_operation='status' THEN
    IF NOT v_has_intent THEN RETURN jsonb_build_object('allowed',true,'status','none'); END IF;
    IF v_intent.session_id<>p_session_id THEN
      IF v_intent.expires_at<=v_now OR v_intent.state='abandoned' THEN
        RETURN jsonb_build_object('allowed',true,'status','none');
      END IF;
      RETURN jsonb_build_object('allowed',false,'code','SETUP_IN_PROGRESS',
        'retryAfterSeconds',greatest(1,ceil(extract(epoch FROM (v_intent.expires_at-v_now)))::integer));
    END IF;
    RETURN jsonb_build_object('allowed',true,'intentId',v_intent.intent_id,'factorId',v_intent.factor_id,'status',v_intent.state,'expiresAt',v_intent.expires_at,
      'retryAfterSeconds',greatest(0,ceil(extract(epoch FROM (v_intent.lease_expires_at-v_now)))::integer));
  END IF;
  IF p_operation IN ('begin','restart') THEN
    -- SQL never edits provider factors and never permits replacing a verified
    -- TOTP/phone factor through the first-enrollment path.
    IF EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id=p_user_id AND status::text='verified')
      THEN RETURN jsonb_build_object('allowed',false,'code','EXISTING_FACTOR'); END IF;
    IF v_has_intent AND v_intent.state NOT IN ('abandoned','complete') AND v_intent.expires_at>v_now THEN
      IF p_operation='begin' OR v_intent.session_id<>p_session_id OR v_intent.lease_expires_at>v_now
        THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_IN_PROGRESS','retryAfterSeconds',greatest(1,ceil(extract(epoch FROM (least(v_intent.lease_expires_at,v_intent.expires_at)-v_now)))::integer)); END IF;
    END IF;
    IF p_operation='restart' AND v_has_intent AND (v_intent.session_id<>p_session_id OR p_intent_id IS DISTINCT FROM v_intent.intent_id)
      THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_MISMATCH'); END IF;
    IF v_has_intent AND v_intent.factor_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.mfa_factors WHERE id=v_intent.factor_id AND user_id=p_user_id AND status::text='unverified' AND factor_type::text='totp'
    ) THEN v_abandoned_factor:=v_intent.factor_id; END IF;
    INSERT INTO private.platform_founder_mfa_setup_intents(user_id,session_id,intent_id,state,created_at,updated_at,lease_expires_at,expires_at)
    VALUES(p_user_id,p_session_id,gen_random_uuid(),'enrolling',v_now,v_now,v_now+interval '30 seconds',v_now+interval '10 minutes')
    ON CONFLICT(user_id) DO UPDATE SET session_id=excluded.session_id,intent_id=excluded.intent_id,factor_id=NULL,state=excluded.state,
      created_at=excluded.created_at,updated_at=excluded.updated_at,lease_expires_at=excluded.lease_expires_at,expires_at=excluded.expires_at,completed_at=NULL,verification_id=NULL
    RETURNING * INTO v_intent;
  ELSE
    IF NOT v_has_intent OR v_intent.session_id<>p_session_id OR p_intent_id IS DISTINCT FROM v_intent.intent_id
      THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_MISMATCH'); END IF;
    IF v_intent.expires_at<=v_now OR v_intent.state='abandoned' THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_EXPIRED'); END IF;
    IF p_operation='bind' THEN
      IF p_factor_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE id=p_factor_id AND user_id=p_user_id AND factor_type::text='totp' AND status::text='unverified')
        THEN RETURN jsonb_build_object('allowed',false,'code','FACTOR_NOT_PENDING'); END IF;
      IF v_intent.state='pending' AND p_factor_id=v_intent.factor_id THEN
        RETURN jsonb_build_object('allowed',true,'intentId',v_intent.intent_id,'factorId',v_intent.factor_id,'status',v_intent.state,'expiresAt',v_intent.expires_at);
      END IF;
      IF v_intent.state<>'enrolling' OR v_intent.lease_expires_at<=v_now THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_EXPIRED'); END IF;
      UPDATE private.platform_founder_mfa_setup_intents SET factor_id=p_factor_id,state='pending',updated_at=v_now WHERE user_id=p_user_id RETURNING * INTO v_intent;
    ELSIF p_operation IN ('verify','verify_failed') THEN
      IF p_factor_id IS NULL OR p_factor_id IS DISTINCT FROM v_intent.factor_id OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE id=p_factor_id AND user_id=p_user_id AND factor_type::text='totp' AND status::text='unverified')
        THEN RETURN jsonb_build_object('allowed',false,'code','FACTOR_NOT_PENDING'); END IF;
      IF p_operation='verify' THEN
        IF v_intent.state='verifying' AND v_intent.lease_expires_at>v_now
          THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_IN_PROGRESS','retryAfterSeconds',greatest(1,ceil(extract(epoch FROM (v_intent.lease_expires_at-v_now)))::integer)); END IF;
        IF v_intent.state NOT IN ('pending','verifying') THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_MISMATCH'); END IF;
        UPDATE private.platform_founder_mfa_setup_intents SET state='verifying',verification_id=gen_random_uuid(),updated_at=v_now,lease_expires_at=least(v_now+interval '30 seconds',expires_at) WHERE user_id=p_user_id RETURNING * INTO v_intent;
      ELSE
        IF v_intent.state<>'verifying' OR p_verification_id IS NULL OR p_verification_id IS DISTINCT FROM v_intent.verification_id
          THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_MISMATCH'); END IF;
        UPDATE private.platform_founder_mfa_setup_intents SET state='pending',verification_id=NULL,updated_at=v_now,lease_expires_at=v_now WHERE user_id=p_user_id RETURNING * INTO v_intent;
      END IF;
    ELSIF p_operation='complete' THEN
      IF p_factor_id IS NULL OR p_factor_id IS DISTINCT FROM v_intent.factor_id OR v_provider_factor IS DISTINCT FROM p_factor_id
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE id=p_factor_id AND user_id=p_user_id AND factor_type::text='totp' AND status::text='verified')
        THEN RETURN jsonb_build_object('allowed',false,'code','FACTOR_NOT_PENDING'); END IF;
      IF v_intent.state NOT IN ('verifying','complete') THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_MISMATCH'); END IF;
      UPDATE private.platform_founder_mfa_setup_intents SET state='complete',verification_id=NULL,completed_at=coalesce(completed_at,v_now),updated_at=v_now,lease_expires_at=v_now WHERE user_id=p_user_id RETURNING * INTO v_intent;
    ELSIF p_operation='abandon' THEN
      IF v_intent.state='complete' OR (v_intent.state='verifying' AND v_intent.lease_expires_at>v_now)
        THEN RETURN jsonb_build_object('allowed',false,'code','SETUP_IN_PROGRESS'); END IF;
      UPDATE private.platform_founder_mfa_setup_intents SET state='abandoned',verification_id=NULL,updated_at=v_now,lease_expires_at=v_now,expires_at=v_now WHERE user_id=p_user_id RETURNING * INTO v_intent;
    END IF;
  END IF;
  INSERT INTO private.admin_audit_events(actor_id,session_hash,action,target_type,target_id,outcome,reason_code,after_safe,request_id)
  VALUES(p_user_id,encode(extensions.digest(p_session_id::text,'sha256'),'hex'),'founder.mfa.setup.'||p_operation,'auth_setup',v_intent.intent_id::text,'success','first_totp_setup',jsonb_build_object('status',v_intent.state),gen_random_uuid());
  v_result:=jsonb_build_object('allowed',true,'intentId',v_intent.intent_id,'factorId',v_intent.factor_id,'status',v_intent.state,'expiresAt',v_intent.expires_at);
  IF v_intent.verification_id IS NOT NULL THEN v_result:=v_result||jsonb_build_object('verificationId',v_intent.verification_id); END IF;
  IF v_abandoned_factor IS NOT NULL THEN v_result:=v_result||jsonb_build_object('abandonedFactorId',v_abandoned_factor); END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_founder_mfa_setup(uuid,uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_founder_mfa_setup(uuid,uuid,text,uuid,uuid,uuid) TO service_role;
