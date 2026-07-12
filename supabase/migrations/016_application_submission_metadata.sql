-- ============================================================
-- 016_application_submission_metadata.sql
-- ============================================================
-- Partner Onboarding Phase 2: capture best-effort submission provenance for
-- self-service /onboarding applications (anti-fraud evidence for the reviewer)
-- plus a pointer to a system-generated PDF copy of the application.
--
-- All columns nullable/additive — legacy /apply and internal onboarding rows,
-- and any onboarding row filed before this migration, stay valid.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS submitted_ip TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE applications
--   DROP COLUMN IF EXISTS submitted_ip, DROP COLUMN IF EXISTS user_agent,
--   DROP COLUMN IF EXISTS device_info, DROP COLUMN IF EXISTS gps_lat,
--   DROP COLUMN IF EXISTS gps_lng, DROP COLUMN IF EXISTS pdf_url;
