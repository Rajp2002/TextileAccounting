-- Base access does not require Full Suite's factory setup checklist, so the
-- retained QA organization is a completed Base workspace. Repair only that
-- exact normalized name when it has an access-bearing Base entitlement; no
-- generated UUID or unrelated organization is embedded in this migration.
UPDATE public.organizations AS organization
SET product_experience = 'base',
    onboarding_complete = true
WHERE lower(btrim(organization.name)) = 'base pilot testing'
  AND EXISTS (
    SELECT 1
    FROM public.org_subscriptions AS subscription
    WHERE subscription.org_id = organization.id
      AND subscription.plan_tier = 'base'
      AND subscription.status IN (
        'active', 'authenticated', 'pending', 'paused',
        'halted', 'cancelled', 'completed'
      )
      AND (subscription.current_start IS NULL OR subscription.current_start <= now())
      AND (
        (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
        OR (subscription.current_end IS NOT NULL AND subscription.current_end + interval '24 hours' >= now())
      )
  );
