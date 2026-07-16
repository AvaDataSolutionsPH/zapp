-- ============================================================
-- 027_login_audit_and_password_reset.sql
-- ============================================================
-- Login Credentials & First-Time Account Activation — Phases F + G.
--
-- 1. users.last_login_at
--    "Audit events (login, password change)". A login is an event on the USER,
--    not on an application, and it repeats forever. Appending every sign-in to
--    applications.audit_log would grow an unbounded JSONB column that is
--    rewritten WHOLE on every write — the row gets slower the more the
--    franchisee logs in, and staff accounts have no application to write to at
--    all. So the recurring fact ("when did they last sign in") is one column,
--    and only the ONE-TIME milestones (first login, password changed, password
--    reset by staff) land in the application's Transaction History, where the
--    activation trail already lives.
--
--    A full login HISTORY (every session, with IP) is deliberately out of scope
--    — that needs its own append-only table, not this column.
--
--    Nullable, no default: NULL = "has not signed in since this shipped".
--
-- 2. users_guard_self_update — extended
--    025's trigger clamps a non-admin to account_status / password_changed_at.
--    Every user must now stamp their OWN last_login_at at sign-in, so the clamp
--    would reject it. Adding it to the allowed set keeps the clamp fail-closed:
--    role, scope, email and name still cannot be self-updated, which is the
--    whole point of that trigger.
--
--    users_update_self (025) already grants the row TO authenticated for
--    `id = app_user_id()`, so staff can stamp their own login too.
--
-- 3. auth_user_id_by_email() — for the reset-password Edge Function
--    Resetting a password means `auth.admin.updateUserById(uuid, {password})`,
--    which needs the AUTH user's uuid. public.users.id is our own id
--    ('user-xxx'), and the two layers are linked by EMAIL only (see
--    findProfileByEmail in the store). The auth schema is not exposed over
--    PostgREST, so the Edge Function cannot read auth.users directly.
--
--    ⚠️ This function reads auth.users, so it is SECURITY DEFINER and EXECUTE
--    is REVOKED from anon/authenticated and granted ONLY to service_role. A
--    logged-in user must never be able to enumerate auth uuids by email.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

-- ── 1. Last login ─────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ── 2. Re-clamp: allow last_login_at alongside 025's two columns ──────────
CREATE OR REPLACE FUNCTION public.users_guard_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.app_is_admin() THEN
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

-- ── 3. auth.users lookup for the Edge Function (service_role only) ────────
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(TEXT) TO service_role;

-- PostgREST caches the schema; a new column is invisible to the API until this
-- runs (we hit PGRST204 on migration 024 for exactly this reason).
NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.auth_user_id_by_email(TEXT);
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
-- -- then re-run the users_guard_self_update block from 025 to restore the
-- -- two-column clamp.
