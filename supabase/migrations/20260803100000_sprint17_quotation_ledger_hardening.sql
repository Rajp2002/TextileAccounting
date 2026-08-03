-- Sprint 17: make quotation delivery state durable and auditable.
-- The first sent timestamp is part of the quotation ledger, not a UI-only
-- event. It survives reloads, reopening, and edits to the same draft record.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

UPDATE public.estimator_quotes
SET sent_at = updated_at
WHERE record_kind = 'quotation'
  AND status = 'sent'
  AND sent_at IS NULL;

CREATE INDEX IF NOT EXISTS estimator_quotes_org_sent_at_idx
  ON public.estimator_quotes (org_id, sent_at DESC)
  WHERE record_kind = 'quotation' AND sent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.stamp_estimator_quote_sent_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.record_kind = 'quotation' AND NEW.status = 'sent' AND NEW.sent_at IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.sent_at := COALESCE(OLD.sent_at, now());
    ELSE
      NEW.sent_at := now();
    END IF;
  END IF;

  -- Never erase the original delivery event when a sent quotation is edited
  -- or moves through a later state.
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NOT NULL AND NEW.sent_at IS NULL THEN
    NEW.sent_at := OLD.sent_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimator_quotes_sent_at_stamp ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_sent_at_stamp
  BEFORE INSERT OR UPDATE ON public.estimator_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_estimator_quote_sent_at();

COMMENT ON COLUMN public.estimator_quotes.sent_at IS
  'First durable timestamp at which this quotation entered Sent state.';
