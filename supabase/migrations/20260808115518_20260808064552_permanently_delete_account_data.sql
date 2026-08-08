-- Permanently delete one owner account, its organization, every tenant row,
-- every organization member, and their Supabase Auth identities.
--
-- This is intentionally an authenticated SECURITY DEFINER RPC instead of a
-- collection of client-side deletes. It runs in one database transaction,
-- locks the organization before collecting rows, and fails closed if any
-- tenant-owned row cannot be removed.

-- The normal Full Suite mutation guard must not prevent an owner from deleting
-- the tenant that owns the guarded rows. The account-deletion flag is set only
-- inside the owner-bound RPC below and is transaction-local.
CREATE OR REPLACE FUNCTION public.enforce_premium_tenant_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_org_id uuid;
  v_new_org_id uuid;
BEGIN
  IF COALESCE(current_setting('app.account_deletion', true), '') = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_org_id := OLD.org_id;
    IF NOT public.org_has_subscription_tier(v_old_org_id, 'premium') THEN
      RAISE EXCEPTION 'Weavly Full Suite subscription required for production records'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_org_id := NEW.org_id;
    IF NOT public.org_has_subscription_tier(v_new_org_id, 'premium') THEN
      RAISE EXCEPTION 'Weavly Full Suite subscription required for production records'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Historical costing rows and settled advances are protected during normal
-- use. Account erasure is the explicit, owner-confirmed exception.
CREATE OR REPLACE FUNCTION public.protect_costing_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF COALESCE(current_setting('app.account_deletion', true), '') = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.record_kind IS DISTINCT FROM 'costing' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Historical costing snapshots cannot be deleted. Archive the snapshot instead.';
  END IF;

  v_old := to_jsonb(OLD) - ARRAY[
    'updated_at',
    'is_archived',
    'is_favorite',
    'status',
    'order_id',
    'market_run_id',
    'reconciliation_status',
    'reconciliation_note',
    'reconciled_at'
  ];
  v_new := to_jsonb(NEW) - ARRAY[
    'updated_at',
    'is_archived',
    'is_favorite',
    'status',
    'order_id',
    'market_run_id',
    'reconciliation_status',
    'reconciliation_note',
    'reconciled_at'
  ];

  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'Historical costing snapshots are immutable. Save a new costing version for changed economics.';
  END IF;

  RETURN NEW;
END;
$$;

-- Deleting profiles is part of this transaction. Skip audit-row creation while
-- the account is being erased; the audit rows are tenant data and are deleted
-- explicitly below as well.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org_id uuid;
  v_record_id text;
  v_actor_id uuid;
BEGIN
  IF COALESCE(current_setting('app.account_deletion', true), '') = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_org_id := OLD.org_id;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;

    v_record_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'org_id');
  ELSE
    BEGIN
      v_org_id := NEW.org_id;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;

    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'org_id');
  END IF;

  BEGIN
    v_actor_id := COALESCE(NULLIF(current_setting('app.actor_id', true), '')::uuid, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := auth.uid();
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_actor_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_actor_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (org_id, table_name, record_id, action, old_data, changed_by)
    VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), v_actor_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_settings_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row_data jsonb;
  v_old_data jsonb := NULL;
  v_new_data jsonb := NULL;
  v_org_id uuid := NULL;
  v_org_text text;
  v_record_id text;
  v_actor_id uuid := NULL;
BEGIN
  IF COALESCE(current_setting('app.account_deletion', true), '') = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

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
    v_org_id := NULLIF(btrim(v_org_text), '')::uuid;
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
    v_actor_id := COALESCE(NULLIF(current_setting('app.actor_id', true), '')::uuid, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := auth.uid();
  END;

  IF v_actor_id IS NULL THEN
    BEGIN
      v_actor_id := COALESCE(
        NULLIF(v_row_data->>'updated_by', '')::uuid,
        NULLIF(v_row_data->>'captured_by_user_id', '')::uuid,
        NULLIF(v_row_data->>'owner_id', '')::uuid
      );
    EXCEPTION WHEN OTHERS THEN
      v_actor_id := NULL;
    END;
  END IF;

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

CREATE OR REPLACE FUNCTION public.delete_account_permanently(
  p_confirmation_name text,
  p_confirmation_phrase text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_org_name text;
  v_owner_id uuid;
  v_member_ids uuid[];
  v_member_text_ids text[];
  v_table record;
  v_fk record;
  v_rows bigint;
  v_pass_deleted bigint;
  v_has_storage boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated account required.' USING ERRCODE = '42501';
  END IF;

  IF p_confirmation_phrase IS DISTINCT FROM 'DELETE MY ACCOUNT' THEN
    RAISE EXCEPTION 'Invalid deletion confirmation.' USING ERRCODE = '42501';
  END IF;

  -- Lock membership first, then serialize the tenant-wide destructive action.
  SELECT membership.org_id
  INTO v_org_id
  FROM public.profiles AS membership
  WHERE membership.id = v_user_id
    AND membership.role::text = 'owner'
  FOR UPDATE;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only the organization owner can delete this account.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_org_id::text, 0)
  );

  SELECT organization.name, organization.owner_id
  INTO v_org_name, v_owner_id
  FROM public.organizations AS organization
  WHERE organization.id = v_org_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'The authenticated owner does not control this organization.' USING ERRCODE = '42501';
  END IF;

  IF btrim(p_confirmation_name) IS DISTINCT FROM btrim(v_org_name) THEN
    RAISE EXCEPTION 'Organization name does not match.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(membership.id ORDER BY membership.id), '{}'::uuid[])
  INTO v_member_ids
  FROM public.profiles AS membership
  WHERE membership.org_id = v_org_id;

  IF NOT (v_user_id = ANY(v_member_ids)) THEN
    RAISE EXCEPTION 'Owner membership is missing.' USING ERRCODE = '42501';
  END IF;

  -- Supabase Storage objects are managed by the Storage API, not by direct
  -- SQL deletes. Refuse to leave owned bytes behind if a future deployment
  -- introduces account-owned Storage objects.
  IF pg_catalog.to_regclass('storage.objects') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns AS storage_column
       WHERE storage_column.table_schema = 'storage'
         AND storage_column.table_name = 'objects'
         AND storage_column.column_name = 'owner_id'
     ) THEN
    SELECT array_agg(member_id::text ORDER BY member_id::text)
    INTO v_member_text_ids
    FROM unnest(v_member_ids) AS member_id;

    EXECUTE 'SELECT EXISTS (
      SELECT 1
      FROM storage.objects
      WHERE owner_id = ANY($1::text[])
    )'
    INTO v_has_storage
    USING v_member_text_ids;

    IF v_has_storage THEN
      RAISE EXCEPTION 'Account-owned Storage files must be removed before this account can be deleted.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  PERFORM set_config('app.account_deletion', 'true', true);
  PERFORM set_config('app.payroll_reversal', 'true', true);

  -- Referral rows can point across organizations, so remove dependent rows
  -- before the target organization's referral code and use rows.
  DELETE FROM public.referral_discount_windows AS discount_window
  WHERE discount_window.referrer_org_id = v_org_id
     OR EXISTS (
       SELECT 1
       FROM public.referral_uses AS usage
       LEFT JOIN public.referral_codes AS code
         ON code.id = usage.referral_code_id
       WHERE usage.id = discount_window.referral_use_id
         AND (
           usage.referee_org_id = v_org_id
           OR code.org_id = v_org_id
         )
     );

  DELETE FROM public.referral_refunds AS refund
  WHERE refund.referrer_org_id = v_org_id;

  DELETE FROM public.referral_uses AS usage
  WHERE usage.referee_org_id = v_org_id
     OR EXISTS (
       SELECT 1
       FROM public.referral_codes AS code
       WHERE code.id = usage.referral_code_id
         AND code.org_id = v_org_id
     );

  DELETE FROM public.referral_codes AS code
  WHERE code.org_id = v_org_id;

  -- machine_assignments predates its denormalized org_id. Include both
  -- boundaries so legacy rows cannot survive through a NULL org_id.
  DELETE FROM public.machine_assignments AS assignment
  WHERE assignment.org_id = v_org_id
     OR EXISTS (
       SELECT 1
       FROM public.machines AS machine
       WHERE machine.id = assignment.machine_id
         AND machine.org_id = v_org_id
     );

  -- This NOT NULL profile foreign key must be removed before profiles.
  DELETE FROM public.supervisor_float_transactions
  WHERE org_id = v_org_id;

  -- Nullable profile foreign keys can otherwise block profile deletion. Only
  -- touch rows that are already tenant-scoped to this organization.
  FOR v_fk IN
    SELECT child_namespace.nspname AS child_schema,
           child_relation.relname AS child_table,
           child_attribute.attname AS child_column
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS child_relation
      ON child_relation.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS child_namespace
      ON child_namespace.oid = child_relation.relnamespace
    JOIN pg_catalog.pg_attribute AS child_attribute
      ON child_attribute.attrelid = child_relation.oid
     AND child_attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.profiles'::regclass
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
      AND child_namespace.nspname = 'public'
      AND child_relation.relkind IN ('r', 'p')
      AND child_attribute.attnotnull IS FALSE
      AND child_relation.relname <> 'profiles'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute AS org_attribute
        WHERE org_attribute.attrelid = child_relation.oid
          AND org_attribute.attname = 'org_id'
          AND org_attribute.attnum > 0
          AND NOT org_attribute.attisdropped
      )
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = NULL WHERE org_id = $1 AND %I = ANY($2)',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.child_column,
      v_fk.child_column
    ) USING v_org_id, v_member_ids;
  END LOOP;

  -- Delete every current and future tenant table that carries the canonical
  -- org_id key. Repeated passes resolve restrictive child foreign keys without
  -- swallowing any error other than a dependency that can be resolved later.
  LOOP
    v_pass_deleted := 0;

    FOR v_table IN
      SELECT DISTINCT relation.relname AS table_name
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      JOIN pg_catalog.pg_attribute AS org_attribute
        ON org_attribute.attrelid = relation.oid
       AND org_attribute.attname = 'org_id'
       AND org_attribute.attnum > 0
       AND NOT org_attribute.attisdropped
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relname NOT IN ('organizations', 'profiles', 'audit_log')
      ORDER BY relation.relname
    LOOP
      BEGIN
        EXECUTE format(
          'DELETE FROM public.%I WHERE org_id = $1',
          v_table.table_name
        ) USING v_org_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_pass_deleted := v_pass_deleted + v_rows;
      EXCEPTION WHEN foreign_key_violation THEN
        NULL;
      END;
    END LOOP;

    EXIT WHEN v_pass_deleted = 0;
  END LOOP;

  -- factory_cost_profile uses factory_id rather than org_id. Delete it after
  -- the org_id sweep so any future restrictive quote/profile dependency has
  -- already been removed.
  DELETE FROM public.factory_cost_profile
  WHERE factory_id = v_org_id;

  DELETE FROM public.profiles
  WHERE org_id = v_org_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> cardinality(v_member_ids) THEN
    RAISE EXCEPTION 'Account deletion stopped because member profiles remain.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.organizations
  WHERE id = v_org_id
    AND owner_id = v_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Account deletion stopped because the organization was not removed.'
      USING ERRCODE = '23503';
  END IF;

  -- Audit history is part of the account's tenant data and must not survive.
  DELETE FROM public.audit_log
  WHERE org_id = v_org_id;

  -- Remove nullable references from any public table before the hard Auth
  -- delete. Non-nullable references intentionally fail the transaction rather
  -- than leaving an orphaned identity.
  FOR v_fk IN
    SELECT child_namespace.nspname AS child_schema,
           child_relation.relname AS child_table,
           child_attribute.attname AS child_column
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS child_relation
      ON child_relation.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS child_namespace
      ON child_namespace.oid = child_relation.relnamespace
    JOIN pg_catalog.pg_attribute AS child_attribute
      ON child_attribute.attrelid = child_relation.oid
     AND child_attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'auth.users'::regclass
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
      AND child_namespace.nspname = 'public'
      AND child_relation.relkind IN ('r', 'p')
      AND child_attribute.attnotnull IS FALSE
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = NULL WHERE %I = ANY($1)',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.child_column,
      v_fk.child_column
    ) USING v_member_ids;
  END LOOP;

  DELETE FROM auth.users
  WHERE id = ANY(v_member_ids);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> cardinality(v_member_ids) THEN
    RAISE EXCEPTION 'Account deletion stopped because Auth identities remain.'
      USING ERRCODE = '23503';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_member_count', cardinality(v_member_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_permanently(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account_permanently(text, text)
  TO authenticated;

COMMENT ON FUNCTION public.delete_account_permanently(text, text)
IS 'Owner-confirmed, transactionally permanent deletion of one organization, all tenant data, members, and their Auth identities.';
