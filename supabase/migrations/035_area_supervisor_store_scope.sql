-- ============================================================
-- 035 — Area Supervisor can actually see (and update) their stores
-- ============================================================
--
-- PROBLEM — the same fault 029 fixed for applications, still live for stores.
--
-- `app_store_scope()` scopes an area_manager with
--     area_supervisor_id = ANY(public.app_area_ids())
-- where `app_area_ids()` reads `users.area_ids`. But a supervisor's `area_ids`
-- holds AREA identifiers (`area-albay-centro`, …) while `stores.area_supervisor_id`
-- holds an `area_supervisors` row id (`am-01`). The two id spaces never
-- intersect, so the scope is EMPTY and an Area Supervisor sees ZERO stores.
--
-- 029 called this out as a suspicion ("check stores/deliveries share the
-- area_ids assumption"). Confirmed: they do.
--
-- It is not only a visibility bug. `stores_update` gates on the same scope, so
-- activating a franchisee silently failed to open their store: verifying the
-- last document flipped the account to `active` while the store stayed
-- `pending` forever. The UPDATE matched zero rows and reported no error, which
-- is exactly why it went unnoticed.
--
-- FIX
--
-- Scope the area_manager by `app_area_supervisor_id()` — the helper 029 already
-- added, which resolves the caller's `area_supervisors` row by id OR name. The
-- old `area_ids` term is KEPT alongside it: any deployment that does populate
-- area_ids correctly keeps working, so this is purely additive.
--
-- ⚠️ Inherits 029's caveat: the name match breaks if two supervisors share a
-- name. A real users→area_supervisors FK remains the proper fix.
--
-- Safe to re-run. No data change.

CREATE OR REPLACE FUNCTION public.app_store_scope() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.app_role()
    WHEN 'owner'                  THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'operations_manager'     THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'plant_manager'          THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'forecaster'             THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'billing_user'           THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'partner_distributor'    THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
    WHEN 'franchisee_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
    WHEN 'sub_partner_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE sub_partner_distributor_id = public.app_spd())
    WHEN 'franchisee_direct'      THEN public.app_store_ids()
    WHEN 'area_manager'           THEN ARRAY(
                                      SELECT id FROM public.stores
                                      WHERE id = ANY(public.app_store_ids())
                                         -- The working link (029's helper).
                                         OR area_supervisor_id = public.app_area_supervisor_id()
                                         -- Legacy term, kept so a correctly
                                         -- populated area_ids still scopes.
                                         OR area_supervisor_id = ANY(public.app_area_ids()))
    ELSE '{}'::text[]
  END
$$;

NOTIFY pgrst, 'reload schema';

-- ── REVERT ───────────────────────────────────────────────────
-- Re-run the app_store_scope() block from 003.
