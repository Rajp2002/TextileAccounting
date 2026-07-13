-- P0: Fresh owner provisioning must be able to insert the organization before
-- the owner's profile exists. The settings audit trigger previously copied the
-- new organizations.owner_id into audit_log.changed_by. Because changed_by has
-- an FK to profiles(id), that AFTER INSERT trigger raised 23503 and rolled back
-- every fresh organization insert.
--
-- Keep the audit event (including the redacted organization payload), but only
-- persist changed_by when the actor already has a profile. Later organization
-- changes still retain normal actor attribution.

CREATE OR REPLACE FUNCTION public.log_settings_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_data JSONB;
  v_old_data JSONB := NULL;
  v_new_data JSONB := NULL;
  v_org_id UUID := NULL;
  v_org_text TEXT;
  v_record_id TEXT;
  v_actor_id UUID := NULL;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_data := public.redact_settings_audit_payload(TG_TABLE_NAME, to_jsonb(OLD));
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_data := public.redact_settings_audit_payload(TG_TABLE_NAME, to_jsonb(NEW));
    v_row_data := to_jsonb(NEW);
  ELSE
    v_row_data := to_jsonb(OLD);
  END IF;

  v_org_text := COALESCE(
    v_row_data->>'org_id',
    v_row_data->>'factory_id',
    CASE WHEN TG_TABLE_NAME = 'organizations' THEN v_row_data->>'id' END
  );

  BEGIN
    v_org_id := NULLIF(v_org_text, '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_org_id := NULL;
  END;

  v_record_id := COALESCE(
    v_row_data->>'id',
    v_row_data->>'org_id',
    v_row_data->>'factory_id',
    v_row_data->>'key',
    TG_TABLE_NAME
  );

  BEGIN
    v_actor_id := COALESCE(NULLIF(current_setting('app.actor_id', true), '')::UUID, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := auth.uid();
  END;

  IF v_actor_id IS NULL THEN
    BEGIN
      v_actor_id := COALESCE(
        NULLIF(v_row_data->>'updated_by', '')::UUID,
        NULLIF(v_row_data->>'captured_by_user_id', '')::UUID,
        NULLIF(v_row_data->>'owner_id', '')::UUID
      );
    EXCEPTION WHEN OTHERS THEN
      v_actor_id := NULL;
    END;
  END IF;

  -- Fresh organization provisioning runs before the owner profile can exist.
  -- Do not let audit attribution turn that valid bootstrap order into an FK
  -- failure. The event itself remains recorded and tenant-scoped.
  IF v_actor_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles AS actor_profile
       WHERE actor_profile.id = v_actor_id
     ) THEN
    v_actor_id := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', v_new_data, v_actor_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', v_old_data, v_new_data, v_actor_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, old_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', v_old_data, v_actor_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_settings_audit_event()
  FROM PUBLIC, anon, authenticated;
