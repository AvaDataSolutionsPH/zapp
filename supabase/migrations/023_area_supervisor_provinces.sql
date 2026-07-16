-- ============================================================
-- 023_area_supervisor_provinces.sql
-- ============================================================
-- ZAPP New Application Monitoring — Phase 5 (automatic Area-Supervisor
-- assignment).
--
-- The module requires a master list of Area Supervisors and their assigned
-- provinces/regions: a new application resolves its province from the address
-- and is auto-assigned the AS covering it, and an AS only sees applications in
-- its own provinces.
--
-- Boss's instruction (verbatim): "Gawa nalang tayo ng admin settings na
-- maglalagay sa per areas sa isang area supv. Para kahit mapalitan madali lang
-- ichange." — so this is DATA, edited in-app by an admin, not a hardcoded map.
-- Owner/ops manage it on the Area Supervisors page.
--
-- ⚠️ NOT reusing the existing `assigned_areas`. That column holds free-text
-- CITY names (e.g. 'Legazpi City', 'Daraga'), is display-only, and is read in 7
-- places (mockData, AreaManagersPage, ReferralEntryPage, api.ts, dbWrite,
-- useStore, types). Redefining it as provinces would silently corrupt every one
-- of them. A separate column keeps both meanings intact.
--
-- Additive + defaulted, so every existing AS row stays valid with an empty list
-- (and an empty list simply means "no province coverage yet" — assignment falls
-- back to the referral code's AS, i.e. today's behaviour).
--
-- RLS: none needed. `area_supervisors` is a reference table — 003's `ref_select`
-- (all authenticated) + `ref_write` (app_is_admin) already cover this column.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE area_supervisors
  ADD COLUMN IF NOT EXISTS assigned_provinces TEXT[] NOT NULL DEFAULT '{}';

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE area_supervisors DROP COLUMN IF EXISTS assigned_provinces;
