-- ============================================================
-- 008_billing_user_read_all.sql
-- ============================================================
-- Billing is a company-wide back-office function: the billing user invoices
-- every distributor / store (e.g. the consolidated "Billing Summary" statement
-- aggregates a distributor's shops across the operation). But 003 scoped
-- billing_user to its PLANT via app_store_scope(), and the seeded billing user
-- has NO plant — so it read ZERO stores/deliveries/EIs and the Billing page +
-- statement showed nothing.
--
-- Fix: let billing_user READ all billing-relevant, store-scoped tables. This
-- mirrors the precedent already in 003 — forecaster reads all forecasts /
-- sales_metrics, and billing_user already reads all payments — by adding an
-- `OR app_role() = 'billing_user'` clause to the SELECT policies.
--
-- READ-ONLY widening: only SELECT policies change here; INSERT/UPDATE/DELETE
-- (write) scope is deliberately left as-is, so billing_user does not gain write
-- access to deliveries / inventories / orders.
--
-- Idempotent (DROP ... IF EXISTS before CREATE). Safe to re-run.

-- stores
DROP POLICY IF EXISTS stores_select ON public.stores;
CREATE POLICY stores_select ON public.stores FOR SELECT TO authenticated
  USING (id = ANY(public.app_store_scope()) OR public.app_role() = 'billing_user');

-- deliveries
DROP POLICY IF EXISTS deliveries_select ON public.deliveries;
CREATE POLICY deliveries_select ON public.deliveries FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()) OR public.app_role() = 'billing_user');

-- beginning_inventories
DROP POLICY IF EXISTS bi_select ON public.beginning_inventories;
CREATE POLICY bi_select ON public.beginning_inventories FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()) OR public.app_role() = 'billing_user');

-- ending_inventories
DROP POLICY IF EXISTS ei_select ON public.ending_inventories;
CREATE POLICY ei_select ON public.ending_inventories FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()) OR public.app_role() = 'billing_user');

-- packaging_orders
DROP POLICY IF EXISTS po_select ON public.packaging_orders;
CREATE POLICY po_select ON public.packaging_orders FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()) OR public.app_role() = 'billing_user');

-- special_orders (preserve the existing admin clause)
DROP POLICY IF EXISTS so_select ON public.special_orders;
CREATE POLICY so_select ON public.special_orders FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin())
         OR store_id = ANY(public.app_store_scope())
         OR public.app_role() = 'billing_user');

-- ── REVERT (dev only) ──────────────────────────────────────────
-- Re-create each SELECT policy WITHOUT the `OR app_role() = 'billing_user'`
-- clause (i.e. the original 003 definitions):
--   stores_select      USING (id = ANY(app_store_scope()))
--   deliveries_select  USING (store_id = ANY(app_store_scope()))
--   bi_select          USING (store_id = ANY(app_store_scope()))
--   ei_select          USING (store_id = ANY(app_store_scope()))
--   po_select          USING (store_id = ANY(app_store_scope()))
--   so_select          USING (app_is_admin() OR store_id = ANY(app_store_scope()))
