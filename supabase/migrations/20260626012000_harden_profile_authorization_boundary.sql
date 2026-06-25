-- Batch 1A: harden the mutable profile authorization boundary.
--
-- profiles.id, profiles.role, and profiles.org_id are authorization fields.
-- They must be server-managed even when users can update ordinary profile
-- preferences such as contact/WhatsApp settings.

REVOKE INSERT ON TABLE public.profiles FROM anon, authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;

GRANT UPDATE (
    full_name,
    phone,
    whatsapp_number,
    whatsapp_opted_in,
    whatsapp_opted_in_at
) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update own non-authorization profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_authorization_field_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND (
           NEW.id IS DISTINCT FROM OLD.id
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.org_id IS DISTINCT FROM OLD.org_id
       )
    THEN
        RAISE EXCEPTION 'profile authorization fields are server-managed'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_authorization_field_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_profile_authorization_field_update() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_profile_authorization_field_update() TO service_role;

DROP TRIGGER IF EXISTS protect_profile_authorization_fields ON public.profiles;

CREATE TRIGGER protect_profile_authorization_fields
BEFORE UPDATE OF id, role, org_id ON public.profiles
FOR EACH ROW
WHEN (
    OLD.id IS DISTINCT FROM NEW.id
    OR OLD.role IS DISTINCT FROM NEW.role
    OR OLD.org_id IS DISTINCT FROM NEW.org_id
)
EXECUTE FUNCTION public.prevent_profile_authorization_field_update();
