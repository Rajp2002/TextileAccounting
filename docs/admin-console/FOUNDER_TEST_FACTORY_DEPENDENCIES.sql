-- READ ONLY: one SELECT; no helper installation, account deletion or provider call.
-- Run as postgres in the intended project's Supabase SQL Editor. Result rows,
-- rather than NOTICE messages, contain bounded dependency counts. Save all rows.
-- Exact target supplied by the user; Auth/password/MFA/profile are not changed.
-- Direct organization FKs are inventoried without a table allowlist. Indirect
-- traversal covers the reviewed support/formal/Free/machine-assignment sidecars;
-- other indirect paths remain an explicit coverage limitation.
-- Count 101 means more than 100, not an exact total. Reference paths overlap:
-- never add them together. A missing source is unavailable, never measured zero.
-- PostgreSQL query_to_xml/XMLTABLE: https://www.postgresql.org/docs/16/functions-xml.html
-- Dynamic SQL is SELECT-only, generated from quoted catalogue identifiers and
-- typed fixed UUIDs (%I identifiers / %L literals); no user-supplied SQL/filter.
WITH RECURSIVE
target AS MATERIALIZED (
 SELECT 'd0e56517-29f9-474f-b368-9e63e84da25a'::uuid AS founder_id,
        'rajpatel86420@gmail.com'::text AS founder_email,
        '2420a5a8-d231-4ed2-b9ce-9db986e38879'::uuid AS org_id,
        'test'::text AS org_name
),
assertion AS MATERIALIZED (
 SELECT t.*, CASE
  WHEN current_user <> 'postgres' THEN 'postgres_operator_required'
  WHEN NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.founder_id
    AND lower(btrim(u.email))=lower(btrim(t.founder_email))
    AND u.email_confirmed_at IS NOT NULL) THEN 'confirmed_identity_mismatch'
  WHEN NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=t.org_id
    AND o.owner_id=t.founder_id AND o.name=t.org_name) THEN 'exact_factory_owner_or_name_mismatch'
  WHEN (SELECT count(*) FROM(SELECT 1 FROM public.organizations o WHERE o.owner_id=t.founder_id LIMIT 2)owned)<>1
    THEN 'owned_factory_count_changed'
  WHEN EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=t.founder_id) THEN 'founder_profile_no_longer_missing'
  WHEN EXISTS(SELECT 1 FROM public.profiles p WHERE p.org_id=t.org_id) THEN 'factory_member_profiles_present'
  ELSE NULL END AS error_code
 FROM target t
),
edges AS MATERIALIZED (
 SELECT c.oid AS constraint_oid,c.conrelid AS child_oid,c.confrelid AS parent_oid,
 n.nspname AS schema_name,r.relname AS table_name,c.conname,c.confdeltype,
 jsonb_agg(jsonb_build_object('child',ca.attname,'parent',pa.attname) ORDER BY k.ord) AS columns
 FROM pg_catalog.pg_constraint c
 JOIN pg_catalog.pg_class r ON r.oid=c.conrelid AND r.relkind IN('r','p')
 JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
 CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(child_key,parent_key,ord)
 JOIN pg_catalog.pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=k.child_key
 JOIN pg_catalog.pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=k.parent_key
 WHERE c.contype='f'
 GROUP BY c.oid,c.conrelid,c.confrelid,n.nspname,r.relname,c.conname,c.confdeltype
),
paths AS (
 SELECT 'public.organizations'::regclass::oid AS relation_oid,0 AS depth,
 ARRAY['public.organizations'::regclass::oid] AS visited,
 'public.organizations AS t0'::text COLLATE "C" AS from_sql,
 'public.organizations'::text COLLATE "C" AS source,''::text COLLATE "C" AS detail
 UNION ALL
 SELECT e.child_oid,p.depth+1,p.visited||e.child_oid,
 p.from_sql||format(' JOIN %I.%I AS t%s ON ',e.schema_name,e.table_name,p.depth+1)||
 (SELECT string_agg(format('t%s.%I=t%s.%I',p.depth+1,col->>'child',p.depth,col->>'parent'),' AND ')
    FROM jsonb_array_elements(e.columns)col),
 format('%I.%I',e.schema_name,e.table_name),
 p.detail||CASE WHEN p.depth=0 THEN '' ELSE ' -> ' END||e.conname||
 ' [delete='||CASE e.confdeltype WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null'
 WHEN 'r' THEN 'restrict' WHEN 'd' THEN 'set_default' ELSE 'no_action' END||']'
 FROM paths p JOIN edges e ON e.parent_oid=p.relation_oid
 -- The asserted zero profile population makes every profile-child path zero;
 -- do not expand actor/identity references across unrelated factories.
 WHERE p.depth<4 AND p.relation_oid<>'public.profiles'::regclass::oid
 AND NOT e.child_oid=ANY(p.visited)
 AND(p.depth=0 OR(e.schema_name IN('public','private') AND e.table_name IN(
  'support_messages','support_ticket_events','support_internal_notes',
  'admin_formal_cases','admin_formal_notes','admin_formal_events','admin_formal_revisions',
  'admin_formal_request_results','free_costing_recalculation_receipts','machine_assignments')))
),
canonical AS MATERIALIZED (
 SELECT format('%I.%I',n.nspname,r.relname) AS source,n.nspname,r.relname,a.attname
 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class r ON r.oid=a.attrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
 WHERE n.nspname IN('public','private','weavly_private') AND r.relkind IN('r','p')
 AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid='uuid'::regtype
 AND a.attname IN('org_id','factory_id','referrer_org_id','referee_org_id')
),
catalogue_budget AS MATERIALIZED (
 SELECT (SELECT count(*) FROM paths WHERE depth BETWEEN 1 AND 3)+
        (SELECT count(*) FROM canonical)+8 AS entries
),
fixed_sources(schema_name,table_name,column_name,scope,target_kind) AS (
 VALUES
 ('public','audit_log','record_id','organization_record_reference','org'),
 ('private','admin_audit_events','target_id','organization_record_reference','org'),
 ('public','free_account_subjects','id','shared_owner_account_preserve','founder'),
 ('public','free_account_grants','subject_id','shared_owner_account_preserve','founder'),
 ('public','free_monthly_usage','subject_id','shared_owner_account_preserve','founder'),
 ('public','free_calculation_receipts','subject_id','shared_owner_account_preserve','founder'),
 ('public','free_funnel_events','subject_id','shared_owner_account_preserve','founder'),
 ('public','free_saved_costings','subject_id','shared_owner_account_preserve','founder')
),
fixed_catalogue AS MATERIALIZED (
 SELECT f.*,format('%I.%I',f.schema_name,f.table_name) AS source,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class r JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
 WHERE n.nspname=f.schema_name AND r.relname=f.table_name AND r.relkind IN('r','p')
 AND a.attname=f.column_name AND a.atttypid IN('uuid'::regtype,'text'::regtype,'varchar'::regtype)) AS available
 FROM fixed_sources f
),
required_sources(source) AS (
 VALUES ('public.subscription_payments'),('public.org_subscriptions'),
 ('public.billing_checkout_attempts'),('public.billing_payment_refunds'),('public.billing_invoices'),
 ('public.grievances'),('public.security_incidents'),('public.breach_reports'),
 ('public.legal_document_acceptances'),('public.worker_consent_artifacts'),('public.organization_dpas'),
 ('public.free_account_grants'),('public.free_saved_costings'),('public.factory_cost_profile'),
 ('public.support_tickets'),('private.support_internal_notes'),('private.admin_org_reporting'),
 ('private.admin_billing_facts'),('private.admin_audit_events'),('private.admin_formal_cases'),
 ('private.admin_formal_notes'),('private.admin_formal_events'),('private.admin_formal_revisions'),
 ('private.admin_formal_request_results'),('private.admin_retention_holds')
),
queries AS MATERIALIZED (
 SELECT 'foreign_key'::text AS section,p.source,'factory_dependency'::text AS scope,p.detail,
 format('SELECT count(*)::integer AS bounded_count FROM (SELECT 1 FROM %s WHERE t0.id=%L::uuid LIMIT 101) counted',p.from_sql,a.org_id) AS sql
 FROM paths p CROSS JOIN assertion a CROSS JOIN catalogue_budget b
 WHERE p.depth BETWEEN 1 AND 3 AND a.error_code IS NULL AND b.entries<=500
 UNION ALL
 SELECT 'canonical_uuid',c.source,'factory_dependency',c.attname,
 format('SELECT count(*)::integer AS bounded_count FROM (SELECT 1 FROM %I.%I WHERE %I=%L::uuid LIMIT 101) counted',c.nspname,c.relname,c.attname,a.org_id)
 FROM canonical c CROSS JOIN assertion a CROSS JOIN catalogue_budget b
 WHERE a.error_code IS NULL AND b.entries<=500
 UNION ALL
 SELECT 'fixed_reference',f.source,f.scope,f.column_name,
 format('SELECT count(*)::integer AS bounded_count FROM (SELECT 1 FROM %I.%I WHERE %I::text=%L LIMIT 101) counted',
  f.schema_name,f.table_name,f.column_name,CASE f.target_kind WHEN 'org' THEN a.org_id ELSE a.founder_id END::text)
 FROM fixed_catalogue f CROSS JOIN assertion a CROSS JOIN catalogue_budget b
 WHERE a.error_code IS NULL AND b.entries<=500 AND f.available
),
counts AS MATERIALIZED (
 SELECT q.section,q.source,q.scope,'measured'::text AS status,x.bounded_count AS count_upto_101,
 x.bounded_count>100 AS more_than_100,q.detail
 FROM queries q CROSS JOIN assertion a CROSS JOIN catalogue_budget b
 CROSS JOIN LATERAL XMLTABLE('/table/row' PASSING CASE WHEN a.error_code IS NULL AND b.entries<=500
  THEN pg_catalog.query_to_xml(q.sql,false,false,'') ELSE NULL::xml END
  COLUMNS bounded_count integer PATH 'bounded_count')x
),
result AS (
 SELECT 'assertion'::text AS section,'exact_target'::text AS source,'operator_preflight'::text AS scope,
 CASE WHEN error_code IS NULL THEN 'verified' ELSE 'assertion_failed' END AS status,
 NULL::integer AS count_upto_101,NULL::boolean AS more_than_100,
 coalesce(error_code,'Exact confirmed Auth identity, owned test factory, missing founder profile and zero member profiles verified; no changes made.') AS detail
 FROM assertion
 UNION ALL SELECT * FROM counts
 UNION ALL
 SELECT 'coverage','catalogue_budget','operator_preflight','verified',NULL::integer,NULL::boolean,
 format('Catalogue paths/columns plus eight fixed-reference slots: %s; maximum 500. Each count query reads at most 101 matching rows.',b.entries)
 FROM catalogue_budget b CROSS JOIN assertion a WHERE a.error_code IS NULL AND b.entries<=500
 UNION ALL
 SELECT 'source_coverage',r.source,'factory_dependency','unavailable',NULL::integer,NULL::boolean,'source_not_installed'
 FROM required_sources r CROSS JOIN assertion a
 WHERE a.error_code IS NULL AND pg_catalog.to_regclass(r.source) IS NULL
 UNION ALL
 SELECT 'source_coverage',f.source,f.scope,'unavailable',NULL::integer,NULL::boolean,'source_or_expected_column_not_installed'
 FROM fixed_catalogue f CROSS JOIN assertion a WHERE a.error_code IS NULL AND NOT f.available
 UNION ALL
 SELECT 'coverage','catalogue','factory_dependency','unavailable',NULL::integer,NULL::boolean,'catalogue_exceeds_500_paths_or_columns; no dependency counts executed'
 FROM catalogue_budget b CROSS JOIN assertion a WHERE a.error_code IS NULL AND b.entries>500
 UNION ALL
 SELECT 'coverage','foreign_key_depth','factory_dependency','incomplete',NULL::integer,NULL::boolean,'Foreign-key paths beyond depth 3 exist; deeper dependencies require review.'
 FROM assertion a WHERE a.error_code IS NULL AND EXISTS(SELECT 1 FROM paths WHERE depth=4)
 UNION ALL
 SELECT 'coverage','external_or_unstructured','review_required','incomplete',NULL::integer,NULL::boolean,
 'Other indirect FK paths, Storage/provider records, JSON or text references, triggers and noncanonical identity mappings are not certified empty. Auth and shared owner-account history must be preserved. This report does not prove the factory empty.'
 FROM assertion a WHERE a.error_code IS NULL
)
SELECT section,source,scope,status,count_upto_101,more_than_100,detail
FROM result
ORDER BY CASE status WHEN 'assertion_failed' THEN 0 WHEN 'verified' THEN 1 WHEN 'unavailable' THEN 2 WHEN 'incomplete' THEN 3 ELSE 4 END,
 coalesce(count_upto_101,0) DESC,section,source,detail;
