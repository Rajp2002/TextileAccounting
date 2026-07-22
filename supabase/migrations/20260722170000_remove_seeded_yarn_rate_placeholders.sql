-- Yarn rates are learned from saved quality and costing snapshots. Remove only
-- untouched placeholders created by the retired rate-book read-time seeding.
-- Rates reviewed or saved by an owner always have at least one history row and
-- are deliberately preserved.
DELETE FROM public.cost_rate_book AS rate
WHERE rate.category IN ('yarn_warp', 'yarn_weft')
  AND rate.source = 'Estimator defaults'
  AND rate.apply_as_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.cost_rate_history AS history
    WHERE history.rate_id = rate.id
  );
