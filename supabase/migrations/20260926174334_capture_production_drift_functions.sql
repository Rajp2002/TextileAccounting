-- Fix package F3: capture production-only functions in migrations
-- (EVIDENCE E18, E22).
--
-- Production has three functions that no migration creates. Earlier
-- migrations only adjusted them when present (20260710110907, 20260812133643,
-- 20260903115520), so a database built from migrations differed from
-- production in two ways:
--   * the profiles read policy lacked its get_user_org_id() clause, and
--   * new public tables did not get RLS enabled automatically (ensure_rls).
--
-- This re-creates the functions exactly as production defines them (source
-- copied from pg_get_functiondef on 2026-09-26), restates production's grants,
-- adds the ensure_rls event trigger when it is missing, and adds the policy
-- clause when it is missing. On production every statement restates what
-- already exists.

CREATE OR REPLACE FUNCTION public.get_user_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$function$;

REVOKE ALL ON FUNCTION public.get_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$function$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

DO $ensure_rls$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END;
$ensure_rls$;

-- 20260903115520 adds this clause only when get_user_org_id() exists, which
-- is the case in production.
DO $profiles_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users read own or organization profiles'
      AND qual LIKE '%get_user_org_id()%'
  ) THEN
    DROP POLICY IF EXISTS "Users read own or organization profiles" ON public.profiles;
    CREATE POLICY "Users read own or organization profiles" ON public.profiles
      FOR SELECT TO PUBLIC
      USING (
        id = (SELECT auth.uid())
        OR org_id = ((SELECT auth.jwt()) ->> 'org_id')::uuid
        OR org_id = (SELECT public.get_user_org_id())
      );
  END IF;
END;
$profiles_policy$;
