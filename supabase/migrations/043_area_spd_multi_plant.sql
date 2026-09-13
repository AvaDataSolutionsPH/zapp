-- ============================================================
-- 043_area_spd_multi_plant.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE. Pairs with the client change in the same commit.
--
-- BOSS: "kahit ang area distributor pwedeng multiple plants din dapat."
--
-- Finishes what 042 started for the Partner Distributor. After this, every
-- CHANNEL role may serve several plants:
--     Partner Distributor      042
--     Area Supervisor          043  <- this
--     Sub-Partner Distributor  043  <- this
-- and every HQ role already could (billing 031, forecaster 041) except the one
-- the boss explicitly kept single: "plant manager per plant lang yan."
--
-- WHY IT MATTERS FOR AN AREA SUPERVISOR. Their queue is scoped by PROVINCE, not
-- by plant (029/035), so this is not about visibility. It is about the approval
-- fallback in `reviewApplication`:
--
--     state.areaSupervisors.find((as) => as.plantId === updatedApp.assignedPlantId)
--
-- When an application has no resolvable AS, the store is handed to the first
-- supervisor whose SINGLE plant matches. A supervisor covering five plants was
-- invisible to that lookup for four of them, so the store silently landed with
-- the wrong supervisor — `stores.area_supervisor_id` is NOT NULL, so it always
-- picks SOMEBODY and never errors.
--
-- ── SAME SHAPE AS 042, DELIBERATELY ───────────────────────────────────────
-- `plant_ids` is added ALONGSIDE `plant_id`, which stays NOT NULL and remains
-- the primary/home plant. Nothing that reads `plant_id` changes.
--
-- NULL / empty `plant_ids` means "only the primary plant" — NOT "all plants".
-- Same as 042 and the OPPOSITE of the billing/forecaster convention (031/041):
-- an HQ role defaults safely to company-wide, but a channel role is scoped to
-- what it actually serves and must never widen by accident. Every existing row
-- keeps behaving exactly as it does today, with no backfill.
--
-- No RLS change: area_manager is scoped by province / area ids
-- (`app_area_owns_application`, `app_store_scope`) and sub_partner_distributor
-- by `app_spd()`. Neither consults plant.
--
-- Idempotent.
-- ============================================================

ALTER TABLE area_supervisors        ADD COLUMN IF NOT EXISTS plant_ids TEXT[];
ALTER TABLE sub_partner_distributors ADD COLUMN IF NOT EXISTS plant_ids TEXT[];

COMMENT ON COLUMN area_supervisors.plant_ids IS
  'Every plant this supervisor covers. NULL/empty = only plant_id (the primary). plant_id stays NOT NULL and remains the primary/home plant.';
COMMENT ON COLUMN sub_partner_distributors.plant_ids IS
  'Every plant this sub-partner serves. NULL/empty = only plant_id (the primary). plant_id stays NOT NULL and remains the primary/home plant.';

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ────────────────────────────────────────────────────────
-- ALTER TABLE area_supervisors         DROP COLUMN IF EXISTS plant_ids;
-- ALTER TABLE sub_partner_distributors DROP COLUMN IF EXISTS plant_ids;
