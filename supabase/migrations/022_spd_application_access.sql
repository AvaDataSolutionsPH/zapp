-- ============================================================
-- 022_spd_application_access.sql
-- ============================================================
-- ZAPP New Application Monitoring — Phase 3.
--
-- The module's RBAC table gives "PD/SD" edit rights over the evaluation fields
-- (Store Google Maps Picture, Google Maps Link, Longitude/Latitude, Market
-- Source, Plant, PD/SD Remarks), and its filter spec gives a Sub Partner
-- Distributor visibility of "Own Referral Code only".
--
-- Today neither is possible: apps_select / apps_update (003) list only
-- app_is_admin(), partner_distributor and area_manager — a sub_partner_distributor
-- cannot even SELECT an application, let alone update one.
--
-- This adds SPD access, scoped to applications filed under the SPD's OWN
-- referral (assigned_sub_partner_distributor_id = app_spd(), reusing the helper
-- already defined in 003).
--
-- ADDITIVE — new named policies rather than editing 003's. Postgres ORs
-- permissive policies together, so admin / PD / AS behaviour is untouched and
-- this migration can be reverted on its own.
--
-- NOTE ON SCOPE: this grants UPDATE on the row, not per-column rights. Which
-- fields an SPD may actually change is enforced client-side by
-- src/lib/applicationMonitoring.ts (the RBAC table). Column-level DB
-- enforcement would need either a trigger or column privileges — deliberately
-- out of scope, same as every other role here.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

DROP POLICY IF EXISTS apps_select_spd ON applications;
CREATE POLICY apps_select_spd ON applications FOR SELECT TO authenticated
  USING (
    public.app_role() = 'sub_partner_distributor'
    AND assigned_sub_partner_distributor_id = public.app_spd()
  );

DROP POLICY IF EXISTS apps_update_spd ON applications;
CREATE POLICY apps_update_spd ON applications FOR UPDATE TO authenticated
  USING (
    public.app_role() = 'sub_partner_distributor'
    AND assigned_sub_partner_distributor_id = public.app_spd()
  )
  WITH CHECK (
    public.app_role() = 'sub_partner_distributor'
    AND assigned_sub_partner_distributor_id = public.app_spd()
  );

-- The SPD filter ("Own Referral Code only") reads this column on every query.
CREATE INDEX IF NOT EXISTS applications_spd_idx
  ON applications (assigned_sub_partner_distributor_id);

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS apps_select_spd ON applications;
-- DROP POLICY IF EXISTS apps_update_spd ON applications;
-- DROP INDEX IF EXISTS applications_spd_idx;
