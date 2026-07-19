-- ============================================================
-- 034 — Delivery Schedule gains "daily"
-- ============================================================
--
-- 010 introduced delivery_schedule with CHECK (… in ('odd','even')) — the
-- franchisee ships on odd- or even-numbered days. The boss added a third
-- cadence: some shops take a delivery EVERY day.
--
-- Both tables are widened together. `stores.delivery_schedule` is copied from
-- the application at approval, so leaving the store constraint behind would let
-- an application be saved as 'daily' and then fail at approval — the worst place
-- to discover it, since approval also mints the login and creates the store.
--
-- Widening a CHECK is additive: every existing 'odd'/'even'/NULL row stays
-- valid, and nothing needs backfilling.
--
-- ⚠️ Run BEFORE deploying the client that offers "Daily delivery", or the option
-- appears in the dropdown and every save fails with a 23514 check violation.

alter table public.applications
  drop constraint if exists applications_delivery_schedule_check;

alter table public.applications
  add constraint applications_delivery_schedule_check
  check (delivery_schedule is null or delivery_schedule in ('daily', 'odd', 'even'));

alter table public.stores
  drop constraint if exists stores_delivery_schedule_check;

alter table public.stores
  add constraint stores_delivery_schedule_check
  check (delivery_schedule is null or delivery_schedule in ('daily', 'odd', 'even'));

NOTIFY pgrst, 'reload schema';

-- ── REVERT ───────────────────────────────────────────────────
-- Only safe once no row uses 'daily' — otherwise the constraint will not
-- validate:
--   update public.applications set delivery_schedule = null where delivery_schedule = 'daily';
--   update public.stores       set delivery_schedule = null where delivery_schedule = 'daily';
--   …then re-run the two blocks from 010.
