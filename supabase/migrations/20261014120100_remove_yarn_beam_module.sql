-- Delete the March/April yarn & beam inventory module, data included (owner's decision, 2026-10-14).
--
-- IRREVERSIBLE. Applying this permanently deletes every org's yarn batches, yarn lots, yarn movements, beam cards,
-- beam card lots and order yarn requirements (20260319030000, 20260428130001), the two summary views over them, the
-- yarn batch link on production_logs, and the module's RPCs. None of them has a caller in the app, the edge functions
-- or the scripts; start_party_order_from_estimator belonged to the retired party orders and inserted
-- order_yarn_requirements as its last step, and its _v2 wrapper only called it.
--
-- Kept: public.qualities (the retired orders feature references it) and public.production_logs (the WhatsApp and
-- monthly brief edge functions read it).
BEGIN;

DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('link_batch_to_machine', 'settle_batch_audit', 'get_yield_alert', 'get_batch_yield_report',
                        'get_daily_brief_stats', 'get_kpi_yesterday', 'start_party_order_from_estimator',
                        'start_party_order_from_estimator_v2')
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn);
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.yarn_lot_stock_summary;
DROP VIEW IF EXISTS public.order_yarn_variance_summary;

ALTER TABLE public.production_logs DROP COLUMN IF EXISTS yarn_batch_id;

-- Children before parents. No CASCADE: a dependency this migration missed must fail, not vanish silently.
DROP TABLE IF EXISTS public.beam_card_lots;
DROP TABLE IF EXISTS public.yarn_movements;
DROP TABLE IF EXISTS public.order_yarn_requirements;
DROP TABLE IF EXISTS public.beam_cards;
DROP TABLE IF EXISTS public.yarn_lots;
DROP TABLE IF EXISTS public.yarn_batches;

-- Guard for both removal migrations: refuse to commit while any function still names a deleted table, column or
-- function, for example an overload or a production-only object this repository does not know about.
DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text) INTO leftover
  FROM pg_proc p
  WHERE p.pronamespace IN ('public'::regnamespace, 'private'::regnamespace)
    AND p.prosrc ~ '\m(yarn_stock|yarn_stock_settings|yarn_stock_recipes|yarn_stock_requests|yarn_stock_movements|inventory_audits|inventory_audit_lines|production_stock_lots|delivery_challan_lot_allocations|yarn_lots|yarn_movements|yarn_batches|beam_cards|beam_card_lots|order_yarn_requirements|yarn_lot_stock_summary|order_yarn_variance_summary|yarn_recipe_snapshot|yarn_batch_id|yarn_costing_recipe|validate_quality_activation_yarn)\M';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Functions still reference deleted yarn stock, stock audit or yarn & beam objects: %', leftover;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
