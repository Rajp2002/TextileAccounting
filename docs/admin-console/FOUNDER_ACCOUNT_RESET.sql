-- DESTRUCTIVE: explicitly authorized reset of Raj's abandoned account.
-- Run the COMPLETE file in the SAME verified project's SQL Editor as postgres.
-- Exact old Auth UUID/email and factory UUID/name are fixed below.
-- Removes the reviewed local factory records (including payment history),
-- then the old Auth identity. Does not refund/change anything at Razorpay.
-- No credentials are created. Recreate the user in Authentication > Users.
-- Retains one minimal platform operation audit, without old customer payloads.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
DO $founder_account_reset$
DECLARE
  old_user constant uuid := 'd0e56517-29f9-474f-b368-9e63e84da25a';
  old_org constant uuid := '2420a5a8-d231-4ed2-b9ce-9db986e38879';
  old_email constant text := 'rajpatel86420@gmail.com';
  entry record;
  edge record;
  found_count integer;
  linked boolean;
  join_sql text;
  child_allowed text;
  target_users_before bigint;
  audit_id bigint;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run as postgres; reset made no changes.'; END IF;
  LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM auth.users WHERE id=old_user AND lower(btrim(email))=old_email
    AND email_confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact confirmed old Auth identity not found; reset made no changes.'; END IF;
  IF (SELECT count(*) FROM auth.users WHERE lower(btrim(email))=old_email)<>1 THEN
    RAISE EXCEPTION 'Email identity is ambiguous; reset made no changes.';
  END IF;
  PERFORM 1 FROM public.organizations WHERE id=old_org AND owner_id=old_user AND name='test' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact owned test factory not found; reset made no changes.'; END IF;
  IF (SELECT count(*) FROM public.organizations WHERE owner_id=old_user)<>1
     OR EXISTS(SELECT 1 FROM public.profiles WHERE id=old_user OR org_id=old_org) THEN
    RAISE EXCEPTION 'Ownership/membership changed; reset made no changes.';
  END IF;

  -- Fixed allowlist, not a recursive tenant-data deletion or arbitrary query.
  CREATE TEMP TABLE reset_scope(relation_oid oid PRIMARY KEY, scope_column name NOT NULL,
    expected_count integer NOT NULL, delete_order integer NOT NULL) ON COMMIT DROP;
  INSERT INTO reset_scope VALUES
    ('public.subscription_payments'::regclass,'org_id',1,1),
    ('public.org_subscriptions'::regclass,'org_id',4,2),
    ('public.referral_codes'::regclass,'org_id',1,3),
    ('public.cost_rate_book'::regclass,'org_id',3,4),
    ('public.machine_type_pay_defaults'::regclass,'org_id',5,5),
    ('public.machines'::regclass,'org_id',5,6),
    ('public.workers'::regclass,'org_id',1,7),
    ('public.payroll_configs'::regclass,'org_id',1,8),
    ('public.quality_stock_cutover'::regclass,'org_id',1,9),
    ('public.factory_cost_profile'::regclass,'factory_id',1,10),
    ('public.audit_log'::regclass,'org_id',18,11),
    ('public.organizations'::regclass,'id',1,12);

  -- Serialize application UUID references and Storage metadata during reset.
  -- Lock timeout avoids waiting behind active customer work. No global reset.
  SELECT count(DISTINCT c.oid) INTO found_count FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname IN('public','private','weavly_private') AND c.relkind IN('r','p')
      AND a.atttypid='uuid'::regtype;
  IF found_count>500 THEN RAISE EXCEPTION 'Schema inventory exceeds reviewed bound; reset made no changes.'; END IF;
  FOR entry IN
    SELECT DISTINCT n.nspname,c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname IN('public','private','weavly_private') AND c.relkind IN('r','p')
      AND a.atttypid='uuid'::regtype ORDER BY n.nspname,c.relname
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',entry.nspname,entry.relname);
  END LOOP;
  LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO target_users_before FROM auth.users;

  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.audit_log'::regclass
    AND attname='org_id' AND NOT attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Required global operator audit shape unavailable; reset made no changes.';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i JOIN reset_scope s ON s.relation_oid=i.inhparent)
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite r JOIN reset_scope s ON s.relation_oid=r.ev_class
               WHERE r.ev_type='4') THEN
    RAISE EXCEPTION 'Unreviewed inheritance/delete rule; reset made no changes.';
  END IF;
  -- Exact trusted DELETE trigger definitions, not only their stable OIDs.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN reset_scope s ON s.relation_oid=t.tgrelid
    WHERE NOT t.tgisinternal AND (t.tgtype::integer & 8)<>0 AND (
      t.tgenabled<>'O' OR encode(sha256(convert_to(pg_catalog.pg_get_functiondef(t.tgfoid),'UTF8')),'hex') NOT IN(
        '5f0bbc9618e3e2f19114fc3c8ead2d845f557795594666eb7e34371314991c45',
        'f0dcf503d8abd4852c2f710f698faf3ee6e6e67747e6922cb6c3e363b5c228ab',
        '4efb7954a5d0ce4b269cb246a3e7da102124e3fa5ac865fbc2db89fe0eb430f3'
      ))) THEN
    RAISE EXCEPTION 'Unreviewed DELETE trigger definition; reset made no changes.';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='auth.users'::regclass
    AND NOT tgisinternal AND (tgtype::integer & 8)<>0)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class='auth.users'::regclass AND ev_type='4') THEN
    RAISE EXCEPTION 'Unreviewed Auth DELETE trigger; reset made no changes.';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.audit_log'::regclass
    AND NOT tgisinternal AND (tgtype::integer & 4)<>0)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class='public.audit_log'::regclass AND ev_type='3') THEN
    RAISE EXCEPTION 'Unreviewed operator audit INSERT behavior; reset made no changes.';
  END IF;
  -- Serialize provider-managed account relations without locking the protected
  -- provider migration ledger. It is unrelated only if it has neither identity
  -- columns, unknown domain types nor FK edges; unexpected shapes fail closed. No Auth grants,
  -- ownership, schema or provider migration records are changed.
  FOR entry IN SELECT n.nspname,c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'
      AND c.relkind IN('r','p') AND NOT (c.relname='schema_migrations'
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid
          AND a.attnum>0 AND NOT a.attisdropped AND (a.atttypid='uuid'::regtype
            OR a.attname IN('user_id','linking_target_id')
            OR EXISTS(SELECT 1 FROM pg_catalog.pg_type t WHERE t.oid=a.atttypid AND t.typtype='d')))
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint f WHERE f.contype='f'
          AND (f.conrelid=c.oid OR f.confrelid=c.oid))) ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',entry.nspname,entry.relname);
  END LOOP;
  CREATE TEMP TABLE reset_auth_paths ON COMMIT DROP AS
    WITH RECURSIVE paths AS (
      SELECT 'auth.users'::regclass::oid AS relation_oid,0 AS depth,
        ARRAY['auth.users'::regclass::oid] AS visited,
        'auth.users AS t0'::text COLLATE "C" AS from_sql,'auth'::name AS schema_name,'c'::"char" AS delete_action
      UNION ALL
      SELECT f.conrelid,p.depth+1,p.visited||f.conrelid,
        p.from_sql||format(' JOIN %I.%I AS t%s ON ',n.nspname,c.relname,p.depth+1)||
        (SELECT string_agg(format('t%s.%I=t%s.%I',p.depth+1,ca.attname,p.depth,pa.attname),' AND ' ORDER BY k.ord)
          FROM unnest(f.conkey,f.confkey) WITH ORDINALITY k(child_key,parent_key,ord)
          JOIN pg_catalog.pg_attribute ca ON ca.attrelid=f.conrelid AND ca.attnum=k.child_key
          JOIN pg_catalog.pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.parent_key),n.nspname,f.confdeltype
      FROM paths p JOIN pg_catalog.pg_constraint f ON f.confrelid=p.relation_oid AND f.contype='f'
      JOIN pg_catalog.pg_class c ON c.oid=f.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE p.depth<12 AND p.schema_name='auth' AND NOT f.conrelid=ANY(p.visited)
    ) SELECT * FROM paths;
  IF (SELECT count(*) FROM reset_auth_paths)>500 OR EXISTS(SELECT 1 FROM reset_auth_paths WHERE depth=12) THEN
    RAISE EXCEPTION 'Managed Auth dependency graph exceeds reviewed bound; reset made no changes.';
  END IF;
  FOR entry IN SELECT * FROM reset_auth_paths WHERE schema_name='auth' AND delete_action IN('n','d')
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE t0.id=$1)',entry.from_sql) INTO linked USING old_user;
    IF linked THEN RAISE EXCEPTION 'Managed Auth detach/default requires review; reset made no changes.'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i JOIN reset_auth_paths p ON p.relation_oid=i.inhparent
    WHERE p.schema_name='auth') THEN
    RAISE EXCEPTION 'Unreviewed managed Auth inheritance; reset made no changes.';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN reset_auth_paths p ON p.relation_oid=t.tgrelid
    WHERE p.schema_name='auth' AND NOT t.tgisinternal AND (t.tgtype::integer & (8|16))<>0)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite r JOIN reset_auth_paths p ON p.relation_oid=r.ev_class
      WHERE p.schema_name='auth' AND r.ev_type IN('2','4')) THEN
    RAISE EXCEPTION 'Unreviewed managed Auth cascade trigger/rule; reset made no changes.';
  END IF;
  FOR entry IN SELECT s.*,n.nspname,c.relname FROM reset_scope s
    JOIN pg_catalog.pg_class c ON c.oid=s.relation_oid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=$1',entry.nspname,entry.relname,entry.scope_column)
      INTO found_count USING old_org;
    IF found_count<>entry.expected_count THEN
      RAISE EXCEPTION 'Reviewed row count changed in %.%; reset made no changes.',entry.nspname,entry.relname;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE org_id=old_org
    AND id='f63d700b-53a0-4de9-ab07-4751ce18ce7b'::uuid AND status='captured' AND amount_paise=1770000
    AND razorpay_payment_id='pay_TBKE6J8xxIQLZO' AND razorpay_order_id='order_TBKDj1hedLSQdK') THEN
    RAISE EXCEPTION 'Reviewed local payment changed; reset made no changes.';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.objects o WHERE to_jsonb(o)->>'owner'=old_user::text
    OR to_jsonb(o)->>'owner_id'=old_user::text OR o.name LIKE old_org::text || '/%'
    OR o.name LIKE old_user::text || '/%') THEN
    RAISE EXCEPTION 'New account-owned Storage objects found; reset made no changes.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass
    AND attname IN('owner','owner_id') AND attnum>0 AND NOT attisdropped
    AND atttypid IN('uuid'::regtype,'text'::regtype,'varchar'::regtype)) THEN
    RAISE EXCEPTION 'Storage owner mapping unavailable; reset made no changes.';
  END IF;
  -- Known non-FK links must not detach a different factory's evidence.
  IF EXISTS(SELECT 1 FROM public.worker_consent_artifacts a JOIN public.workers w
    ON a.worker_id=w.id WHERE w.org_id=old_org)
    OR EXISTS(SELECT 1 FROM public.billing_payment_refunds WHERE razorpay_payment_id='pay_TBKE6J8xxIQLZO')
    OR EXISTS(SELECT 1 FROM public.referral_refunds WHERE razorpay_payment_id='pay_TBKE6J8xxIQLZO') THEN
    RAISE EXCEPTION 'Additional consent/refund evidence found; reset made no changes.';
  END IF;
  IF pg_catalog.to_regclass('private.admin_billing_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM private.admin_billing_facts WHERE payment_reference=$1 OR source_record_id::text=$2)'
      INTO linked USING 'pay_TBKE6J8xxIQLZO','f63d700b-53a0-4de9-ab07-4751ce18ce7b';
    IF linked THEN RAISE EXCEPTION 'Additional billing projection evidence found; reset made no changes.'; END IF;
  END IF;

  -- Every other canonical organization boundary must still be empty.
  FOR entry IN SELECT n.nspname,c.relname,a.attname,c.oid FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname IN('public','private','weavly_private') AND c.relkind IN('r','p')
      AND a.atttypid='uuid'::regtype AND a.attname IN('org_id','factory_id','referrer_org_id','referee_org_id')
      AND NOT EXISTS(SELECT 1 FROM reset_scope s WHERE s.relation_oid=c.oid AND s.scope_column=a.attname)
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',entry.nspname,entry.relname,entry.attname)
      INTO linked USING old_org;
    IF linked THEN RAISE EXCEPTION 'Additional linked records in %.%; reset made no changes.',entry.nspname,entry.relname; END IF;
  END LOOP;

  -- Check ALL FK children of selected rows, including NULL/cross-org edges.
  -- Only another explicitly selected row may be affected by a cascade/detach.
  FOR edge IN SELECT f.oid,f.conrelid,f.confrelid,s.scope_column AS parent_scope,
    pn.nspname AS parent_schema,pc.relname AS parent_table,cn.nspname AS child_schema,cc.relname AS child_table,
    cs.scope_column AS child_scope
    FROM pg_catalog.pg_constraint f JOIN reset_scope s ON s.relation_oid=f.confrelid
    JOIN pg_catalog.pg_class pc ON pc.oid=f.confrelid JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
    JOIN pg_catalog.pg_class cc ON cc.oid=f.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    LEFT JOIN reset_scope cs ON cs.relation_oid=f.conrelid WHERE f.contype='f'
  LOOP
    SELECT string_agg(format('child.%I=parent.%I',ca.attname,pa.attname),' AND ' ORDER BY k.ord)
      INTO join_sql FROM pg_catalog.pg_constraint f
      CROSS JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY k(child_key,parent_key,ord)
      JOIN pg_catalog.pg_attribute ca ON ca.attrelid=f.conrelid AND ca.attnum=k.child_key
      JOIN pg_catalog.pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.parent_key WHERE f.oid=edge.oid;
    EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',edge.child_schema,edge.child_table);
    child_allowed:=CASE WHEN edge.child_scope IS NOT NULL THEN format('child.%I=$1',edge.child_scope) ELSE 'FALSE' END;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I child JOIN %I.%I parent ON %s WHERE parent.%I=$1 AND NOT COALESCE((%s),FALSE))',
      edge.child_schema,edge.child_table,edge.parent_schema,edge.parent_table,join_sql,edge.parent_scope,child_allowed)
      INTO linked USING old_org;
    IF linked THEN RAISE EXCEPTION 'Additional/cross-factory child in %.%; reset made no changes.',edge.child_schema,edge.child_table; END IF;
  END LOOP;

  PERFORM set_config('app.account_deletion','true',true);
  PERFORM set_config('app.payroll_reversal','true',true);
  FOR entry IN SELECT s.*,n.nspname,c.relname FROM reset_scope s
    JOIN pg_catalog.pg_class c ON c.oid=s.relation_oid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    ORDER BY s.delete_order
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE %I=$1',entry.nspname,entry.relname,entry.scope_column) USING old_org;
  END LOOP;
  -- Remove any legacy deletion audit generated during this exact reset.
  DELETE FROM public.audit_log WHERE org_id=old_org;

  -- Refuse references from any remaining application row before Auth delete.
  -- Managed Auth children are handled by Supabase's own FK cascades.
  FOR entry IN SELECT n.nspname,c.relname,a.attname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname IN('public','private','weavly_private') AND c.relkind IN('r','p') AND a.atttypid='uuid'::regtype
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',entry.nspname,entry.relname,entry.attname)
      INTO linked USING old_user;
    IF linked THEN RAISE EXCEPTION 'Remaining identity reference in %.%; transaction rolled back.',entry.nspname,entry.relname; END IF;
  END LOOP;
  -- References outside the known application schemas are never cascaded away.
  FOR edge IN SELECT f.oid,n.nspname,c.relname FROM pg_catalog.pg_constraint f
    JOIN pg_catalog.pg_class c ON c.oid=f.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE f.contype='f' AND f.confrelid='auth.users'::regclass AND n.nspname<>'auth'
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',edge.nspname,edge.relname);
    SELECT string_agg(format('child.%I=parent.%I',ca.attname,pa.attname),' AND ' ORDER BY k.ord)
      INTO join_sql FROM pg_catalog.pg_constraint f
      CROSS JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY k(child_key,parent_key,ord)
      JOIN pg_catalog.pg_attribute ca ON ca.attrelid=f.conrelid AND ca.attnum=k.child_key
      JOIN pg_catalog.pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.parent_key WHERE f.oid=edge.oid;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I child JOIN auth.users parent ON %s WHERE parent.id=$1)',edge.nspname,edge.relname,join_sql)
      INTO linked USING old_user;
    IF linked THEN RAISE EXCEPTION 'Remaining external Auth reference in %.%; transaction rolled back.',edge.nspname,edge.relname; END IF;
  END LOOP;
  FOR entry IN SELECT DISTINCT p.relation_oid,n.nspname,c.relname FROM reset_auth_paths p
    JOIN pg_catalog.pg_class c ON c.oid=p.relation_oid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE p.schema_name<>'auth' ORDER BY n.nspname,c.relname
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',entry.nspname,entry.relname);
  END LOOP;
  FOR entry IN SELECT * FROM reset_auth_paths WHERE schema_name<>'auth'
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE t0.id=$1)',entry.from_sql) INTO linked USING old_user;
    IF linked THEN RAISE EXCEPTION 'Remaining external Auth cascade reference; transaction rolled back.'; END IF;
  END LOOP;
  DELETE FROM auth.users WHERE id=old_user AND lower(btrim(email))=old_email;
  GET DIAGNOSTICS found_count=ROW_COUNT;
  IF found_count<>1 OR (SELECT count(*) FROM auth.users)<>target_users_before-1
     OR EXISTS(SELECT 1 FROM public.organizations WHERE id=old_org) THEN
    RAISE EXCEPTION 'Reset postcondition failed; transaction rolled back.';
  END IF;
  -- Older provider schemas may have non-FK flow/token owner columns. Refuse
  -- leftovers instead of claiming a complete runtime reset or editing them.
  FOR entry IN SELECT c.relname,a.attname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='auth' AND c.relkind IN('r','p') AND (
      a.atttypid='uuid'::regtype OR (a.attname IN('user_id','linking_target_id')
        AND a.atttypid IN('text'::regtype,'varchar'::regtype)))
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM auth.%I WHERE %I::text=$1)',entry.relname,entry.attname)
      INTO linked USING old_user::text;
    IF linked THEN RAISE EXCEPTION 'Remaining managed Auth runtime reference in auth.%; transaction rolled back.',entry.relname; END IF;
  END LOOP;
  INSERT INTO public.audit_log(org_id,table_name,record_id,action,old_data,new_data,changed_by)
    VALUES(NULL,'founder_account_reset',old_org::text,'DELETE',NULL,
      jsonb_build_object('status','completed','deletedAuthUsers',1,'deletedFactories',1),NULL)
    RETURNING id INTO audit_id;
  GET DIAGNOSTICS found_count=ROW_COUNT;
  IF found_count<>1 OR audit_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.audit_log
    WHERE id=audit_id AND org_id IS NULL AND changed_by IS NULL AND table_name='founder_account_reset'
      AND record_id=old_org::text AND action='DELETE'
      AND new_data=jsonb_build_object('status','completed','deletedAuthUsers',1,'deletedFactories',1)) THEN
    RAISE EXCEPTION 'Required operator audit not recorded; transaction rolled back.';
  END IF;
END;
$founder_account_reset$;
COMMIT;

-- Expected: old_auth_exists=false, old_factory_exists=false.
SELECT EXISTS(SELECT 1 FROM auth.users WHERE id='d0e56517-29f9-474f-b368-9e63e84da25a') AS old_auth_exists,
       EXISTS(SELECT 1 FROM public.organizations WHERE id='2420a5a8-d231-4ed2-b9ce-9db986e38879') AS old_factory_exists;
