-- ============================================================
-- 012_payment_collection_flow.sql
-- ============================================================
-- PD/SPD-mediated payment flow: franchisee → PD/SPD (collect) → billing (verify).
--
-- 1. Widen the payments.status CHECK to allow the new intermediate
--    'collected' state (set when a PD/SPD collects a store's remittance
--    and forwards it to billing).
-- 2. Add collected_by / collected_at columns (who collected + when).
-- 3. Let sub_partner_distributors UPDATE payments within their store scope.
--    SPD is view-only for everything else (app_is_viewonly() = true), so the
--    existing payments_update policy blocks them — this adds a scoped
--    exception JUST for the collection action. Postgres ORs policies, so PD /
--    billing / admin behaviour is unchanged.
--
-- Idempotent: safe to re-run. Run BEFORE deploying the client change so the
-- 'collected' status writes don't violate the old CHECK constraint.
-- ============================================================

-- 1. Widen the status CHECK constraint ------------------------------------
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('submitted', 'collected', 'verified', 'rejected'));

-- 2. Collection metadata columns ------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS collected_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

-- 3. SPD collection UPDATE policy (only meaningful once 003 role-scoped RLS
--    is live; harmless under the permissive 002 dev policies). --------------
DROP POLICY IF EXISTS payments_spd_update ON payments;
CREATE POLICY payments_spd_update ON payments FOR UPDATE TO authenticated
  USING (public.app_role() = 'sub_partner_distributor'
         AND store_id = ANY(public.app_store_scope()))
  WITH CHECK (public.app_role() = 'sub_partner_distributor'
         AND store_id = ANY(public.app_store_scope()));

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS payments_spd_update ON payments;
-- ALTER TABLE payments DROP COLUMN IF EXISTS collected_at;
-- ALTER TABLE payments DROP COLUMN IF EXISTS collected_by;
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- ALTER TABLE payments ADD CONSTRAINT payments_status_check
--   CHECK (status IN ('submitted', 'verified', 'rejected'));
