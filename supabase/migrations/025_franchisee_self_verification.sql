-- ============================================================
-- 025_franchisee_self_verification.sql
-- ============================================================
-- Login Credentials & First-Time Account Activation — Phase C.
--
-- On first login a franchisee must upload their Gov ID, Proof of Billing and
-- Selfie and accept the Data Privacy Policy. That means writing to rows they
-- currently cannot touch at all:
--
--   * apps_select_own (013) matches applications.email = JWT email. A shop-code
--     login's JWT email is <code>@shop.zappdonuts.ph, never the applicant's own
--     address, so it does NOT match — the franchisee cannot even SELECT their
--     own application.
--   * apps_update (003) lists admin / PD / AS only.
--   * users is a reference table: ref_write (003) is admin-only, so a franchisee
--     cannot set their own account_status.
--
-- ⚠️ THE TRAP THIS AVOIDS. Postgres RLS is ROW-level, not column-level. Simply
-- granting a franchisee UPDATE on their own rows would let them set their own
-- users.role to 'owner', or approve their own application / rewrite its Shop
-- Code. Column-level GRANTs can't fix it either: they are per-DB-role, and
-- admin/PD/AS legitimately update a dozen other application columns.
--
-- So: narrow RLS policies PLUS a trigger that clamps WHICH columns a franchisee
-- may move.
--
-- The triggers compare the whole row MINUS the allowed columns, rather than
-- enumerating what's protected. That is deliberately FAIL-CLOSED: any column
-- added by a future migration is protected automatically. Enumerating would
-- silently open a hole the day someone adds a column and forgets this file.
--
-- Staff are exempted by role — their own policies already scope them, and they
-- must keep updating the monitoring fields.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

-- ── Helper: the caller's own users.id ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

-- ── Franchisee may see + write ONLY the application that minted their login ──
DROP POLICY IF EXISTS apps_select_own_account ON applications;
CREATE POLICY apps_select_own_account ON applications FOR SELECT TO authenticated
  USING (account_user_id IS NOT NULL AND account_user_id = public.app_user_id());

DROP POLICY IF EXISTS apps_update_own_account ON applications;
CREATE POLICY apps_update_own_account ON applications FOR UPDATE TO authenticated
  USING (account_user_id IS NOT NULL AND account_user_id = public.app_user_id())
  WITH CHECK (account_user_id IS NOT NULL AND account_user_id = public.app_user_id());

-- ── Franchisee may write ONLY their own users row ─────────────────────────
DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self ON users FOR UPDATE TO authenticated
  USING (id = public.app_user_id())
  WITH CHECK (id = public.app_user_id());

-- ── Column clamps ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.applications_guard_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff reach applications through their own scoped policies and must keep
  -- editing the evaluation fields, so the clamp targets franchisees only.
  -- Anyone else (incl. a caller with no resolvable role) is already filtered by
  -- RLS — no policy grants them UPDATE at all — so passing them through here is
  -- not a hole; the trigger is the SECOND line, not the first.
  IF public.app_role() IS DISTINCT FROM 'franchisee_distributor'
     AND public.app_role() IS DISTINCT FROM 'franchisee_direct' THEN
    RETURN NEW;
  END IF;

  -- Everything except the verification fields must be byte-identical.
  IF (to_jsonb(NEW) - 'gov_id_url' - 'proof_of_billing_url' - 'selfie_url'
                    - 'accepted_privacy_at' - 'audit_log')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'gov_id_url' - 'proof_of_billing_url' - 'selfie_url'
                    - 'accepted_privacy_at' - 'audit_log') THEN
    RAISE EXCEPTION 'A franchisee may only submit verification documents on their own application.';
  END IF;

  -- The Transaction History "cannot be modified or deleted by any user", so the
  -- franchisee may APPEND to it but never drop an entry. (@> = every old element
  -- is still present.)
  IF NOT (NEW.audit_log @> OLD.audit_log) THEN
    RAISE EXCEPTION 'Transaction History is append-only.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_guard_self_update ON applications;
CREATE TRIGGER applications_guard_self_update
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_guard_self_update();

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
  IF (to_jsonb(NEW) - 'account_status' - 'password_changed_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'account_status' - 'password_changed_at') THEN
    RAISE EXCEPTION 'Only account_status and password_changed_at may be self-updated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_self_update ON users;
CREATE TRIGGER users_guard_self_update
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_self_update();

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS applications_guard_self_update ON applications;
-- DROP TRIGGER IF EXISTS users_guard_self_update ON users;
-- DROP FUNCTION IF EXISTS public.applications_guard_self_update();
-- DROP FUNCTION IF EXISTS public.users_guard_self_update();
-- DROP POLICY IF EXISTS apps_select_own_account ON applications;
-- DROP POLICY IF EXISTS apps_update_own_account ON applications;
-- DROP POLICY IF EXISTS users_update_self ON users;
-- DROP FUNCTION IF EXISTS public.app_user_id();
