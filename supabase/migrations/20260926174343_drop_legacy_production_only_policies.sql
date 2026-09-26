-- Fix package F3 (owner-approved authorization change): drop three legacy
-- policies that exist only in production (EVIDENCE E22).
--
-- They let any org member read machines and production_logs, or insert
-- production logs, with no role or organization-lock check. They grant
-- nothing today, because the restrictive requires_premium_subscription policy
-- refuses every tier since 20260924085030, but they would bypass the lock
-- checks of the *_when_unlocked policies if that gate changed. No migration
-- creates them, so on a database built from migrations this is a no-op.

DROP POLICY IF EXISTS "Users can view org machines" ON public.machines;
DROP POLICY IF EXISTS "Users can view org logs" ON public.production_logs;
DROP POLICY IF EXISTS "Supervisors can insert logs" ON public.production_logs;
