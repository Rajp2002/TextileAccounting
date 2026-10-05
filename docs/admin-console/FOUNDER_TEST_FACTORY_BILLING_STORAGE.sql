-- READ ONLY: run the complete SELECT in the same project's Supabase SQL Editor.
-- Safe selected references/counts only; no credentials, forms or worker values.
-- An absent mode field means unknown, not live/test. No provider request occurs.
WITH target AS MATERIALIZED (
 SELECT 'd0e56517-29f9-474f-b368-9e63e84da25a'::uuid AS user_id,
        '2420a5a8-d231-4ed2-b9ce-9db986e38879'::uuid AS org_id
), assertion AS MATERIALIZED (
 SELECT t.*, current_user='postgres'
  AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.user_id
   AND lower(btrim(u.email))='rajpatel86420@gmail.com' AND u.email_confirmed_at IS NOT NULL)
  AND EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=t.org_id
   AND o.owner_id=t.user_id AND o.name='test')
  AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=t.user_id OR p.org_id=t.org_id)
  AS verified FROM target t
), payments AS MATERIALIZED (
 SELECT p.*,to_jsonb(p) AS fields FROM public.subscription_payments p
 JOIN assertion a ON a.verified AND p.org_id=a.org_id
 ORDER BY p.id LIMIT 101
), terms AS MATERIALIZED (
 SELECT s.*,to_jsonb(s) AS fields FROM public.org_subscriptions s
 JOIN assertion a ON a.verified AND s.org_id=a.org_id
 ORDER BY s.id LIMIT 101
), storage_matches AS MATERIALIZED (
 SELECT 1 FROM storage.objects o CROSS JOIN assertion a
 WHERE a.verified AND (
  to_jsonb(o)->>'owner'=a.user_id::text OR to_jsonb(o)->>'owner_id'=a.user_id::text
  OR o.name LIKE a.org_id::text || '/%' OR o.name LIKE a.user_id::text || '/%')
 LIMIT 101
), storage_mapping AS MATERIALIZED (
 SELECT count(*)>0 AS available,coalesce(jsonb_agg(attname ORDER BY attname),'[]'::jsonb) AS columns
 FROM pg_catalog.pg_attribute WHERE attrelid='storage.objects'::regclass
 AND attnum>0 AND NOT attisdropped AND attname IN('owner','owner_id')
 AND atttypid IN('uuid'::regtype,'text'::regtype,'varchar'::regtype)
)
SELECT 'assertion' AS section,jsonb_build_object('verified',a.verified,
 'detail',CASE WHEN a.verified THEN 'Exact confirmed identity, test factory and missing profiles still match.'
 ELSE 'Target/identity/profile/operator assertion failed. Stop; nothing changed.' END) AS evidence
FROM assertion a
UNION ALL
SELECT 'payment',jsonb_build_object(
 'id',p.id,'status',p.status,'amount_paise',p.amount_paise::text,
 'currency',p.fields->>'currency','mode',p.fields->>'mode',
 'razorpay_payment_id',p.razorpay_payment_id,'razorpay_order_id',p.razorpay_order_id,
 'subscription_id',p.subscription_id,'billing_attempt_id',p.fields->>'billing_attempt_id',
 'captured_at',p.captured_at,'created_at',p.created_at)
FROM payments p
UNION ALL
SELECT 'subscription',jsonb_build_object(
 'id',s.id,'status',s.status,'plan_tier',s.fields->>'plan_tier',
 'billing_model',s.fields->>'billing_model','current_start',s.current_start,'current_end',s.current_end,
 'paid_count',s.paid_count,'razorpay_subscription_id',s.razorpay_subscription_id,
 'razorpay_order_id',s.fields->>'razorpay_order_id','razorpay_payment_id',s.fields->>'razorpay_payment_id',
 'billing_attempt_id',s.fields->>'billing_attempt_id')
FROM terms s
UNION ALL
SELECT 'storage',jsonb_build_object(
 'source','storage.objects','ownership_status',CASE WHEN m.available THEN 'available' ELSE 'unavailable' END,
 'matching_objects_upto_101',CASE WHEN m.available THEN (SELECT count(*) FROM storage_matches) END,
 'more_than_100',CASE WHEN m.available THEN (SELECT count(*) FROM storage_matches)>100 END,
 'ownership_columns',m.columns,
 'coverage','Owner/owner_id and UUID-prefix paths only; other path/metadata/provider links remain unverified.')
FROM assertion a CROSS JOIN storage_mapping m WHERE a.verified
UNION ALL
SELECT 'bounds',jsonb_build_object('payment_rows_upto_101',(SELECT count(*) FROM payments),
 'subscription_rows_upto_101',(SELECT count(*) FROM terms),'overflow',(SELECT count(*) FROM payments)>100 OR (SELECT count(*) FROM terms)>100)
FROM assertion a WHERE a.verified
ORDER BY section;
