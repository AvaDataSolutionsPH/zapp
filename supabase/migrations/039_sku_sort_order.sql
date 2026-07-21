-- ============================================================
-- 039 — Donut catalog display order
-- ============================================================
--
-- Boss wants the donut catalog (and the donut lists that read from it) arranged
-- in the same order the products appear on the Delivery Receipt, so encoding a
-- DR reads top-to-bottom without hunting.
--
-- Adds `sort_order` and backfills it from the current arbitrary order so nothing
-- jumps on deploy. New rows default to a high value (9999) so they land at the
-- bottom until explicitly placed.
--
-- Nullable with a default: existing readers that ignore the column keep working,
-- and a row that somehow has NULL still sorts last (ORDER BY … NULLS LAST).
--
-- Safe to re-run.

alter table public.skus
  add column if not exists sort_order integer;

alter table public.skus
  alter column sort_order set default 9999;

-- Backfill in the current row order. `ctid` is just a stable arbitrary handle
-- so the first pass is deterministic; the boss then reorders from the UI.
with ordered as (
  select id, row_number() over (order by category, name) * 10 as rn
    from public.skus
)
update public.skus s
   set sort_order = o.rn
  from ordered o
 where s.id = o.id
   and s.sort_order is null;

NOTIFY pgrst, 'reload schema';

-- ── REVERT ───────────────────────────────────────────────────
-- alter table public.skus drop column if exists sort_order;
