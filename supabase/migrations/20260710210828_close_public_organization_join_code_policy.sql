-- AUTH-012: organizations must never be discoverable through a public join-code
-- policy. Join-code validation is performed by trusted server actions using the
-- service role, so browser clients only need access to their current profile org.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lookup org by join code" ON public.organizations;
DROP POLICY IF EXISTS "Owner can read own org" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.organizations;

CREATE POLICY "Tenant Isolation"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Owner can update organization" ON public.organizations;

CREATE POLICY "Owner can update organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'owner'
  )
)
WITH CHECK (
  id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'owner'
  )
  AND owner_id = (SELECT auth.uid())
);

COMMENT ON POLICY "Tenant Isolation" ON public.organizations IS
  'AUTH-012: authenticated users may read only the organization selected by their protected profile row.';
