-- Sprint 5: customer-ready quotation identity and document metadata.
-- These fields are deliberately nullable so existing standalone costings and
-- legacy quotation snapshots remain readable without a destructive backfill.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS quotation_reference text,
  ADD COLUMN IF NOT EXISTS quotation_valid_until date,
  ADD COLUMN IF NOT EXISTS customer_terms text;

-- Give legacy quotations a stable, human-readable reference without changing
-- their saved economics. The UUID prefix keeps the migration collision-safe
-- while the year makes repeated trader conversations easier to follow.
UPDATE public.estimator_quotes
SET quotation_reference = 'QT-'
  || to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY')
  || '-'
  || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE record_kind = 'quotation'
  AND quotation_reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS estimator_quotes_org_quotation_reference_uidx
  ON public.estimator_quotes(org_id, quotation_reference)
  WHERE quotation_reference IS NOT NULL;

-- Keep references present for every new quotation, including quotations created
-- by database RPCs such as Start Party Order rather than the React form.
CREATE OR REPLACE FUNCTION public.assign_estimator_quotation_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.record_kind = 'quotation' AND NULLIF(trim(NEW.quotation_reference), '') IS NULL THEN
    NEW.quotation_reference := 'QT-'
      || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata', 'YYYY')
      || '-'
      || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimator_quotes_assign_quotation_reference
  ON public.estimator_quotes;

CREATE TRIGGER estimator_quotes_assign_quotation_reference
BEFORE INSERT ON public.estimator_quotes
FOR EACH ROW
EXECUTE FUNCTION public.assign_estimator_quotation_reference();

COMMENT ON COLUMN public.estimator_quotes.quotation_reference IS
  'Stable organization-scoped customer quotation reference shown on PDFs and sharing messages.';

COMMENT ON COLUMN public.estimator_quotes.quotation_valid_until IS
  'Customer-facing quotation validity date. Re-exporting a saved quotation preserves this value.';

COMMENT ON COLUMN public.estimator_quotes.customer_terms IS
  'Customer-facing terms for the quotation. Internal estimator notes are not stored here.';
