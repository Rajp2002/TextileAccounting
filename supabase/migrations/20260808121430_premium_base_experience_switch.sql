-- Allow an activated Full Suite organization to use the Base Plan product
-- experience without rewriting subscription or payment history.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS product_experience text NOT NULL DEFAULT 'full_suite';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_product_experience_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_product_experience_check
  CHECK (product_experience IN ('base', 'full_suite'));

COMMENT ON COLUMN public.organizations.product_experience IS
  'Owner-selected product workspace. This may reduce Full Suite access to the Base experience but never elevates the paid subscription tier.';

CREATE OR REPLACE FUNCTION public.org_has_subscription_tier(
  p_org_id uuid,
  p_required text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND p_required IN ('base', 'premium')
    AND (
      COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
      OR (
        COALESCE(auth.jwt() ->> 'role', '') = 'authenticated'
        AND NULLIF(auth.jwt() ->> 'org_id', '')::uuid = p_org_id
        AND EXISTS (
          SELECT 1
          FROM public.profiles AS membership
          WHERE membership.id = auth.uid()
            AND membership.org_id = p_org_id
            AND membership.role::text = auth.jwt() ->> 'user_role'
        )
        AND (
          p_required = 'base'
          OR EXISTS (
            SELECT 1
            FROM public.organizations AS organization
            WHERE organization.id = p_org_id
              AND organization.product_experience = 'full_suite'
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.org_subscriptions AS subscription
          WHERE subscription.org_id = p_org_id
            AND subscription.status IN (
              'active', 'authenticated', 'pending', 'paused',
              'halted', 'cancelled', 'completed'
            )
            AND (subscription.current_start IS NULL OR subscription.current_start <= now())
            AND (
              (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
              OR subscription.current_end + CASE
                WHEN subscription.plan_tier = 'trial' THEN interval '0 seconds'
                ELSE interval '24 hours'
              END >= now()
            )
            AND CASE
              WHEN p_required = 'premium' THEN subscription.plan_tier IN ('premium', 'trial')
              ELSE subscription.plan_tier IN ('base', 'premium', 'trial')
            END
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_subscription_tier(uuid, text) TO authenticated, service_role;
