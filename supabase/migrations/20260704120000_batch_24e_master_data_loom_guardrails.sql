-- Batch 24E: master data loom guardrails.
-- Preserves legacy duplicate machine rows while enforcing normalized
-- org-scoped loom name uniqueness for new inserts and renames.

CREATE INDEX IF NOT EXISTS machines_org_normalized_name_lookup_idx
    ON public.machines (org_id, lower(btrim(name)));

COMMENT ON INDEX public.machines_org_normalized_name_lookup_idx IS
    'Batch 24E: supports normalized org-scoped loom name duplicate checks.';

CREATE OR REPLACE FUNCTION public.enforce_machines_org_normalized_name_unique()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_normalized_name TEXT;
BEGIN
    v_normalized_name := lower(btrim(NEW.name));

    IF TG_OP = 'UPDATE'
        AND NEW.org_id IS NOT DISTINCT FROM OLD.org_id
        AND v_normalized_name IS NOT DISTINCT FROM lower(btrim(OLD.name))
    THEN
        RETURN NEW;
    END IF;

    IF NEW.org_id IS NULL OR v_normalized_name IS NULL OR v_normalized_name = '' THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('machines_org_normalized_name_unique'),
        hashtext(NEW.org_id::TEXT || ':' || v_normalized_name)
    );

    IF EXISTS (
        SELECT 1
        FROM public.machines m
        WHERE m.org_id = NEW.org_id
          AND lower(btrim(m.name)) = v_normalized_name
          AND (NEW.id IS NULL OR m.id <> NEW.id)
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'duplicate key value violates unique constraint "machines_org_normalized_name_unique"'
            USING
                ERRCODE = '23505',
                CONSTRAINT = 'machines_org_normalized_name_unique',
                DETAIL = format(
                    'Key (org_id, lower(btrim(name)))=(%s, %s) already exists.',
                    NEW.org_id,
                    v_normalized_name
                );
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_machines_org_normalized_name_unique()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS machines_org_normalized_name_unique_guard ON public.machines;

CREATE TRIGGER machines_org_normalized_name_unique_guard
    BEFORE INSERT OR UPDATE OF org_id, name ON public.machines
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_machines_org_normalized_name_unique();
