-- Additive runtime integration; enrollment remains disabled.
ALTER TABLE public.free_account_subjects ADD COLUMN tour_state text NOT NULL DEFAULT 'new' CHECK (tour_state IN ('new','completed','skipped'));
ALTER TABLE public.free_account_subjects ADD COLUMN analytics_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE public.free_account_subjects DROP CONSTRAINT free_account_subjects_id_fkey;
ALTER TABLE public.free_account_subjects ADD FOREIGN KEY(id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.free_account_grants DROP CONSTRAINT free_account_grants_org_id_fkey;
ALTER TABLE public.free_account_grants ADD FOREIGN KEY(org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.free_account_grants DROP CONSTRAINT free_account_grants_subject_id_fkey;
ALTER TABLE public.free_account_grants ADD FOREIGN KEY(subject_id) REFERENCES public.free_account_subjects(id) ON DELETE CASCADE;
ALTER TABLE public.free_weekly_usage DROP CONSTRAINT free_weekly_usage_subject_id_fkey;
ALTER TABLE public.free_weekly_usage ADD FOREIGN KEY(subject_id) REFERENCES public.free_account_subjects(id) ON DELETE CASCADE;
ALTER TABLE public.free_calculation_receipts DROP CONSTRAINT free_calculation_receipts_subject_id_period_start_fkey;
ALTER TABLE public.free_calculation_receipts ADD FOREIGN KEY(subject_id,period_start) REFERENCES public.free_weekly_usage(subject_id,period_start) ON DELETE CASCADE;

CREATE TABLE public.free_funnel_events (
  subject_id uuid NOT NULL REFERENCES public.free_account_subjects(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN ('signup_completed','tour_completed','tour_skipped','calculation_completed','result_viewed','quota_reached','locked_feature_requested','upgrade_started','paid_activation')),
  version integer NOT NULL DEFAULT 1 CHECK (version=1),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  language text CHECK (language IN ('en','gu','hi')),
  entry_point text CHECK (entry_point IN ('signup','estimator','tour','save','rate_book','quota','billing')),
  PRIMARY KEY(subject_id,event_name,event_id)
);
ALTER TABLE public.free_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_funnel_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.free_funnel_events TO service_role;

CREATE FUNCTION public.provision_free_account(p_user_id uuid,p_org_id uuid,p_verified_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_verified_at IS NULL OR p_verified_at > now() THEN RAISE EXCEPTION 'FREE_VERIFICATION_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.free_rollout WHERE singleton AND enrollment_enabled) THEN RAISE EXCEPTION 'FREE_PAUSED'; END IF;
  PERFORM 1 FROM public.organizations o JOIN public.profiles p ON p.org_id=o.id
    WHERE o.id=p_org_id AND o.owner_id=p_user_id AND p.id=p_user_id AND p.role='owner'
      AND p.access_revoked_at IS NULL AND NOT coalesce(o.is_locked_down,false) FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.free_account_grants WHERE org_id=p_org_id AND subject_id=p_user_id) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.org_subscriptions WHERE org_id=p_org_id) THEN RAISE EXCEPTION 'FREE_EXISTING_ACCOUNT'; END IF;
  INSERT INTO public.free_account_subjects(id,verified_at,beta_allowed) VALUES(p_user_id,p_verified_at,true) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.free_account_grants(org_id,subject_id) VALUES(p_org_id,p_user_id);
  UPDATE public.organizations SET onboarding_complete=true WHERE id=p_org_id;
  INSERT INTO public.free_funnel_events(subject_id,event_id,event_name,entry_point)
    VALUES(p_user_id,p_org_id,'signup_completed','signup') ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.provision_free_account(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_free_account(uuid,uuid,timestamptz) TO service_role;

CREATE SCHEMA IF NOT EXISTS weavly_private;
REVOKE ALL ON SCHEMA weavly_private FROM PUBLIC;
GRANT USAGE ON SCHEMA weavly_private TO authenticated,service_role;
CREATE FUNCTION weavly_private.free_business_restricted(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.free_account_grants g ON g.org_id=p.org_id
    WHERE p.id=auth.uid() AND p.org_id=p_org_id
  ) AND NOT public.org_has_subscription_tier(p_org_id,'base');
$$;
REVOKE ALL ON FUNCTION weavly_private.free_business_restricted(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION weavly_private.free_business_restricted(uuid) TO authenticated,service_role;

-- Restrictive policies also cover direct database clients and Realtime; they
-- never broaden an existing tenant/role policy. Billing/account records remain
-- governed by their original tenant policies and are not costing content.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT DISTINCT ON (c.table_name) c.table_name,c.column_name
  FROM information_schema.columns c JOIN pg_class t ON t.relname=c.table_name
  JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname=c.table_schema
  WHERE c.table_schema='public' AND t.relkind IN ('r','p') AND c.column_name IN ('org_id','factory_id')
    AND c.table_name NOT LIKE 'free_%'
    AND c.table_name NOT IN ('profiles','organizations','org_subscriptions','subscription_payments','billing_checkout_attempts','billing_invoices','audit_log','legal_acceptances','referrals','referral_rewards')
  ORDER BY c.table_name,c.column_name
 LOOP
  EXECUTE format('CREATE POLICY free_business_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT weavly_private.free_business_restricted(%I)) WITH CHECK (NOT weavly_private.free_business_restricted(%I))',r.table_name,r.column_name,r.column_name);
 END LOOP;
END $$;

-- Data API pre-request guard additionally protects SECURITY DEFINER RPCs and
-- views. An existing hook must be composed deliberately rather than overwritten.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles,unnest(rolconfig) AS setting WHERE rolname='authenticator'
   AND setting LIKE 'pgrst.db_pre_request=%' AND setting <> 'pgrst.db_pre_request=weavly_private.free_api_guard'
   AND setting <> 'pgrst.db_pre_request=') THEN
   RAISE EXCEPTION 'Existing PostgREST pre-request hook requires explicit composition before this migration';
 END IF;
END $$;
CREATE FUNCTION weavly_private.free_api_guard() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_org uuid; v_path text := trim(both '/' from coalesce(current_setting('request.path',true),''));
 v_method text := current_setting('request.method',true);
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'role','') <> 'authenticated' THEN RETURN; END IF;
 SELECT org_id INTO v_org FROM public.profiles WHERE id=auth.uid();
 IF NOT weavly_private.free_business_restricted(v_org) THEN RETURN; END IF;
 IF v_method IN ('GET','HEAD') AND v_path IN ('profiles','organizations','org_subscriptions','subscription_payments','billing_checkout_attempts','billing_invoices') THEN RETURN; END IF;
 IF v_method='POST' AND v_path='rpc/delete_account_permanently' THEN RETURN; END IF;
 RAISE EXCEPTION 'FREE_BUSINESS_ACCESS_DENIED' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION weavly_private.free_api_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION weavly_private.free_api_guard() TO authenticated,service_role,authenticator;
ALTER ROLE authenticator SET pgrst.db_pre_request='weavly_private.free_api_guard';
NOTIFY pgrst,'reload config';

-- Fixed-schema server-success events share the receipt transaction.
CREATE FUNCTION weavly_private.free_receipt_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$ BEGIN
 INSERT INTO public.free_funnel_events(subject_id,event_id,event_name,entry_point)
 VALUES(NEW.subject_id,NEW.request_id,'calculation_completed','estimator') ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
CREATE TRIGGER free_receipt_event AFTER INSERT ON public.free_calculation_receipts FOR EACH ROW EXECUTE FUNCTION weavly_private.free_receipt_event();

CREATE FUNCTION public.prune_free_operational_metadata() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 DELETE FROM public.free_calculation_receipts WHERE expires_at <= now();
 DELETE FROM public.free_funnel_events WHERE occurred_at < now()-interval '90 days';
 DELETE FROM public.free_weekly_usage u WHERE period_end < now()-interval '90 days'
   AND NOT EXISTS(SELECT 1 FROM public.free_calculation_receipts r WHERE r.subject_id=u.subject_id AND r.period_start=u.period_start);
$$;
REVOKE ALL ON FUNCTION public.prune_free_operational_metadata() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_free_operational_metadata() TO service_role;
COMMENT ON FUNCTION public.prune_free_operational_metadata() IS 'Service-only scheduled retention: expired receipts, 90-day event/cohort and weekly aggregates. Activate daily schedule only with reviewed retention policy.';
GRANT USAGE ON SCHEMA weavly_private TO anon;
GRANT EXECUTE ON FUNCTION weavly_private.free_api_guard() TO anon;
CREATE FUNCTION weavly_private.free_current_restricted() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce((SELECT weavly_private.free_business_restricted(p.org_id) FROM public.profiles p WHERE p.id=auth.uid()),false);
$$;
REVOKE ALL ON FUNCTION weavly_private.free_current_restricted() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION weavly_private.free_current_restricted() TO authenticated,service_role;
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  CREATE POLICY free_storage_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
   USING(NOT weavly_private.free_current_restricted()) WITH CHECK(NOT weavly_private.free_current_restricted());
 END IF;
END $$;
CREATE FUNCTION public.free_server_time() RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT now(); $$;
REVOKE ALL ON FUNCTION public.free_server_time() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.free_server_time() TO service_role;

-- Activation events follow the existing verified, atomic billing transaction.
-- A client callback, pending order or unpaid status cannot create this event.
CREATE FUNCTION weavly_private.free_paid_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NEW.status='captured' AND NEW.razorpay_payment_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.org_subscriptions s WHERE s.id=NEW.subscription_id AND s.org_id=NEW.org_id
    AND s.razorpay_payment_id=NEW.razorpay_payment_id AND s.status='active'
 ) THEN
  INSERT INTO public.free_funnel_events(subject_id,event_id,event_name,entry_point)
   SELECT subject_id,subject_id,'paid_activation','billing' FROM public.free_account_grants WHERE org_id=NEW.org_id
   ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER free_paid_event AFTER INSERT OR UPDATE OF status ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION weavly_private.free_paid_event();

-- Restricted service-only operational/cohort views. No costing content exists.
CREATE VIEW public.free_support_status WITH (security_invoker=true) AS
 SELECT s.id AS subject_id,g.org_id,s.active,s.verified_at IS NOT NULL AS verified,s.beta_allowed,
  u.period_start,u.period_end,u.used,u.allowance,g.revoked_at
 FROM public.free_account_subjects s JOIN public.free_account_grants g ON g.subject_id=s.id
 LEFT JOIN public.free_weekly_usage u ON u.subject_id=s.id
  AND u.period_start=date_trunc('week',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
REVOKE ALL ON public.free_support_status FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.free_support_status TO service_role;
CREATE VIEW public.free_cohort_metrics WITH (security_invoker=true) AS
 WITH accounts AS (
  SELECT s.id,s.created_at,
   min(e.occurred_at) FILTER(WHERE e.event_name='calculation_completed') AS first_costing,
   min(e.occurred_at) FILTER(WHERE e.event_name='paid_activation') AS first_paid,
   count(DISTINCT (e.occurred_at AT TIME ZONE 'Asia/Kolkata')::date) FILTER(WHERE e.event_name='calculation_completed') AS usage_days,
   min(e.occurred_at) FILTER(WHERE e.event_name='quota_reached') AS first_quota_hit
  FROM public.free_account_subjects s LEFT JOIN public.free_funnel_events e ON e.subject_id=s.id
  WHERE s.analytics_eligible AND s.created_at>=now()-interval '90 days'
  GROUP BY s.id,s.created_at
 ) SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS signup_cohort,
 count(*) AS eligible_signups,count(first_costing) AS activated_accounts,
 count(*) FILTER(WHERE created_at<=now()-interval '30 days') AS mature_30_day_accounts,
 count(*) FILTER(WHERE created_at<=now()-interval '30 days' AND first_paid<=created_at+interval '30 days') AS converted_by_day_30,
 count(*) FILTER(WHERE usage_days>=2) AS returned_on_another_day,
 count(first_quota_hit) AS quota_hit_accounts,
 count(*) FILTER(WHERE first_paid>=first_quota_hit) AS quota_hit_then_paid_accounts
 FROM accounts GROUP BY (created_at AT TIME ZONE 'Asia/Kolkata')::date;
REVOKE ALL ON public.free_cohort_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.free_cohort_metrics TO service_role;

-- Prepare retention without activating the proposed policy before review.
DO $$ DECLARE v_job bigint; BEGIN
 SELECT cron.schedule('weavly-free-retention','17 3 * * *','SELECT public.prune_free_operational_metadata();') INTO v_job;
 PERFORM cron.alter_job(v_job,active:=false);
END $$;
