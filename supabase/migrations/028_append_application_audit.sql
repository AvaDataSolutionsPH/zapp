-- ============================================================
-- 028_append_application_audit.sql
-- ============================================================
-- Login Credentials & First-Time Account Activation — Phase G (fix).
--
-- THE BUG THIS FIXES (found by 025's append-only trigger, in E2E).
-- Every audit write so far was a read-modify-write of the WHOLE array: read
-- applications.audit_log into the client's slice, push an entry, send the whole
-- row back. That silently DELETES entries whenever the client's copy is stale,
-- because the shorter array simply overwrites the longer one.
--
-- And the client's copy goes stale routinely: App.tsx re-runs restoreSession()
-- — and therefore hydrateFromDB() — on every SIGNED_IN and TOKEN_REFRESHED, so
-- a hydration started BEFORE an append can land AFTER it and roll the slice
-- back. Observed live: recordLogin appended `first_login` and saved it, a
-- racing hydration then clobbered the slice, and the next append tried to write
-- an array with `first_login` missing. 025's trigger refused it — which is
-- exactly what "Transaction History cannot be modified or deleted" means, and
-- why the check is there.
--
-- The fix is to stop sending the array at all. `audit_log || entry` executes in
-- ONE statement against the CURRENT row, so it cannot drop an entry no matter
-- how stale the caller is, and it satisfies the append-only trigger by
-- construction rather than by luck.
--
-- SECURITY INVOKER (the default) is load-bearing: the function runs as the
-- CALLER, so RLS still decides whose application may be touched (a franchisee
-- only their own via 025's apps_update_own_account; staff via their scoped
-- policies), and 025's triggers still fire. This adds an operation, not a
-- privilege.
--
-- ⬜ FOLLOW-UP (not done here, deliberately): reviewDocument and
-- submitAccountVerification still write the whole row. Staff are exempt from
-- the append-only trigger, so a stale staff slice could still drop entries
-- silently — the same bug, without the seatbelt. Both are verified working, so
-- they are left alone tonight rather than rewritten unasked; move them onto
-- this RPC next.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.append_application_audit(p_app_id TEXT, p_entry JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE applications
     SET audit_log = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(p_entry)
   WHERE id = p_app_id;
$$;

GRANT EXECUTE ON FUNCTION public.append_application_audit(TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.append_application_audit(TEXT, JSONB);
