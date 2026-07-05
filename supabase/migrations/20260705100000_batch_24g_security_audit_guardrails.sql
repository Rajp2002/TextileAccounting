-- ============================================================
-- Batch 24G: security and audit source guardrails
-- Adds source-backed audit coverage for settings-like tables.
-- This migration is intentionally non-destructive and must be QA-applied
-- separately; it is not applied by this source batch.
-- ============================================================

-- Global/admin settings can be audited without an org scope.
ALTER TABLE IF EXISTS public.audit_log
  ALTER COLUMN org_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.redact_settings_audit_payload(
  p_table_name TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_payload JSONB := p_payload;
BEGIN
  IF v_payload IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_table_name = 'organizations' THEN
    v_payload := v_payload - 'access_code_hash' - 'last_code_plain';

    IF v_payload ? 'join_code' AND v_payload->>'join_code' IS NOT NULL THEN
      v_payload := jsonb_set(v_payload, '{join_code}', '"[REDACTED]"'::jsonb, false);
    END IF;
  ELSIF p_table_name = 'whatsapp_settings' THEN
    IF v_payload ? 'value' THEN
      v_payload := jsonb_set(v_payload, '{value}', '"[REDACTED]"'::jsonb, false);
    END IF;
  ELSIF p_table_name = 'notification_consents' THEN
    IF v_payload ? 'phone' AND v_payload->>'phone' IS NOT NULL THEN
      v_payload := jsonb_set(v_payload, '{phone}', '"[REDACTED]"'::jsonb, false);
    END IF;
  END IF;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_settings_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_settings_organizations ON public.organizations;
    CREATE TRIGGER audit_settings_organizations
      AFTER INSERT OR UPDATE OR DELETE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;

  IF to_regclass('public.factory_cost_profile') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_settings_factory_cost_profile ON public.factory_cost_profile;
    CREATE TRIGGER audit_settings_factory_cost_profile
      AFTER INSERT OR UPDATE OR DELETE ON public.factory_cost_profile
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;

  IF to_regclass('public.compliance_settings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_settings_compliance_settings ON public.compliance_settings;
    CREATE TRIGGER audit_settings_compliance_settings
      AFTER INSERT OR UPDATE OR DELETE ON public.compliance_settings
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;

  IF to_regclass('public.notification_consents') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_settings_notification_consents ON public.notification_consents;
    CREATE TRIGGER audit_settings_notification_consents
      AFTER INSERT OR UPDATE OR DELETE ON public.notification_consents
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;

  IF to_regclass('public.whatsapp_settings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_settings_whatsapp_settings ON public.whatsapp_settings;
    CREATE TRIGGER audit_settings_whatsapp_settings
      AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_settings
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;
END;
$$;
