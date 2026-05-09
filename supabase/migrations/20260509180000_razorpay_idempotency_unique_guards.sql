-- ============================================================
-- MIGRATION: Razorpay Idempotency – Database-Level Unique Guards
-- ============================================================
-- Adds missing unique constraint on referral_refunds.razorpay_payment_id
-- so that concurrent duplicate webhook deliveries cannot insert two refund
-- rows for the same payment even if the app-level pre-check is bypassed
-- by a race.
--
-- subscription_payments.razorpay_payment_id already carries UNIQUE from
-- 20260416200000_subscription_schema.sql, so no change is needed there.
--
-- referral_refunds.razorpay_payment_id is NOT NULL (never null), so a
-- plain unique index is correct and does not require a partial index.
-- ============================================================

-- Unique guard: one refund row per Razorpay payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_refunds_payment_id_unique
  ON public.referral_refunds(razorpay_payment_id);
