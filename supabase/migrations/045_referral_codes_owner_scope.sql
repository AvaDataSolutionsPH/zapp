-- ============================================================
-- 045_referral_codes_owner_scope.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE.
--
-- REPORTED: a Partner Distributor could open /settings and read every user,
-- distributor and referral code in the business. The page is now owner-gated,
-- but hiding a screen is not access control — the DATA was readable by any
-- signed-in account, so anything that queries the table (a future page, the
-- browser console, a copied anon key) could still list it.
--
-- VERIFIED with the real PD account (zappdonuts88): RLS returned
--     users 7/7 · distributors 3/3 · area_supervisors 2/2 · referral_codes 3/3
-- i.e. everything the owner sees. The cause is 003's blanket reference policy:
--     CREATE POLICY ref_select ON <ref tables> FOR SELECT TO authenticated USING (true)
--
-- THIS MIGRATION FIXES ONLY `referral_codes`, deliberately.
-- A channel code is a SECRET: it is how an applicant is routed to a specific
-- partner, and one distributor reading another's code can divert their
-- recruits. It is also the only one of the four that can be narrowed with no
-- client fallout:
--   · /apply no longer reads this table at all — it goes through
--     `validate_referral_code()` (044, SECURITY DEFINER), so applicants are
--     unaffected;
--   · the Referral Codes admin page is owner-only;
--   · a PD/SPD only ever needs their OWN code, which this still returns.
--
-- ⚠️ `users`, `distributors` and `area_supervisors` are LEFT OPEN on purpose.
-- The client resolves names from those slices all over the app (audit entries,
-- application tables, assignment dropdowns), so narrowing them blanks labels
-- rather than erroring — the same silent-absence failure as 029/035. They need
-- a client pass first and are tracked in CLAUDE.md, not rushed here while the
-- business is encoding live.
--
-- Idempotent.
-- ============================================================

DROP POLICY IF EXISTS ref_select ON referral_codes;

CREATE POLICY ref_select ON referral_codes
  FOR SELECT TO authenticated
  USING (
    -- HQ sees every channel.
    (SELECT public.app_is_admin())
    -- A distributor sees its own code, and the codes of its sub-partners
    -- (it recruits them, and needs to hand those codes out).
    OR distributor_id = public.app_distributor()
    -- A sub-partner sees only its own.
    OR sub_partner_distributor_id = public.app_spd()
    -- An Area Supervisor sees codes routed through them.
    OR area_supervisor_id = public.app_area_supervisor_id()
  );

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) — back to 003's blanket policy ────────────────────────
-- DROP POLICY IF EXISTS ref_select ON referral_codes;
-- CREATE POLICY ref_select ON referral_codes FOR SELECT TO authenticated USING (true);
