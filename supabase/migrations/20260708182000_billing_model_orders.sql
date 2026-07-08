-- ============================================================
-- MIGRATION: Add Order Billing Columns to org_subscriptions
-- ============================================================
-- Adds billing_model, razorpay_order_id, and razorpay_payment_id to org_subscriptions.
-- This allows tracking order-based checkout data.

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS billing_model text,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

-- Index for order-based lookups
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_order_id
  ON public.org_subscriptions(razorpay_order_id);
