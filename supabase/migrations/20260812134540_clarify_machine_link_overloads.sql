-- The two-argument owner/supervisor RPC must remain unambiguous to SQL and
-- PostgREST. Do not give the service-only overload a default third argument:
-- PostgreSQL otherwise treats a two-argument call as matching both overloads.

DROP FUNCTION public.link_batch_to_machine(uuid, uuid, uuid);
DROP FUNCTION public.link_order_to_machine(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.link_batch_to_machine(
  p_batch_id uuid,
  p_machine_id uuid,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'The explicit organization overload is service-role only'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.yarn_batches AS batch
    WHERE batch.id = p_batch_id
      AND batch.org_id = p_org_id
      AND batch.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active yarn batch not found' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines AS machine
    WHERE machine.id = p_machine_id
      AND machine.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Machine not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yarn_batches
  SET current_machine_id = NULL
  WHERE current_machine_id = p_machine_id
    AND org_id = p_org_id
    AND status = 'active';

  UPDATE public.yarn_batches
  SET current_machine_id = p_machine_id
  WHERE id = p_batch_id
    AND org_id = p_org_id
    AND status = 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_order_to_machine(
  p_order_id uuid,
  p_machine_id uuid,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'The explicit organization overload is service-role only'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS order_row
    WHERE order_row.id = p_order_id
      AND order_row.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Order not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines AS machine
    WHERE machine.id = p_machine_id
      AND machine.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Machine not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.machines
  SET current_order_id = p_order_id
  WHERE id = p_machine_id
    AND org_id = p_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_batch_to_machine(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_batch_to_machine(uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.link_order_to_machine(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_order_to_machine(uuid, uuid, uuid)
  TO service_role;
