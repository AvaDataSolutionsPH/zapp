-- ============================================================
-- 019_billing_revisions.sql
-- ============================================================
-- Phase B of the PD billing-review / revision subsystem.
--
-- A Partner Distributor reviews each DR (delivery) against the store's reported
-- Beginning / Ending donut counts (per-DR PD Billing table, Phase A). When a
-- report looks wrong, the PD files a BILLING REVISION with the CORRECT beginning
-- and ending counts for that DR. This is stored SEPARATELY from the ending-
-- inventory reviewer queue (ending_inventories.revisions) — it is a billing-
-- level correction, not the EI approve/needs-review/correction state machine.
--
-- Downstream (later phases, additive):
--   * Phase C — the positive delta (recomputed billing − original) becomes a
--     separate "additional" billing; the original row is left untouched (audit).
--   * Phase D — the franchisee views the corrected counts and can DISPUTE them
--     (status 'disputed'); resolution flips it to 'resolved'.
--
-- Corrected counts are stored as JSONB arrays of {skuId, skuName, quantity}
-- (inner camelCase kept verbatim, same convention as every other JSONB column).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → paste → Run. Run BEFORE deploying the
--   client change (an INSERT to a missing table fails loudly). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_revisions (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  corrected_beginning JSONB NOT NULL DEFAULT '[]'::jsonb,
  corrected_ending JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'disputed', 'resolved'
  ))
);

CREATE INDEX IF NOT EXISTS idx_brev_delivery ON billing_revisions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_brev_store ON billing_revisions(store_id);

-- New tables are NOT covered by 001's schema-wide grant (that only touched
-- tables existing then), so grant the app roles explicitly.
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_revisions TO anon, authenticated;

-- "Enable automatic RLS" is ON for this project, so a new table has RLS enabled
-- with NO policy → all queries return zero rows until one exists.
ALTER TABLE billing_revisions ENABLE ROW LEVEL SECURITY;

-- ── Policies (role-scoped, mirrors ending_inventories in 003) ──────────────
-- SELECT: owner/ops (admin) + billing_user read all; everyone else scoped to
-- their own stores (PD → its distributor's stores; franchisee → own store, so
-- the Phase D "Revision Requested" view works).
DROP POLICY IF EXISTS brev_select ON billing_revisions;
CREATE POLICY brev_select ON billing_revisions FOR SELECT TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR public.app_role() = 'billing_user'
    OR store_id = ANY(public.app_store_scope())
  );

-- INSERT: only a reviewer (owner/ops/area_manager/partner_distributor) may file
-- a revision, scoped to a store in their reach. This is a PD action in practice.
DROP POLICY IF EXISTS brev_insert ON billing_revisions;
CREATE POLICY brev_insert ON billing_revisions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.app_is_reviewer())
    AND store_id = ANY(public.app_store_scope())
  );

-- UPDATE: store-scoped, non-view-only. Lets the PD amend and (Phase D) the
-- franchisee dispute a revision on its own store.
DROP POLICY IF EXISTS brev_update ON billing_revisions;
CREATE POLICY brev_update ON billing_revisions FOR UPDATE TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  )
  WITH CHECK (
    (SELECT public.app_is_admin())
    OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  );

-- ── REVERT (dev only) ─────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS billing_revisions;
