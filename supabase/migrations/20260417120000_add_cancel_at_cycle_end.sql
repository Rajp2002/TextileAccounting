-- Add cancel_at_cycle_end to org_subscriptions
-- This tracks whether the user has opted out of auto-renewal.
-- When true, Razorpay has been told to cancel the subscription at the end
-- of the current billing cycle rather than auto-charging the next month.

ALTER TABLE public.org_subscriptions
    ADD COLUMN IF NOT EXISTS cancel_at_cycle_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.org_subscriptions.cancel_at_cycle_end IS
    'When true, the Razorpay subscription is set to cancel at the end of the '
    'current billing cycle (no auto-renewal). This is a one-way flag — once '
    'set to true it cannot be reversed; the user must re-subscribe.';
