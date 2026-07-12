-- ============================================================
-- 013_partner_self_onboarding.sql
-- ============================================================
-- Phase 1 of the self-service Partner Onboarding workflow (/onboarding).
-- See docs/superpowers/specs/2026-07-12-partner-onboarding-workflow-design.md.
--
-- 1. Add the new self-onboarding columns to `applications` (all nullable, so
--    the legacy /apply and internal onboarding rows stay valid).
-- 2. `apps_select_own` — let a signed-in applicant read THEIR OWN application
--    (matched by JWT email) even though they have no `public.users` profile yet.
--    This drives the "Awaiting verification" screen: an onboarding applicant
--    has an auth login (created at Step 1) but no profile until Admin activates
--    them (Phase 4), so without this policy their own application is invisible
--    and login would dead-end.
--
-- Idempotent: safe to re-run. Run BEFORE deploying the client change.
-- ============================================================

-- 1. New application columns --------------------------------------------------
ALTER TABLE applications ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS facebook_link TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS operating_hours TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS accepted_consignment_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS agreement_version TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_number TEXT;

-- 2. Applicant can read their own application (by JWT email) ------------------
DROP POLICY IF EXISTS apps_select_own ON applications;
CREATE POLICY apps_select_own ON applications FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS apps_select_own ON applications;
-- ALTER TABLE applications
--   DROP COLUMN IF EXISTS first_name, DROP COLUMN IF EXISTS middle_name,
--   DROP COLUMN IF EXISTS last_name, DROP COLUMN IF EXISTS suffix,
--   DROP COLUMN IF EXISTS residential_address, DROP COLUMN IF EXISTS facebook_link,
--   DROP COLUMN IF EXISTS operating_hours, DROP COLUMN IF EXISTS selfie_url,
--   DROP COLUMN IF EXISTS accepted_consignment_at, DROP COLUMN IF EXISTS accepted_privacy_at,
--   DROP COLUMN IF EXISTS accepted_terms_at, DROP COLUMN IF EXISTS certified_at,
--   DROP COLUMN IF EXISTS agreement_version, DROP COLUMN IF EXISTS application_number;
