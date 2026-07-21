-- ============================================================
-- 038 — A distributor-channel franchisee sees only its OWN store
-- ============================================================
--
-- SECURITY FIX. `app_store_scope()` scoped a `franchisee_distributor` by
--     distributor_id = app_distributor()
-- i.e. EVERY store under their Partner Distributor. A franchisee owns one store;
-- `distributor_id` on their profile only records which PD they remit to, not a
-- visibility grant. So a distributor-channel franchisee could READ — and, since
-- the write policies on special_orders / ending_inventories /
-- beginning_inventories / payments all gate on `store_id = ANY(app_store_scope())`,
-- could WRITE — records for OTHER stores in the same network.
--
-- The boss caught it on the Special Orders store dropdown: "ang dapat makikita
-- lang is yung sarili nilang store, di nila pwede ibang stores." It was not just
-- the dropdown — the server allowed it too.
--
-- `franchisee_direct` was already correct (app_store_ids() = own store). This
-- brings `franchisee_distributor` in line: the two roles differ only in login
-- channel, never in scope.
--
-- ✅ SAFE — this is a TIGHTENING, and every franchisee has their own store in
-- `users.assigned_store_ids` (approval sets `assignedStoreIds: [newStore.id]`
-- for both channels; verified across all 11 live franchisee rows, none empty).
-- So no one loses access they legitimately had — they lose access to stores that
-- were never theirs.
--
-- The Partner Distributor (partner_distributor) is UNCHANGED and still sees the
-- whole network.
--
-- Re-declares the whole function from migration 035 (its current definition)
-- with ONE line changed, so 035's area_manager fix is preserved. Safe to re-run.

CREATE OR REPLACE FUNCTION public.app_store_scope() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.app_role()
    WHEN 'owner'                  THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'operations_manager'     THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'plant_manager'          THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'forecaster'             THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'billing_user'           THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'partner_distributor'    THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
    -- ⬇️ THE FIX: own store, not the whole distributor network.
    WHEN 'franchisee_distributor' THEN public.app_store_ids()
    WHEN 'sub_partner_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE sub_partner_distributor_id = public.app_spd())
    WHEN 'franchisee_direct'      THEN public.app_store_ids()
    WHEN 'area_manager'           THEN ARRAY(
                                      SELECT id FROM public.stores
                                      WHERE id = ANY(public.app_store_ids())
                                         OR area_supervisor_id = public.app_area_supervisor_id()
                                         OR area_supervisor_id = ANY(public.app_area_ids()))
    ELSE '{}'::text[]
  END
$$;

NOTIFY pgrst, 'reload schema';

-- ── REVERT ───────────────────────────────────────────────────
-- Re-run the app_store_scope() block from migration 035. (Do not revert unless
-- you intend to let distributor-channel franchisees see their whole network
-- again.)
