-- ============================================================
-- 017_application_id_ocr.sql
-- ============================================================
-- Partner Onboarding Phase 3: best-effort ID OCR autofill on the /onboarding
-- Documents step. The scanned (and applicant-editable) name + ID number from
-- the uploaded government ID are stored so the reviewer can cross-check them
-- against the actual ID image at verification.
--
-- Both columns nullable/additive — legacy rows and rows filed before this
-- migration stay valid.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS id_scanned_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS id_number TEXT;

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE applications
--   DROP COLUMN IF EXISTS id_scanned_name, DROP COLUMN IF EXISTS id_number;
