-- ============================================================
-- 033 — service_role is an admin context for the users clamp
-- ============================================================
--
-- PROBLEM
--
-- 025 added `users_guard_self_update`, the trigger that stops a franchisee
-- promoting themselves to owner through their own self-update policy. It is
-- deliberately fail-closed: everything except account_status /
-- password_changed_at / last_login_at is rejected, so a future column is
-- protected automatically. Its only escape hatch is `public.app_is_admin()`.
--
-- `app_is_admin()` resolves the caller with
-- `public.users.email = auth.jwt() ->> 'email'`. A server-side script running
-- with the SERVICE ROLE KEY presents no email claim, so `app_role()` returns
-- NULL, `app_is_admin()` is false, and the clamp fires.
--
-- The effect is that NO maintenance script can touch `public.users` at all —
-- discovered while renaming the HQ staff demo logins from @zappdonuts.ph to
-- @zappdonuts.com, where every row failed with
-- "Only account_status, password_changed_at and last_login_at may be
-- self-updated." The trigger was not wrong about the rule, only about who was
-- asking.
--
-- FIX
--
-- Recognise service_role as an admin context, which is what it already is
-- everywhere else: it bypasses RLS entirely by design, and the key lives only
-- in .env.local (never the browser, never Vercel). If that key ever reaches a
-- client, the attacker already has unrestricted table access and does not need
-- this trigger — so the escape hatch adds no new surface.
--
-- The franchisee clamp is UNCHANGED: a browser session carries role 'anon' or
-- 'authenticated', never 'service_role', so every self-update still goes
-- through app_is_admin() exactly as before.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.users_guard_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin by profile (a signed-in owner / operations_manager), OR the trusted
  -- server context. `auth.role()` reads the JWT 'role' claim; it is
  -- 'service_role' only for a request made with the service key.
  IF public.app_is_admin()
     OR COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
  THEN
    RETURN NEW;
  END IF;

  -- Nobody but an admin may change role/scope/identity — this is what stops a
  -- franchisee promoting themselves to owner via their own self-update policy.
  IF (to_jsonb(NEW) - 'account_status' - 'password_changed_at' - 'last_login_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'account_status' - 'password_changed_at' - 'last_login_at') THEN
    RAISE EXCEPTION 'Only account_status, password_changed_at and last_login_at may be self-updated.';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
