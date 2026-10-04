-- Read-only: run in the actual production project's SQL Editor as postgres.
WITH required(version, expected_name) AS (VALUES
  ('20261004150000', 'founder_admin_boundary'),
  ('20261004150500', 'founder_support_workflow'),
  ('20261004151000', 'founder_factory_reporting'),
  ('20261004152000', 'admin_billing_reporting'),
  ('20261004153000', 'admin_data_rights_compatibility'),
  ('20261004154000', 'founder_email_and_mfa_setup'),
  ('20261004155000', 'admin_legacy_read_indexes'),
  ('20261004170000', 'admin_retained_record_review'),
  ('20261004180000', 'admin_formal_case_workflow'),
  ('20261004190000', 'admin_retention_review')
)
SELECT r.version, r.expected_name, h.name AS recorded_name,
       h.version IS NOT NULL AS recorded_applied
FROM required AS r
LEFT JOIN supabase_migrations.schema_migrations AS h
  ON h.version::text = r.version
ORDER BY r.version;

SELECT 'founder_grants' AS check_name, to_regclass('private.platform_founder_grants') IS NOT NULL AS installed
UNION ALL SELECT 'platform_sessions', to_regclass('private.platform_admin_sessions') IS NOT NULL
UNION ALL SELECT 'audit_events', to_regclass('private.admin_audit_events') IS NOT NULL
UNION ALL SELECT 'support_tickets', to_regclass('public.support_tickets') IS NOT NULL
UNION ALL SELECT 'org_reporting', to_regclass('private.admin_org_reporting') IS NOT NULL
UNION ALL SELECT 'billing_facts', to_regclass('private.admin_billing_facts') IS NOT NULL
UNION ALL SELECT 'billing_coverage', to_regclass('private.admin_billing_coverage') IS NOT NULL
UNION ALL SELECT 'formal_cases', to_regclass('private.admin_formal_cases') IS NOT NULL
UNION ALL SELECT 'retention_policies', to_regclass('private.admin_retention_policies') IS NOT NULL
UNION ALL SELECT 'grant_login_email', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'private' AND table_name = 'platform_founder_grants' AND column_name = 'login_email'
)
UNION ALL SELECT 'founder_session_rpc', to_regprocedure('public.admin_founder_session(uuid,uuid,text)') IS NOT NULL
UNION ALL SELECT 'mfa_setup_rpc', to_regprocedure('public.admin_founder_mfa_setup(uuid,uuid,text,uuid,uuid,uuid)') IS NOT NULL;
