-- ============================================================
-- 014_application_needs_more_info.sql
-- ============================================================
-- Phase 4 of Partner Onboarding: Admin Verification adds a "Request Additional
-- Information" action, which sets applications.status = 'needs_more_info'.
-- Widen the status CHECK to allow it (keeps pending/approved/declined).
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'needs_more_info'));

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
-- ALTER TABLE applications ADD CONSTRAINT applications_status_check
--   CHECK (status IN ('pending', 'approved', 'declined'));
