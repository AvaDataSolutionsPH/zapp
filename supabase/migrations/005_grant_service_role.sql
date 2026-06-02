-- ============================================================
-- ZAPP Donuts ERP — Grant table privileges to service_role
-- ============================================================
--
-- WHY: The Supabase project was created with "Automatically expose new
-- tables" UNCHECKED, so tables created after the initial blanket grant
-- (e.g. `special_orders`) never received table-level GRANTs for the
-- built-in roles. The service_role key BYPASSES RLS but still needs
-- table GRANTs — so `npm run db:seed` failed with:
--     42501  permission denied for table special_orders
-- when trying to DELETE/INSERT during a reseed.
--
-- FIX: grant full table + sequence privileges on the public schema to
-- service_role (and keep anon/authenticated working for the app — those
-- are still gated by RLS policies from 002/003). Also set DEFAULT
-- PRIVILEGES so any FUTURE table created by the migration owner is
-- auto-granted, preventing this from recurring.
--
-- HOW TO RUN: Supabase SQL Editor -> paste -> Run. Safe + idempotent.

-- Current tables
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Future tables (so a newly added table doesn't hit 42501 again)
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
