-- ============================================================
-- MIGRATION: Explicit actor support for compliance export audit logs
-- ============================================================
-- Admin/service-role clients do not populate auth.uid(), so export audit
-- entries need the authenticated actor passed explicitly by server actions.
-- Keep a NULL fallback to auth.uid() for any direct/authenticated callers.
-- ============================================================

DROP FUNCTION IF EXISTS log_export_event(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION log_export_event(
    p_org_id UUID,
    p_table_name TEXT,
    p_record_id TEXT,
    p_description TEXT,
    p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (
        p_org_id,
        p_table_name,
        p_record_id,
        'EXPORT',
        jsonb_build_object('description', p_description, 'timestamp', now()),
        COALESCE(p_actor_id, auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_export_event(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_export_event(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
