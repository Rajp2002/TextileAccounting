-- MASTER-014 follow-up: the atomic context RPC can and should execute under
-- caller RLS after its explicit tenant/role/lockdown validation.

ALTER FUNCTION public.upsert_shift_assignment_context_v1(
  DATE, TEXT, UUID, BIGINT, UUID, NUMERIC
) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.upsert_shift_assignment_context_v1(
  DATE, TEXT, UUID, BIGINT, UUID, NUMERIC
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shift_assignment_context_v1(
  DATE, TEXT, UUID, BIGINT, UUID, NUMERIC
) TO authenticated, service_role;
