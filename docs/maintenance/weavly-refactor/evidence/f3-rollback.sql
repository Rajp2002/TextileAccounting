-- ROLLBACK for fix package F3 (not a migration; run only if F3 must be undone).
-- Versions below are the ones recorded in production on 2026-09-26.
--
-- 20260926174343 (drop legacy policies): recreates the three policies exactly
-- as production had them. They were inert (E22), so this restores the previous
-- state, including its latent lock bypass.
--
-- 20260926174338 (free_server_time search_path): restores the unpinned
-- function (md5(prosrc) f0423528…, no proconfig).
--
-- 20260926174334 (capture of production-only objects): nothing to undo in
-- production. It restated functions, grants, the ensure_rls event trigger and
-- the profiles policy clause that production already had, and was verified
-- byte-identical after applying. Its history row can stay.
BEGIN;
CREATE POLICY "Users can view org machines" ON public.machines
  FOR SELECT TO public
  USING (org_id IN (SELECT profiles.org_id FROM public.profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can view org logs" ON public.production_logs
  FOR SELECT TO public
  USING (org_id IN (SELECT profiles.org_id FROM public.profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Supervisors can insert logs" ON public.production_logs
  FOR INSERT TO public
  WITH CHECK (org_id IN (SELECT profiles.org_id FROM public.profiles WHERE profiles.id = auth.uid()));
ALTER FUNCTION public.free_server_time() RESET search_path;
DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('20260926174338', '20260926174343');
COMMIT;
