-- B16: delivery outcomes and retries must remain explicit and bounded.

ALTER TABLE public.whatsapp_delivery_log
  DROP CONSTRAINT IF EXISTS whatsapp_delivery_log_status_check;

ALTER TABLE public.whatsapp_delivery_log
  ADD CONSTRAINT whatsapp_delivery_log_status_check
  CHECK (status IN (
    'sent',
    'delivered',
    'read',
    'failed',
    'skipped_opted_out',
    'skipped_missing_consent',
    'skipped_missing_phone',
    'skipped_phone_mismatch'
  ));

ALTER TABLE public.whatsapp_delivery_log
  DROP CONSTRAINT IF EXISTS whatsapp_delivery_log_retry_count_check;

ALTER TABLE public.whatsapp_delivery_log
  ADD CONSTRAINT whatsapp_delivery_log_retry_count_check
  CHECK (retry_count BETWEEN 0 AND 3);

COMMENT ON CONSTRAINT whatsapp_delivery_log_retry_count_check
  ON public.whatsapp_delivery_log IS
  'A delivery can be retried at most three times; neither UI nor worker may reset retry history.';

-- Daily and monthly summaries can legitimately share the first day of a month.
-- Their idempotency grain therefore includes the brief type.
ALTER TABLE public.daily_brief_logs
  ADD COLUMN IF NOT EXISTS brief_type TEXT NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_brief_logs
  DROP CONSTRAINT IF EXISTS daily_brief_logs_brief_type_check;

ALTER TABLE public.daily_brief_logs
  ADD CONSTRAINT daily_brief_logs_brief_type_check
  CHECK (brief_type IN ('daily', 'monthly'));

ALTER TABLE public.daily_brief_logs
  DROP CONSTRAINT IF EXISTS daily_brief_logs_org_id_report_date_key;

ALTER TABLE public.daily_brief_logs
  ADD CONSTRAINT daily_brief_logs_org_date_type_key
  UNIQUE (org_id, report_date, brief_type);

COMMENT ON COLUMN public.daily_brief_logs.brief_type IS
  'Idempotency grain discriminator so a daily brief and monthly brief cannot suppress each other.';
