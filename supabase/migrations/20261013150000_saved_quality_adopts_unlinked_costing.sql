-- A costing saved without a Saved Quality has no template link. Saving the
-- quality afterwards created a second costing with the same numbers, and every
-- later update versioned that new copy while the owner's original costing
-- stayed at its old version. Owners had to delete the original by hand.
--
-- Template-linked saves now also match an unlinked costing whose quality name
-- equals the Saved Quality name. The next save becomes version N+1 of that
-- existing costing (same costing_group_id), and the saved quality adopts it
-- instead of starting a second lineage when the inputs are unchanged.
--
-- Costings that already carry a template link follow the same rule as before.
-- Saves without a template keep the label-only rule. No existing row changes.

-- 1. The revision RPC resolves the latest version for a new save. It is
--    patched in place, the same way 20261004120000 extended its payload
--    allowlist, so the large concurrency body is not copied here.
DO $adopt_unlinked_lineage_rpc$
DECLARE
  v_function record;
  v_body text;
  v_before constant text := $before$        OR (v_template_id IS NULL
            AND quote.template_id IS NULL
            AND lower(btrim(quote.quality_label)) = lower(btrim(p_quote_payload ->> 'quality_label')))$before$;
  v_after constant text := $after$        OR (quote.template_id IS NULL
            AND lower(btrim(quote.quality_label)) = lower(btrim(COALESCE(
              (SELECT template.name FROM public.estimator_templates AS template WHERE template.id = v_template_id),
              p_quote_payload ->> 'quality_label'
            ))))$after$;
BEGIN
  SELECT
    proc.oid,
    proc.prosrc,
    pg_get_function_arguments(proc.oid) AS arguments,
    pg_get_function_result(proc.oid) AS result_type
  INTO STRICT v_function
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  JOIN pg_language AS language ON language.oid = proc.prolang
  WHERE namespace.nspname = 'public'
    AND language.lanname = 'plpgsql'
    AND proc.proname = 'save_estimator_costing_revision_v2';

  IF position('(SELECT template.name FROM public.estimator_templates AS template WHERE template.id = v_template_id)' IN v_function.prosrc) > 0 THEN
    RETURN;
  END IF;

  v_body := replace(v_function.prosrc, v_before, v_after);

  IF v_body = v_function.prosrc THEN
    RAISE EXCEPTION 'Could not widen the costing lineage lookup in save_estimator_costing_revision_v2';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_v2(%s) '
      || 'RETURNS %s LANGUAGE plpgsql VOLATILE SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
    v_function.arguments,
    v_function.result_type,
    v_body
  );
END;
$adopt_unlinked_lineage_rpc$;

-- 2. The standalone-costing version trigger runs on every insert. For a
--    template-linked row it must use the same lineage as the RPC, or it would
--    reset the adopted row to version 1 inside the same group.
CREATE OR REPLACE FUNCTION public.assign_standalone_costing_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_previous public.estimator_quotes%ROWTYPE;
  v_identity text;
  v_template_name text;
BEGIN
  IF NEW.record_kind IS DISTINCT FROM 'costing' OR NEW.source_quote_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.template_id IS NOT NULL THEN
    SELECT lower(btrim(template.name))
    INTO v_template_name
    FROM public.estimator_templates AS template
    WHERE template.id = NEW.template_id;
  END IF;

  v_identity := NEW.org_id::text || ':' || COALESCE(NEW.template_id::text, lower(btrim(NEW.quality_label)));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_identity, 0));

  SELECT * INTO v_previous
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = NEW.org_id
    AND quote.record_kind = 'costing'
    AND (
      (NEW.template_id IS NOT NULL AND quote.template_id = NEW.template_id)
      OR (quote.template_id IS NULL AND lower(btrim(quote.quality_label)) = COALESCE(v_template_name, lower(btrim(NEW.quality_label))))
    )
  ORDER BY quote.version_number DESC, quote.created_at DESC, quote.id DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.costing_group_id := COALESCE(v_previous.costing_group_id, v_previous.id);
    NEW.version_number := COALESCE(v_previous.version_number, 0) + 1;
  ELSE
    NEW.costing_group_id := COALESCE(NEW.costing_group_id, NEW.id);
    NEW.version_number := 1;
  END IF;
  RETURN NEW;
END;
$$;
