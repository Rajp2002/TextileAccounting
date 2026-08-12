-- The audit_log table has a restrictive premium-tenant policy. The global
-- platform lockdown is intentionally outside any tenant, but must still be
-- auditable by a platform admin through the invoker RPC. Keep the exception
-- narrow: only the canonical global-security audit row is allowed.

DROP POLICY IF EXISTS requires_premium_subscription ON public.audit_log;

CREATE POLICY requires_premium_subscription
  ON public.audit_log
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.org_has_subscription_tier(org_id, 'premium')
    OR (
      org_id IS NULL
      AND table_name = 'platform_security'
      AND record_id = 'GLOBAL'
      AND changed_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND profile.role::text = 'admin'
      )
    )
  )
  WITH CHECK (
    public.org_has_subscription_tier(org_id, 'premium')
    OR (
      org_id IS NULL
      AND table_name = 'platform_security'
      AND record_id = 'GLOBAL'
      AND changed_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND profile.role::text = 'admin'
      )
    )
  );
