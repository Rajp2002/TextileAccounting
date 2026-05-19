-- Reconcile legacy fabric stock-sale receivables that kept anonymous party
-- fallbacks before party-first stock sales populated named parties.

WITH receivable_reconciliation AS (
  SELECT
    cr.id AS receivable_id,
    COALESCE(
      NULLIF(NULLIF(BTRIM(fss.party_name), ''), 'Anonymous'),
      NULLIF(NULLIF(BTRIM(lot_order.party_name), ''), 'Anonymous'),
      NULLIF(NULLIF(BTRIM(receivable_order.party_name), ''), 'Anonymous'),
      NULLIF(NULLIF(BTRIM(cr.party_name), ''), 'Anonymous')
    ) AS reconciled_party_name,
    COALESCE(cr.credit_days, fss.credit_days) AS reconciled_credit_days,
    COALESCE(cr.due_date, fss.due_date) AS reconciled_due_date
  FROM commercial_receivables cr
  JOIN fabric_stock_sales fss
    ON fss.id = cr.source_id
   AND fss.org_id = cr.org_id
  LEFT JOIN fabric_stock_lots fsl
    ON fsl.id = fss.stock_lot_id
   AND fsl.org_id = fss.org_id
  LEFT JOIN orders lot_order
    ON lot_order.id = fsl.order_id
   AND lot_order.org_id = fss.org_id
  LEFT JOIN orders receivable_order
    ON receivable_order.id = cr.order_id
   AND receivable_order.org_id = cr.org_id
  WHERE cr.source_type = 'fabric_stock_sale'
    AND (
      cr.party_name IS NULL
      OR BTRIM(cr.party_name) = ''
      OR cr.party_name = 'Anonymous'
      OR cr.due_date IS NULL
      OR cr.credit_days IS NULL
    )
)
UPDATE commercial_receivables cr
SET
  party_name = rr.reconciled_party_name,
  credit_days = rr.reconciled_credit_days,
  due_date = rr.reconciled_due_date,
  updated_at = NOW()
FROM receivable_reconciliation rr
WHERE cr.id = rr.receivable_id
  AND rr.reconciled_party_name IS NOT NULL;
