-- Dispatched stock-sale rows should not keep lots active in Godown.
-- Older rows can have dispatch_status='dispatched' while pending_dispatch_meters
-- still contains the original sale quantity.

UPDATE fabric_stock_sales
SET
  dispatched_meters = GREATEST(dispatched_meters, meters_sold),
  pending_dispatch_meters = 0
WHERE dispatch_status IN ('dispatched', 'received')
  AND pending_dispatch_meters > 0;

