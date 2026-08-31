-- Apply after the new Base app is READY in production.
-- Existing tabs must reload before writing. No financial history is changed.
-- Only the reviewed entrypoints are exposed after this coordinated release.
REVOKE ALL ON FUNCTION public.settle_base_worker_payroll(uuid, date, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_base_daily_production_with_reason(date, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

