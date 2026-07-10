-- ============================================================
-- 009_store_shop_code.sql
-- ============================================================
-- Mister Donut "shop code" per store. Unlike the earlier (reverted) attempt
-- that captured it on the public /apply form, the shop code is now assigned
-- AFTER approval via the admin "New Franchisee" onboarding form — MD supplies
-- the code once the franchisee is approved.
--
-- Additive + nullable so existing store rows stay valid. The column inherits
-- the stores table's existing RLS (owner/ops write via updateStore); no policy
-- change needed. Idempotent.
--
-- ROLLOUT: run this before deploying the client change that writes shop_code
-- (the store UPDATE now includes shop_code; the column must exist first).

alter table public.stores
  add column if not exists shop_code text;

-- REVERT (dev only):
--   alter table public.stores drop column if exists shop_code;
