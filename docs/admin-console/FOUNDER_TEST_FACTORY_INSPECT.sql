-- Read-only operator inspector for the user-confirmed test factory.
-- This is NOT a migration, cleanup, grant, or credential operation.
-- Run only in the independently verified Supabase project with the postgres
-- SQL Editor role. It reads counts/identity metadata, never passwords/tokens.
-- Read the accompanying FOUNDER_TEST_FACTORY_CLEANUP_REVIEW.md first.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='2s';
DO $test_factory_inspect$
DECLARE
 founder_id constant uuid:='d0e56517-29f9-474f-b368-9e63e84da25a';
 founder_email constant text:='rajpatel86420@gmail.com';
 target_org uuid;org_name text;org_created_at timestamptz;owned integer;
 rows_found integer;relations integer;boundary record;review_required boolean;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Use the verified project SQL Editor postgres role.';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=founder_id AND lower(btrim(email))=founder_email AND email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Confirmed Auth UUID/email assertion failed. Stop; nothing was changed.';
 END IF;
 SELECT count(*) INTO owned FROM(SELECT 1 FROM public.organizations WHERE owner_id=founder_id LIMIT 2)q;
 IF owned<>1 THEN RAISE EXCEPTION 'Expected exactly one owned test factory; found % (bounded at2). Stop for target review.',owned;END IF;
 SELECT id,name,created_at INTO target_org,org_name,org_created_at FROM public.organizations WHERE owner_id=founder_id;
 RAISE NOTICE 'TARGET %',jsonb_build_object('orgId',target_org,'name',org_name,'createdAt',org_created_at,'ownerId',founder_id);
 RAISE NOTICE 'FOUNDER PROFILE %',(SELECT jsonb_build_object('present',count(*)=1,'role',max(role::text),'tenantLinked',COALESCE(bool_or(org_id IS NOT NULL),false)) FROM public.profiles WHERE id=founder_id);

 -- Direct organization FKs include cascade/set-null/restrict edges across
 -- every non-system schema, including compound keys. Only counts are read.
 SELECT count(*) INTO relations FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND c.confrelid='public.organizations'::regclass;
 IF relations>500 THEN RAISE EXCEPTION 'Organization FK inventory exceeds reviewed bound500. Stop; unavailable inventory.';END IF;
 FOR boundary IN
  SELECT c.conname,n.nspname schema_name,t.relname table_name,c.confdeltype delete_action,
   string_agg(format('child.%I=parent.%I',a.attname,p.attname),' AND ' ORDER BY k.ordinality)join_sql
  FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
  CROSS JOIN LATERAL unnest(c.conkey,c.confkey)WITH ORDINALITY k(child_key,parent_key,ordinality)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.child_key
  JOIN pg_catalog.pg_attribute p ON p.attrelid=c.confrelid AND p.attnum=k.parent_key
  WHERE c.contype='f' AND c.confrelid='public.organizations'::regclass
  GROUP BY c.conname,n.nspname,t.relname,c.confdeltype ORDER BY n.nspname,t.relname,c.conname
 LOOP
  EXECUTE format('SELECT count(*) FROM(SELECT 1 FROM %I.%I child JOIN public.organizations parent ON %s WHERE parent.id=$1 LIMIT 101)q',boundary.schema_name,boundary.table_name,boundary.join_sql)
   INTO rows_found USING target_org;
  RAISE NOTICE 'FK %',jsonb_build_object('table',boundary.schema_name||'.'||boundary.table_name,'constraint',boundary.conname,'deleteAction',boundary.delete_action,'countUpTo101',rows_found,'moreThan100',rows_found>100);
 END LOOP;

 -- Cover legacy UUID boundaries that may lack an organization FK. Results
 -- can overlap the FK inventory; they are references, not additive totals.
 SELECT count(*) INTO relations FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class t ON t.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname IN('public','private','weavly_private') AND t.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped
  AND a.atttypid='uuid'::regtype AND a.attname IN('org_id','factory_id','referrer_org_id','referee_org_id');
 IF relations>500 THEN RAISE EXCEPTION 'Canonical boundary inventory exceeds reviewed bound500. Stop; unavailable inventory.';END IF;
 FOR boundary IN
  SELECT n.nspname schema_name,t.relname table_name,a.attname column_name
  FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class t ON t.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname IN('public','private','weavly_private') AND t.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped
   AND a.atttypid='uuid'::regtype AND a.attname IN('org_id','factory_id','referrer_org_id','referee_org_id')
  ORDER BY n.nspname,t.relname,a.attname
 LOOP
  EXECUTE format('SELECT count(*) FROM(SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 101)q',boundary.schema_name,boundary.table_name,boundary.column_name)
   INTO rows_found USING target_org;
  RAISE NOTICE 'BOUNDARY %',jsonb_build_object('table',boundary.schema_name||'.'||boundary.table_name,'column',boundary.column_name,'countUpTo101',rows_found,'moreThan100',rows_found>100);
 END LOOP;
 IF pg_catalog.to_regprocedure('private.admin_account_deletion_needs_review(uuid,uuid)') IS NOT NULL THEN
  EXECUTE 'SELECT private.admin_account_deletion_needs_review($1,$2)' INTO review_required USING founder_id,target_org;
  RAISE NOTICE 'RETAINED RECORD REVIEW REQUIRED %',review_required;
 ELSE
  RAISE NOTICE 'RETAINED RECORD REVIEW unavailable: founder/data-rights migrations are not installed.';
 END IF;
 IF pg_catalog.to_regclass('public.free_account_subjects') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM public.free_account_subjects WHERE id=$1' INTO rows_found USING founder_id;
  RAISE NOTICE 'PRESERVE AUTH-SUBJECT Free account count %',rows_found;
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM public.free_account_grants WHERE subject_id=$1 LIMIT 101)q' INTO rows_found USING founder_id;
  RAISE NOTICE 'PRESERVE AUTH-SUBJECT total shared factory grants (bounded101) %',rows_found;
  RAISE NOTICE 'Free usage/receipts/funnel events are shared Auth-subject records; this inspector does not attribute them to this factory or authorize deletion.';
 ELSE
  RAISE NOTICE 'Free account-source inventory unavailable: foundation table missing.';
 END IF;
 RAISE NOTICE 'No writes performed. Storage bytes, provider evidence, non-FK embedded references and applied migration history still require independent verification.';
END;
$test_factory_inspect$;
ROLLBACK;
