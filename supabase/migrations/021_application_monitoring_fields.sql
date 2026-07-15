-- ============================================================
-- 021_application_monitoring_fields.sql
-- ============================================================
-- ZAPP New Application Monitoring — Phase 2 (schema).
--
-- Adds the monitoring fields the module tracks from submission until the
-- application is approved/disapproved. Two groups:
--
--   A. AUTO-FILLED from the application form
--      province        — /apply already COLLECTS this in the PSGC cascade but
--                        only ever flattened it into `address`. It is broken out
--                        because the Area (Province) filter and the automatic
--                        Area-Supervisor assignment both key off it.
--      location        — coarse region grouping derived from province
--                        (Bicol Region, Quezon Province, Metro Manila, ...).
--                        Derivation lands in Phase 5; column added now.
--      operating_days  — companion to the existing operating_hours (013).
--
--   B. FILLED BY STAFF during evaluation (per the module's RBAC table)
--      PD/SD      : google_maps_picture_url, google_maps_link, market_source,
--                   remarks_pd_sd
--      AS/OS      : comparable, ads, rtc, remarks_as, remarks_os
--      (shop_code, plant, lat/lng, status already exist.)
--
-- Every column is nullable/additive — legacy rows, the public /apply flow and
-- the /onboarding wizard all stay valid without backfill. No CHECK constraints
-- on the option-style columns on purpose: the client owns the vocabulary
-- (MarketSource / YesNo / RtcStatus in src/types/index.ts) and a DB-level CHECK
-- would need a migration every time the boss adds an option.
--
-- RLS: no policy changes needed. Existing applications policies are row-level
-- (apps_select / apps_insert / apps_update), so new columns inherit them.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

-- A. auto-filled from the form
ALTER TABLE applications ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS operating_days TEXT;

-- B. filled by PD/SD during evaluation
ALTER TABLE applications ADD COLUMN IF NOT EXISTS google_maps_picture_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS market_source TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS remarks_pd_sd TEXT;

-- B. filled by AS/OS during evaluation
ALTER TABLE applications ADD COLUMN IF NOT EXISTS comparable TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ads TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rtc TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS remarks_as TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS remarks_os TEXT;

-- Area (Province) is a primary, always-visible filter on the monitoring list.
CREATE INDEX IF NOT EXISTS applications_province_idx ON applications (province);

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS applications_province_idx;
-- ALTER TABLE applications
--   DROP COLUMN IF EXISTS province,
--   DROP COLUMN IF EXISTS location,
--   DROP COLUMN IF EXISTS operating_days,
--   DROP COLUMN IF EXISTS google_maps_picture_url,
--   DROP COLUMN IF EXISTS google_maps_link,
--   DROP COLUMN IF EXISTS market_source,
--   DROP COLUMN IF EXISTS remarks_pd_sd,
--   DROP COLUMN IF EXISTS comparable,
--   DROP COLUMN IF EXISTS ads,
--   DROP COLUMN IF EXISTS rtc,
--   DROP COLUMN IF EXISTS remarks_as,
--   DROP COLUMN IF EXISTS remarks_os;
