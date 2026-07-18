-- ============================================================
-- 031_user_plant_ids.sql
-- ============================================================
-- Boss: "Operations manager lahat ng plant hawak nya. Si billing ay per plant.
-- Pero dapat multiple plants ang option at may mga billing na multiple plants
-- ang hawak."
--
-- So a Billing User is scoped to plants — but can hold MORE THAN ONE. The
-- existing users.plant_id is singular, so a second column carries the list.
--
--   plant_ids TEXT[]  — the plants this user covers.
--
-- Why a NEW column instead of redefining plant_id: plant_id is read in many
-- places (forecasting, packaging, plant_manager scope, seeds) and means "the
-- one plant this user belongs to". Widening it in place would change every one
-- of those reads. This is additive — nothing existing moves.
--
-- ⚠️ EMPTY / NULL MEANS "ALL PLANTS", NOT "NONE".
-- The seeded billing user (ivan@) has no plant at all, and migration 008
-- deliberately let billing_user read company-wide because of that. If empty
-- meant "no plants", this migration would silently blank Ivan's entire screen —
-- exactly the failure that hit the Area Supervisor (029). So the client treats
-- an empty list as unscoped, and only filters once plants are actually
-- assigned. Same fail-safe shape as users.account_status (024).
--
-- Operations Manager needs nothing here — it covers every plant by definition,
-- so the account form does not ask, and the list stays empty.
--
-- RLS: `users` is a reference table (003 ref_select/ref_write), so the new
-- column inherits the existing policies. Billing's row-level reads stay
-- company-wide for now; narrowing those is a separate, riskier change (it would
-- change what a live billing user can query) and is deliberately NOT bundled
-- here — the client scoping lands first.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_ids TEXT[];

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE users DROP COLUMN IF EXISTS plant_ids;
