-- ============================================================
-- 026_document_verification.sql
-- ============================================================
-- Login Credentials & First-Time Account Activation — Phase D.
--
-- Staff review each submitted document (Store Picture, Gov ID, Proof of
-- Billing, Selfie). Each shows Not Uploaded / Uploaded / Verified / Rejected,
-- a rejection carries remarks, and once ALL are verified the account flips to
-- `active` and the franchisee finally gets into the ERP.
--
-- 1. document_reviews (JSONB)
--    One column rather than 8 (status+remarks x 4 docs). Matches how the rest of
--    this schema stores structured detail (audit_log, revisions, items) and
--    lets a document be added later with no migration.
--
--    Only VERIFIED / REJECTED are stored. "Not Uploaded" and "Uploaded" are
--    DERIVED from whether the document's URL is set — storing them would mean a
--    second write on every upload that could drift out of sync with the file.
--
--    The franchisee cannot touch this column: 025's fail-closed trigger allows
--    them only the verification-document fields, and this is not one of them.
--
-- 2. users_update_account_status
--    Activation writes users.account_status, but `users` is a reference table
--    whose ref_write (003) is ADMIN-ONLY. Without this, a PD or Area Supervisor
--    — the people actually on the ground — could verify the documents but never
--    activate the account; every franchisee would need HQ.
--
--    ⚠️ This grants a ROW, not a column. What makes it safe is 025's
--    users_guard_self_update trigger: it exempts only admins, so any other
--    caller is clamped to account_status / password_changed_at. A PD therefore
--    cannot use this policy to change a franchisee's role or scope — the policy
--    opens the row, the trigger keeps the blast radius to one column.
--
--    Scoped to franchisee rows only, and to the caller's own network.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS document_reviews JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS users_update_account_status ON users;
CREATE POLICY users_update_account_status ON users FOR UPDATE TO authenticated
  USING (
    role IN ('franchisee_distributor', 'franchisee_direct')
    AND (
      (public.app_role() = 'partner_distributor' AND distributor_id = public.app_distributor())
      OR (public.app_role() = 'sub_partner_distributor' AND sub_partner_distributor_id = public.app_spd())
      OR public.app_role() IN ('area_manager', 'operations_manager')
    )
  )
  WITH CHECK (
    role IN ('franchisee_distributor', 'franchisee_direct')
    AND (
      (public.app_role() = 'partner_distributor' AND distributor_id = public.app_distributor())
      OR (public.app_role() = 'sub_partner_distributor' AND sub_partner_distributor_id = public.app_spd())
      OR public.app_role() IN ('area_manager', 'operations_manager')
    )
  );

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS users_update_account_status ON users;
-- ALTER TABLE applications DROP COLUMN IF EXISTS document_reviews;
