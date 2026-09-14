-- ============================================================
-- 046 — Stop franchisees reading the whole staff directory
-- ============================================================
--
-- Found by the pre-go-live audit, by signing in as a real franchisee through
-- the ANON key and simply asking for the tables:
--
--     users            -> 10 rows   (every staff member: name, email, role,
--                                    plant, distributor)
--     referral_codes   ->  1 row    (their Partner Distributor's channel code)
--
-- Neither is reachable through the UI, but RLS is the only thing standing
-- between a franchisee login and the raw table — anyone who opens devtools on
-- their own dashboard can read both. That was acceptable while the only logins
-- were eleven demo accounts. It stops being acceptable the moment real
-- franchisees are encoded, which is what this system is about to be used for.
--
-- ── WHY `users` WAS WIDE OPEN ────────────────────────────────────────────
-- 003 created one blanket policy for every REFERENCE table:
--     CREATE POLICY ref_select ON <tbl> FOR SELECT TO authenticated USING (true)
-- 045 already carved `referral_codes` out of that. This does the same for
-- `users`, and fixes a hole in 045 itself.
--
-- ── WHY 045 STILL LEAKED ─────────────────────────────────────────────────
-- 045 grants a reader the codes where `distributor_id = app_distributor()`.
-- That was meant to mean "a Partner Distributor sees its own channel" — but
-- `app_distributor()` returns the CALLER'S `users.distributor_id`, and a
-- franchisee carries that column too (it is what links them to their PD). So
-- every franchisee silently matched their PD's row. The id was never the right
-- test; the ROLE is. Each branch below now checks both.
--
-- ⚠️ FAIL-CLOSED ON PURPOSE. Both policies use an explicit role allowlist
-- rather than "not a franchisee". `app_role()` returns NULL for an
-- authenticated caller with no `public.users` row — an /onboarding applicant
-- mid-wizard is exactly that — and a NOT-based test would hand those callers
-- the entire table. An allowlist gives them nothing.
--
-- ⚠️ BLAST RADIUS CHECKED BEFORE WRITING THIS. The client reads the `users`
-- slice in seven places: Settings (owner-only), the Distributor and Area
-- Supervisor edit modals (owner-only), the Inventory review drawer (reviewers:
-- PD / AS / HQ), Login (the dead demo grid), Payments (payer name lookup) and
-- LoginCredentialsCard (PD / SD / owner). None of them is a franchisee screen
-- except Payments, where the worst case is a payer name rendering blank rather
-- than an error. `app_role()` itself is SECURITY DEFINER and resolves the
-- caller by JWT email, so it keeps working even when this policy would hide
-- the row — sign-in is unaffected.
--
-- VERIFY AFTER RUNNING (re-run scripts/qa-smoke.ts):
--   franchisee -> users: 1, referral_codes: 0
--   PD         -> referral_codes: their own (+ sub-partners')
--   owner      -> users: all
--
-- ── "POTENTIAL ISSUE DETECTED: destructive operations" ───────────────────
-- The Supabase SQL editor flags this. It is reacting to the word DROP, not to
-- anything it has understood about the script. What gets dropped here is two
-- POLICIES — no table, no column, no row of data is touched, and each DROP is
-- followed immediately by the CREATE that replaces it.
--
-- There IS one real hazard, and the BEGIN/COMMIT below removes it: the editor
-- runs statements one after another, so a failure landing BETWEEN a DROP and
-- its CREATE would leave `users` with no SELECT policy at all — every signed-in
-- person blanked out until someone re-ran the CREATE. Wrapped in a transaction,
-- the whole thing either applies or none of it does.
--
-- Every helper this depends on (app_user_id, app_role, app_is_admin,
-- app_distributor, app_spd, app_area_supervisor_id) was verified to exist on
-- the live database before shipping this file.
-- ============================================================

BEGIN;

-- ── users ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ref_select ON users;

CREATE POLICY ref_select ON users
  FOR SELECT TO authenticated
  USING (
    -- Always your own row: the app resolves the signed-in profile from it.
    id = public.app_user_id()
    -- Staff keep the directory. They need each other's names for reviewer
    -- attribution, payer lookups and the admin screens.
    OR public.app_role() IN (
      'owner',
      'operations_manager',
      'forecaster',
      'plant_manager',
      'billing_user',
      'partner_distributor',
      'sub_partner_distributor',
      'area_manager'
    )
  );

-- ── referral_codes (tightens 045) ────────────────────────────────────────
DROP POLICY IF EXISTS ref_select ON referral_codes;

CREATE POLICY ref_select ON referral_codes
  FOR SELECT TO authenticated
  USING (
    -- HQ sees every channel.
    (SELECT public.app_is_admin())
    -- A Partner Distributor sees its own code, and its sub-partners' (it
    -- recruits them and hands those codes out). The role test is what stops
    -- the PD's own franchisees matching this same branch.
    OR (public.app_role() = 'partner_distributor'
        AND distributor_id = public.app_distributor())
    -- A sub-partner sees only its own.
    OR (public.app_role() = 'sub_partner_distributor'
        AND sub_partner_distributor_id = public.app_spd())
    -- An Area Supervisor sees codes routed through them.
    OR (public.app_role() = 'area_manager'
        AND area_supervisor_id = public.app_area_supervisor_id())
  );

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── REVERT (manual) ──────────────────────────────────────────────────────
-- Back to 045 + 003's blanket read. Only do this if narrowing `users` turns
-- out to blank a screen for a staff role.
--
-- DROP POLICY IF EXISTS ref_select ON users;
-- CREATE POLICY ref_select ON users FOR SELECT TO authenticated USING (true);
--
-- DROP POLICY IF EXISTS ref_select ON referral_codes;
-- CREATE POLICY ref_select ON referral_codes FOR SELECT TO authenticated
--   USING (
--     (SELECT public.app_is_admin())
--     OR distributor_id = public.app_distributor()
--     OR sub_partner_distributor_id = public.app_spd()
--     OR area_supervisor_id = public.app_area_supervisor_id()
--   );
-- NOTIFY pgrst, 'reload schema';
