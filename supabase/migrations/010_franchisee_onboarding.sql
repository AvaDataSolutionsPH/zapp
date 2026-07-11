-- ============================================================
-- 010_franchisee_onboarding.sql
-- ============================================================
-- Backs the internal "New Franchisee" onboarding application form. Adds the
-- fields boss requested (basic details already exist; these are the new ones):
--   * shop code (from the PD), delivery schedule (odd/even days), opening date,
--     terms & conditions acceptance timestamp — on the APPLICATION;
--   * the same delivery schedule + opening date carried onto the STORE when the
--     application is approved.
-- Also introduces the SUB-PARTNER (SPD) referral channel so the system can tell
-- whether an application belongs to a PD, an SPD, or is direct-to-company:
--   * sub_partner_distributors.referral_code (the SPD's own channel code);
--   * referral_codes.sub_partner_distributor_id (which SPD a code routes to);
--   * widen the referral_type / type CHECK constraints to allow
--     'sub_partner_distributor'.
--
-- All columns are additive + nullable so existing rows (public /apply, seeded
-- stores) stay valid. Idempotent. Columns inherit each table's existing RLS —
-- applications INSERT is already allowed for reviewers, which includes
-- partner_distributor (app_is_reviewer), so the PD can encode a franchisee.
--
-- ROLLOUT: run this BEFORE deploying the client change that writes these fields.

-- ── Application onboarding fields ────────────────────────────
alter table public.applications
  add column if not exists assigned_sub_partner_distributor_id text,
  add column if not exists shop_code text,
  add column if not exists delivery_schedule text,
  add column if not exists opening_date date,
  add column if not exists terms_accepted_at timestamptz;

alter table public.applications
  drop constraint if exists applications_delivery_schedule_check;
alter table public.applications
  add constraint applications_delivery_schedule_check
  check (delivery_schedule is null or delivery_schedule in ('odd', 'even'));

-- ── Store onboarding fields (carried over on approval) ───────
alter table public.stores
  add column if not exists delivery_schedule text,
  add column if not exists opening_date date;

alter table public.stores
  drop constraint if exists stores_delivery_schedule_check;
alter table public.stores
  add constraint stores_delivery_schedule_check
  check (delivery_schedule is null or delivery_schedule in ('odd', 'even'));

-- ── Sub-Partner (SPD) referral channel ──────────────────────
alter table public.sub_partner_distributors
  add column if not exists referral_code text;

alter table public.referral_codes
  add column if not exists sub_partner_distributor_id text
  references public.sub_partner_distributors(id);

-- Widen the channel CHECK constraints to include the SPD channel. 001 created
-- these inline (auto-named <table>_<column>_check); drop + re-add to extend.
alter table public.applications
  drop constraint if exists applications_referral_type_check;
alter table public.applications
  add constraint applications_referral_type_check
  check (referral_type in ('distributor', 'zapp_internal', 'sub_partner_distributor'));

alter table public.referral_codes
  drop constraint if exists referral_codes_type_check;
alter table public.referral_codes
  add constraint referral_codes_type_check
  check (type in ('distributor', 'zapp_internal', 'sub_partner_distributor'));

-- REVERT (dev only):
--   alter table public.applications
--     drop column if exists assigned_sub_partner_distributor_id,
--     drop column if exists shop_code,
--     drop column if exists delivery_schedule,
--     drop column if exists opening_date,
--     drop column if exists terms_accepted_at;
--   alter table public.stores
--     drop column if exists delivery_schedule,
--     drop column if exists opening_date;
--   alter table public.sub_partner_distributors drop column if exists referral_code;
--   alter table public.referral_codes drop column if exists sub_partner_distributor_id;
--   -- (restore the original 2-value CHECK constraints if needed)
