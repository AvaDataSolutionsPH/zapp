-- ============================================================
-- 041_forecaster_multi_plant.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE, and it pairs with a client change in the same
-- commit (`forecasterPlantScope` in src/store/useStore.ts). RLS runs FIRST, so
-- if Postgres still scopes a forecaster to one plant the extra rows never reach
-- the client no matter what the client asks for — the exact failure 029 fixed.
--
-- BOSS REQUIREMENT (verbatim):
--   "Forecaster is multiple plants. Same sa billing multiple plants din hawak
--    nila. Plant manager per plant lang yan."
--
-- TODAY: `app_store_scope()` scopes BOTH plant_manager and forecaster by
-- `app_plant()` — the single `users.plant_id` column. A forecaster covering
-- five plants would need five separate logins.
--
-- THE COLUMN ALREADY EXISTS: migration 031 added `users.plant_ids TEXT[]` for
-- exactly this, but only the Billing User ever read it.
--
-- ── THE RULE, and why it is shaped this way ────────────────────────────────
--   plant_ids non-empty  -> exactly those plants
--   plant_ids empty BUT plant_id set -> that ONE plant
--   both empty           -> ALL plants
--
-- The middle case is the load-bearing one. 031 established "empty means ALL
-- PLANTS, not none" (treating empty as no-access blanked the billing user's
-- screen — the 029 failure mode). But applying that literally here would take a
-- forecaster created BEFORE this migration, who has plant_id set and plant_ids
-- empty, and silently WIDEN them from one plant to the whole company. Falling
-- back to plant_id first keeps every existing account seeing exactly what it
-- saw yesterday, and only accounts that explicitly opt into multi-plant get it.
--
-- plant_manager is deliberately UNCHANGED — "per plant lang yan".
-- billing_user is deliberately UNCHANGED too: 008 already widened it to read
-- company-wide through separate OR clauses, and rewriting its branch here would
-- change behaviour nobody asked to change.
--
-- Idempotent: CREATE OR REPLACE only, no policy is recreated. The signature of
-- app_store_scope() is unchanged, so every policy built on it keeps working.
-- ============================================================

-- ── Which plants does the caller cover? NULL means "all plants". ───────────
CREATE OR REPLACE FUNCTION public.app_plant_scope() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
           WHEN COALESCE(array_length(u.plant_ids, 1), 0) > 0 THEN u.plant_ids
           WHEN u.plant_id IS NOT NULL                        THEN ARRAY[u.plant_id]
           ELSE NULL
         END
  FROM public.users u
  WHERE u.email = (auth.jwt() ->> 'email')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.app_plant_scope() TO authenticated;

-- ── Store scope: copied verbatim from 038, forecaster branch only changed ──
CREATE OR REPLACE FUNCTION public.app_store_scope() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.app_role()
    WHEN 'owner'                  THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'operations_manager'     THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'plant_manager'          THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    -- ⬇️ THE CHANGE: a forecaster may hold SEVERAL plants (NULL scope = all).
    WHEN 'forecaster'             THEN ARRAY(
                                      SELECT id FROM public.stores
                                      WHERE public.app_plant_scope() IS NULL
                                         OR plant_id = ANY(public.app_plant_scope()))
    WHEN 'billing_user'           THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'partner_distributor'    THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
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

-- ── REVERT (manual) — restore 038's single-plant forecaster branch ─────────
-- CREATE OR REPLACE FUNCTION public.app_store_scope() RETURNS text[]
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT CASE public.app_role()
--     WHEN 'owner'                  THEN ARRAY(SELECT id FROM public.stores)
--     WHEN 'operations_manager'     THEN ARRAY(SELECT id FROM public.stores)
--     WHEN 'plant_manager'          THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
--     WHEN 'forecaster'             THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
--     WHEN 'billing_user'           THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
--     WHEN 'partner_distributor'    THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
--     WHEN 'franchisee_distributor' THEN public.app_store_ids()
--     WHEN 'sub_partner_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE sub_partner_distributor_id = public.app_spd())
--     WHEN 'franchisee_direct'      THEN public.app_store_ids()
--     WHEN 'area_manager'           THEN ARRAY(
--                                       SELECT id FROM public.stores
--                                       WHERE id = ANY(public.app_store_ids())
--                                          OR area_supervisor_id = public.app_area_supervisor_id()
--                                          OR area_supervisor_id = ANY(public.app_area_ids()))
--     ELSE '{}'::text[]
--   END
-- $$;
-- DROP FUNCTION IF EXISTS public.app_plant_scope();
