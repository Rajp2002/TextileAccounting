-- Row-level-security checks that ran once per row now run once per query.
--
-- Saved Costings reads estimator_quotes as the signed-in owner. Postgres ran
-- two SECURITY DEFINER functions (which it cannot inline) for every one of the
-- org's rows before sorting and taking the 500-row page:
--   * org_has_subscription_tier(org_id, 'base') in "Owners Read Estimator Quotes"
--     (and the same check on estimator_templates), and
--   * weavly_private.free_business_restricted(org_id) in the restrictive
--     free_business_boundary policy on every org-scoped table, which for an
--     account that came from Free runs org_has_subscription_tier again.
-- Measured on the disposable test database (scripts/performance/
-- rls-initplan.mjs, docs/performance/latency-20261028/README.md, Task J):
-- 3,000 costings 224 ms -> 7 ms, or 2,606 ms -> 8 ms for an account that came
-- from Free.
--
-- Behaviour is unchanged (__tests__/db/rls-once-per-query.dbtest.ts):
--   * free_business_restricted(org) can only be true for the caller's own org
--     (it requires the caller's profile to belong to it), so comparing each
--     row's org with that one org, computed once, gives the same answer for
--     every row, including rows whose org is NULL.
--   * The costing policies already require org_id to equal the caller's org
--     from the JWT, so their plan check can take that org instead of each
--     row's.

CREATE OR REPLACE FUNCTION weavly_private.free_business_restricted_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.org_id
  FROM public.profiles AS membership
  WHERE membership.id = auth.uid()
    AND weavly_private.free_business_restricted(membership.org_id)
$$;

REVOKE ALL ON FUNCTION weavly_private.free_business_restricted_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION weavly_private.free_business_restricted_org() TO authenticated, service_role;

-- Every free_business_boundary policy, whichever org column it names.
DO $$
DECLARE
  boundary record;
  org_column text;
  once_per_query text;
BEGIN
  FOR boundary IN
    SELECT tablename, qual FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'free_business_boundary'
  LOOP
    org_column := substring(boundary.qual FROM 'free_business_restricted\((\w+)\)');
    IF org_column IS NULL THEN
      RAISE EXCEPTION 'free_business_boundary on % has an unexpected form: %', boundary.tablename, boundary.qual;
    END IF;
    once_per_query := format(
      'NOT coalesce(%I = (SELECT weavly_private.free_business_restricted_org()), false)', org_column
    );
    EXECUTE format(
      'ALTER POLICY free_business_boundary ON public.%I USING (%s) WITH CHECK (%s)',
      boundary.tablename, once_per_query, once_per_query
    );
  END LOOP;
END $$;

-- The costing tables' policies: the plan check takes the caller's org from the
-- JWT, which each of them already requires org_id to equal.
DO $$
DECLARE
  costing record;
  per_row constant text := 'org_has_subscription_tier(org_id, ''base''::text)';
  caller_org constant text := '(NULLIF((( SELECT auth.jwt() AS jwt) ->> ''org_id''::text), ''''::text))::uuid';
  once_per_query constant text := '( SELECT org_has_subscription_tier((NULLIF((auth.jwt() ->> ''org_id''::text), ''''::text))::uuid, ''base''::text) AS org_has_subscription_tier)';
  new_qual text;
  new_check text;
BEGIN
  FOR costing IN
    SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('estimator_quotes', 'estimator_templates')
      AND (qual LIKE '%' || per_row || '%' OR with_check LIKE '%' || per_row || '%')
  LOOP
    IF (costing.qual LIKE '%' || per_row || '%' AND costing.qual NOT LIKE '%(org_id = ' || caller_org || ')%')
      OR (costing.with_check LIKE '%' || per_row || '%' AND costing.with_check NOT LIKE '%(org_id = ' || caller_org || ')%') THEN
      RAISE EXCEPTION 'Policy % on % checks the plan without pinning org_id to the caller: %',
        costing.policyname, costing.tablename, coalesce(costing.qual, costing.with_check);
    END IF;
    new_qual := replace(costing.qual, per_row, once_per_query);
    new_check := replace(costing.with_check, per_row, once_per_query);
    EXECUTE format('ALTER POLICY %I ON public.%I%s%s',
      costing.policyname, costing.tablename,
      CASE WHEN new_qual IS NULL THEN '' ELSE format(' USING (%s)', new_qual) END,
      CASE WHEN new_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', new_check) END);
  END LOOP;
END $$;
