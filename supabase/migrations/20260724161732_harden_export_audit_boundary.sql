-- Export audit rows are written by authenticated server actions through the
-- service-role client. Keep this SECURITY DEFINER helper outside the exposed
-- authenticated RPC surface and validate the explicit actor before writing.

CREATE OR REPLACE FUNCTION public.log_export_event(
    p_org_id UUID,
    p_table_name TEXT,
    p_record_id TEXT,
    p_description TEXT,
    p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'An authenticated export actor is required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS actor
        WHERE actor.id = p_actor_id
          AND (actor.org_id = p_org_id OR actor.role = 'admin')
    ) THEN
        RAISE EXCEPTION 'Export actor is not authorized for this organization'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.audit_log (
        org_id,
        table_name,
        record_id,
        action,
        new_data,
        changed_by
    )
    VALUES (
        p_org_id,
        p_table_name,
        p_record_id,
        'EXPORT',
        jsonb_build_object('description', p_description, 'timestamp', now()),
        p_actor_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.log_export_event(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_export_event(UUID, TEXT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.log_export_event(UUID, TEXT, TEXT, TEXT, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.log_export_event(UUID, TEXT, TEXT, TEXT, UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION public.log_export_event(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
