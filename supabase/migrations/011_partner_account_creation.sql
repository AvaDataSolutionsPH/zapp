-- ============================================================
-- 011_partner_account_creation.sql
-- ============================================================
-- Lets a Partner Distributor (PD) create accounts for its own downline —
-- Sub-Partner Distributors (SPD) and Area Supervisors (AS) — in preparation for
-- the Bicol-PD-first rollout (before ZAPP absorbs everything centrally).
--
-- owner/ops already have full write on these reference tables via the existing
-- `ref_write` admin policy (003), so they need NO new policy. This migration
-- ADDS scoped INSERT policies for the PD. Postgres RLS is permissive — for the
-- INSERT command a row passes if ref_write (admin) OR one of these PD policies
-- allows it, so admin behavior is unchanged.
--
-- The PD is confined to its OWN scope:
--   * SPD:   parent_distributor_id  = app_distributor()
--   * AS:    plant_id               = app_plant()
--   * code:  distributor_id         = app_distributor()
--   * users: only sub_partner_distributor / area_manager profiles inside scope
--
-- NOTE (client rollout): the account-creation flow ALSO does a client-side
-- `auth.signUp` for the login. For the temp password to work WITHOUT an email
-- round-trip, turn OFF Supabase → Authentication → Providers → Email →
-- "Confirm email". (An unconfirmed account cannot sign in otherwise.)

-- ── SPD entity — PD adds a sub-partner under itself ─────────
drop policy if exists spd_pd_insert on public.sub_partner_distributors;
create policy spd_pd_insert on public.sub_partner_distributors
  for insert to authenticated
  with check (
    public.app_role() = 'partner_distributor'
    and parent_distributor_id = public.app_distributor()
  );

-- ── Area supervisor entity — PD adds an AS in its own plant ─
drop policy if exists as_pd_insert on public.area_supervisors;
create policy as_pd_insert on public.area_supervisors
  for insert to authenticated
  with check (
    public.app_role() = 'partner_distributor'
    and plant_id = public.app_plant()
  );

-- ── Referral code — PD creates a code for its own distributor ─
drop policy if exists ref_pd_insert on public.referral_codes;
create policy ref_pd_insert on public.referral_codes
  for insert to authenticated
  with check (
    public.app_role() = 'partner_distributor'
    and distributor_id = public.app_distributor()
  );

-- ── users profile — PD creates SPD / area_manager profiles in scope ─
-- The SPD-entity row must be inserted BEFORE this users row so the subquery
-- can see it (client insert order: entity → referral → users).
drop policy if exists users_pd_insert on public.users;
create policy users_pd_insert on public.users
  for insert to authenticated
  with check (
    public.app_role() = 'partner_distributor'
    and (
      (role = 'sub_partner_distributor'
        and sub_partner_distributor_id in (
          select id from public.sub_partner_distributors
          where parent_distributor_id = public.app_distributor()))
      or (role = 'area_manager' and plant_id = public.app_plant())
    )
  );

-- REVERT (dev only):
--   drop policy if exists spd_pd_insert  on public.sub_partner_distributors;
--   drop policy if exists as_pd_insert   on public.area_supervisors;
--   drop policy if exists ref_pd_insert  on public.referral_codes;
--   drop policy if exists users_pd_insert on public.users;
