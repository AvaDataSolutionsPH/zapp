-- ============================================================
-- 007_shop_code.sql
-- ============================================================
-- Adds the Mister Donut "shop code" captured at franchisee
-- registration. MD assigns a unique shop code per store; we
-- store it on the application (captured on the public /apply
-- form) and carry it over to the store on approval.
--
-- Additive + nullable so pre-existing rows (seeded stores /
-- applications that predate the field) stay valid. No RLS or
-- grant changes needed — the columns inherit the table's
-- existing policies (anon INSERT on applications from 006 keeps
-- working; the new column is just part of the same insert).
--
-- ROLLOUT ORDER: run this migration BEFORE deploying the client
-- change, otherwise the /apply insert (which now includes
-- shop_code) fails with "column does not exist" for anon
-- applicants.

alter table public.applications
  add column if not exists shop_code text;

alter table public.stores
  add column if not exists shop_code text;

-- REVERT (dev only):
--   alter table public.applications drop column if exists shop_code;
--   alter table public.stores drop column if exists shop_code;
