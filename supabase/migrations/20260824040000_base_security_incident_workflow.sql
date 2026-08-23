-- Base Plan security incident register (ordered after the privacy workflow migration).
-- This is an operator-only record: browsers and tenant users receive no table
-- privileges. It is intentionally separate from the Full Suite tenant-lockdown
-- and breach_reports workflow.

CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  source text NOT NULL CHECK (source IN ('customer', 'provider', 'monitoring', 'internal', 'other')),
  incident_type text NOT NULL CHECK (incident_type IN (
    'account_compromise',
    'unauthorized_access',
    'billing_security',
    'suspicious_message',
    'service_vulnerability',
    'availability',
    'other'
  )),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed'
  )),
  severity text NOT NULL DEFAULT 'unassessed' CHECK (severity IN (
    'unassessed', 'low', 'medium', 'high', 'critical'
  )),
  aware_at timestamptz NOT NULL,
  cert_in_assessment_due_at timestamptz NOT NULL,
  reported_by_email text,
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 10 AND 5000),
  affected_data_categories text[] NOT NULL DEFAULT '{}',
  affected_people_estimate integer CHECK (affected_people_estimate IS NULL OR affected_people_estimate >= 0),
  containment_summary text,
  investigation_summary text,
  remediation_summary text,
  cert_in_assessment text NOT NULL DEFAULT 'pending' CHECK (cert_in_assessment IN (
    'pending', 'not_reportable', 'reportable', 'reported'
  )),
  cert_in_decision_rationale text,
  cert_in_reported_at timestamptz,
  cert_in_reference text,
  dpdp_board_assessment text NOT NULL DEFAULT 'not_yet_applicable' CHECK (dpdp_board_assessment IN (
    'not_yet_applicable', 'pending', 'not_required', 'required', 'notified'
  )),
  dpdp_board_detailed_update_due_at timestamptz,
  dpdp_board_notified_at timestamptz,
  affected_people_notification text NOT NULL DEFAULT 'pending' CHECK (affected_people_notification IN (
    'pending', 'not_required', 'required', 'notified'
  )),
  notification_decision_rationale text,
  affected_people_notified_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT security_incidents_base_categories_only CHECK (
    affected_data_categories <@ ARRAY[
      'account_authentication',
      'costings_business_contacts',
      'billing_subscription_references',
      'support_privacy_communications',
      'technical_diagnostic_security_logs'
    ]::text[]
  ),
  CONSTRAINT security_incidents_cert_report_consistent CHECK (
    cert_in_assessment <> 'reported' OR cert_in_reported_at IS NOT NULL
  ),
  CONSTRAINT security_incidents_closed_consistent CHECK (
    status <> 'closed' OR closed_at IS NOT NULL
  )
);

COMMENT ON TABLE public.security_incidents IS
  'Operator-only Base Plan security incident register; excludes future Full Suite production, worker, payroll, stock, inventory, and dispatch scope.';
COMMENT ON COLUMN public.security_incidents.cert_in_assessment_due_at IS
  'Internal deadline to assess whether an incident is reportable under the current CERT-In six-hour direction; not every event is reportable.';
COMMENT ON COLUMN public.security_incidents.dpdp_board_assessment IS
  'Readiness field for the phased DPDP breach-notification regime; not_yet_applicable is the launch default.';
COMMENT ON COLUMN public.security_incidents.dpdp_board_detailed_update_due_at IS
  'Set only when the phased DPDP Rule 7 notification requirement is legally in force and applicable.';

CREATE INDEX security_incidents_status_aware_idx
  ON public.security_incidents (status, aware_at DESC);
CREATE INDEX security_incidents_cert_pending_idx
  ON public.security_incidents (cert_in_assessment_due_at)
  WHERE cert_in_assessment = 'pending';
CREATE INDEX security_incidents_org_idx
  ON public.security_incidents (org_id, aware_at DESC)
  WHERE org_id IS NOT NULL;

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.security_incidents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_incidents TO service_role;

CREATE OR REPLACE FUNCTION public.set_security_incident_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.cert_in_assessment_due_at := NEW.aware_at + interval '6 hours';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_security_incident_metadata() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_security_incident_metadata() TO service_role;

CREATE TRIGGER set_security_incident_metadata
BEFORE INSERT OR UPDATE ON public.security_incidents
FOR EACH ROW EXECUTE FUNCTION public.set_security_incident_metadata();
