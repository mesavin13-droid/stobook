-- 006_role_management.sql
--
-- Role transitions are performed by the STOBOOK API, never by the end user:
--   * registering a service center promotes a CUSTOMER to SERVICE_OWNER,
--   * the SUPER_ADMIN allowlist (ADMIN_TELEGRAM_IDS) is synchronised on login.
--
-- Both run inside a transaction marked with stobook.server_context, so the
-- profile privilege guard has to honour that context the same way the
-- appointment and service history guards already do. The RLS UPDATE policy
-- additionally requires the role to stay unchanged for self-service updates,
-- so a client can never escalate itself.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND NOT public.is_server_context()
    AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role)
  THEN
    RAISE EXCEPTION 'Profile role and identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

-- Promotes a customer to service owner. Idempotent: returns the current row
-- unchanged when the profile is already an owner or a platform administrator.
CREATE OR REPLACE FUNCTION public.promote_to_service_owner(target uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF NOT public.is_server_context() THEN
    RAISE EXCEPTION 'Role management is only available to the server';
  END IF;

  UPDATE public.profiles
     SET role = 'SERVICE_OWNER'::public.user_role,
         updated_at = NOW()
   WHERE id = target
     AND role = 'CUSTOMER'::public.user_role
  RETURNING * INTO result;

  IF result IS NULL THEN
    SELECT * INTO result FROM public.profiles WHERE id = target;
  END IF;

  RETURN result;
END;
$$;

-- Synchronises the SUPER_ADMIN allowlist for a single Telegram account.
-- Losing the listing demotes the profile back to a service owner when it owns
-- a center, otherwise to a plain customer.
CREATE OR REPLACE FUNCTION public.sync_super_admin(target_telegram_id bigint, should_be_admin boolean)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_id uuid;
  result public.profiles;
BEGIN
  IF NOT public.is_server_context() THEN
    RAISE EXCEPTION 'Role management is only available to the server';
  END IF;

  SELECT user_id INTO target_id
  FROM public.telegram_accounts
  WHERE telegram_id = target_telegram_id;

  IF target_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF should_be_admin THEN
    UPDATE public.profiles
       SET role = 'SUPER_ADMIN'::public.user_role,
           updated_at = NOW()
     WHERE id = target_id
       AND role <> 'SUPER_ADMIN'::public.user_role
    RETURNING * INTO result;
  ELSE
    UPDATE public.profiles
       SET role = CASE
                    WHEN EXISTS (
                      SELECT 1 FROM public.service_centers sc
                      WHERE sc.owner_id = target_id
                    ) THEN 'SERVICE_OWNER'::public.user_role
                    ELSE 'CUSTOMER'::public.user_role
                  END,
           updated_at = NOW()
     WHERE id = target_id
       AND role = 'SUPER_ADMIN'::public.user_role
    RETURNING * INTO result;
  END IF;

  IF result IS NULL THEN
    SELECT * INTO result FROM public.profiles WHERE id = target_id;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_to_service_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_to_service_owner(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.sync_super_admin(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_super_admin(bigint, boolean) TO service_role;

-- Column level hardening for direct Supabase clients: the role column can only
-- be written by the API, which connects as the table owner.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;
