-- The historical `base` workspace marker covers BOTH current Lite and Base.
-- Repair only organizations whose entire subscription history is Lite/Base;
-- retained Premium/trial workspace choices, onboarding and billing are untouched.
UPDATE public.organizations AS organization
SET product_experience = 'base'
WHERE organization.product_experience = 'full_suite'
  AND EXISTS (
    SELECT 1 FROM public.org_subscriptions AS subscription
    WHERE subscription.org_id = organization.id
      AND subscription.plan_tier IN ('lite', 'base')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.org_subscriptions AS subscription
    WHERE subscription.org_id = organization.id
      AND (subscription.plan_tier IS NULL OR subscription.plan_tier NOT IN ('lite', 'base'))
  );

COMMENT ON COLUMN public.organizations.product_experience IS
  'Workspace preference: base is the shared Lite/Base workspace, not a production entitlement; full_suite retains legacy Premium/trial preference. Subscription capabilities remain authoritative.';

-- Attestations are server-owned evidence. Make the existing fail-closed RLS
-- intent explicit; do not grant owners access to forge their own attestations.
CREATE POLICY estimator_attestations_deny_clients
  ON public.estimator_costing_attestations AS RESTRICTIVE
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX estimator_attestations_org_idx
  ON public.estimator_costing_attestations (org_id);
CREATE INDEX estimator_attestations_user_idx
  ON public.estimator_costing_attestations (user_id);
CREATE INDEX estimator_quotes_source_same_org_idx
  ON public.estimator_quotes (org_id, source_quote_id);
CREATE INDEX estimator_quotes_template_idx
  ON public.estimator_quotes (template_id);
CREATE INDEX org_subscriptions_plan_idx
  ON public.org_subscriptions (plan_id);

-- Replace overlapping ALL + SELECT estimator policies with one per operation.
-- Reads still work under lockdown; writes still require NOT locked. Cache only
-- statement-constant JWT claims, never the row-dependent entitlement predicate.
DO $migration$
DECLARE
  table_name text;
  label text;
  read_predicate text := $predicate$
    (((SELECT auth.jwt()) ->> 'user_role') = 'owner'
      AND org_id = NULLIF((SELECT auth.jwt()) ->> 'org_id', '')::uuid
      AND public.org_has_subscription_tier(org_id, 'base'))
  $predicate$;
  write_predicate text;
BEGIN
  write_predicate := read_predicate || ' AND NOT public.check_org_lockdown(org_id)';
  FOR table_name, label IN VALUES
    ('estimator_quotes', 'Estimator Quotes'),
    ('estimator_templates', 'Estimator Templates')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', 'Owners Manage ' || label, table_name);
    EXECUTE format('DROP POLICY %I ON public.%I', 'Owners Read ' || label, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
      'Owners Read ' || label, table_name, read_predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      'Owners Insert ' || label, table_name, write_predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      'Owners Update ' || label, table_name, write_predicate, write_predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
      'Owners Delete ' || label, table_name, write_predicate);
  END LOOP;
END;
$migration$;

-- Preserve the existing owner/profile scope and role coverage; only avoid
-- recalculating the request's user ID per candidate row.
ALTER POLICY owners_see_own_subscription ON public.org_subscriptions
  USING (org_id = (SELECT profiles.org_id FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
ALTER POLICY owners_see_own_payments ON public.subscription_payments
  USING (org_id = (SELECT profiles.org_id FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
ALTER POLICY billing_profile_owner_select ON public.organization_billing_profiles
  USING (org_id = (SELECT profiles.org_id FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));

-- Preserve the exact OR of the four existing permissive profile read policies,
-- including the live-membership fallback used during sign-in claim refresh.
DROP POLICY IF EXISTS "Tenant Isolation" ON public.profiles;
DROP POLICY IF EXISTS "Users can read org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DO $profiles$
DECLARE
  predicate text := $predicate$
    id = (SELECT auth.uid())
    OR org_id = ((SELECT auth.jwt()) ->> 'org_id')::uuid
  $predicate$;
BEGIN
  -- The live-membership helper is legacy schema drift: some databases never
  -- had it. Preserve its existing fallback only where the helper exists.
  IF to_regprocedure('public.get_user_org_id()') IS NOT NULL THEN
    predicate := predicate || ' OR org_id = (SELECT public.get_user_org_id())';
  END IF;
  EXECUTE 'CREATE POLICY "Users read own or organization profiles" ON public.profiles '
    || 'FOR SELECT TO PUBLIC USING (' || predicate || ')';
END;
$profiles$;
