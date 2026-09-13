-- ============================================================
-- 042_distributor_multi_plant.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE. Pairs with the client change in the same commit.
--
-- BOSS SITUATION: the Partner Distributor being onboarded HOLDS FIVE PLANTS.
--
-- WHY THIS IS NOT COSMETIC. A PD's store visibility was never plant-limited —
-- `app_store_scope()` scopes a partner_distributor by `distributor_id`, so he
-- already sees stores on any plant. The damage is upstream, at intake:
--
--     /apply  ->  assignedPlantId: referralInfo.referral.plantId
--
-- Every applicant who uses his referral code inherits the ONE plant chosen when
-- his account was created. For a PD across five plants that default is wrong
-- about four times out of five, and `applications.assigned_plant_id` is NOT
-- NULL so it is never blank and never errors — the store is simply created on
-- the wrong plant, quietly skewing deliveries, forecasting scope and
-- plant-manager visibility. Someone has to notice and fix it on EVERY
-- application, forever. This replaces that recurring tax with one encode.
--
-- ── DELIBERATELY ADDITIVE ─────────────────────────────────────────────────
-- `plant_ids` is added ALONGSIDE `plant_id`, which stays NOT NULL and keeps
-- holding the primary/home plant. Three tables require a plant and none of them
-- are touched:
--     distributors.plant_id           NOT NULL
--     referral_codes.plant_id         NOT NULL
--     applications.assigned_plant_id  NOT NULL
-- Relaxing those would mean three migrations plus null-handling in every reader
-- for no benefit. So the primary plant keeps satisfying the constraints and
-- keeps being the sensible default; `plant_ids` records the FULL set the PD
-- actually serves, which is what the approval screen needs in order to offer a
-- correct choice instead of a silent guess.
--
-- NULL / empty `plant_ids` means "only the primary plant" — NOT "all plants".
-- This is the OPPOSITE of the 031/041 convention for billing and forecaster,
-- on purpose: those are HQ roles where company-wide is the safe default, while
-- a distributor is scoped to what it actually serves and must never widen by
-- accident. Every existing distributor therefore keeps behaving exactly as it
-- does today with no backfill.
--
-- No RLS change: partner_distributor scope is by distributor_id and is
-- unaffected.
--
-- Idempotent.
-- ============================================================

ALTER TABLE distributors ADD COLUMN IF NOT EXISTS plant_ids TEXT[];

COMMENT ON COLUMN distributors.plant_ids IS
  'Every plant this distributor serves. NULL/empty = only plant_id (the primary). plant_id remains NOT NULL and is the default for applications arriving through this distributor''s referral code.';

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ────────────────────────────────────────────────────────
-- ALTER TABLE distributors DROP COLUMN IF EXISTS plant_ids;
