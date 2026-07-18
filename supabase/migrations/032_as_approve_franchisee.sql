-- ============================================================
-- 032 — Area Supervisor may approve applications
-- ============================================================
--
-- Boss: the Area Supervisor is the one who evaluates the site and assigns the
-- Shop Code, so he expects to approve from that same screen. `canSetStatus`
-- (client) is widened to include area_manager; this migration makes the DB
-- agree.
--
-- ⚠️ WHY THIS MIGRATION IS MANDATORY, NOT OPTIONAL.
-- Approving runs FOUR writes in order:
--   1. auth signUp (the franchisee's login)      — no RLS, always succeeds
--   2. UPDATE applications                        — 029 already allows AS
--   3. INSERT stores                              — 003 stores_insert checks
--      app_is_reviewer(), which ALREADY includes area_manager
--   4. INSERT users (the franchisee's profile)    — ❌ BLOCKED for an AS
--
-- `users` is a reference table: 003's ref_write is app_is_admin() only, and
-- 011/018's users_pd_insert is partner_distributor only. So without this
-- migration an AS approval fails at step 4 — AFTER steps 1-3 have already
-- committed. The in-memory rollback cannot undo them, leaving an approved
-- application + a real store + an auth login with NO profile row. And `login`
-- force-signs-out any account without a profile, so the franchisee would be
-- permanently unable to log in, with the UI showing the approval as done.
-- That is strictly worse than today's "no Approve button".
--
-- SCOPE GUARD: an AS may create ONLY franchisee profiles. RLS is row-level, so
-- an unrestricted INSERT would let an Area Supervisor mint themselves an
-- `owner` row — a privilege-escalation path. The role whitelist below is the
-- whole point of not simply adding area_manager to ref_write.
--
-- Deliberately NOT scoped by plant: the application's assigned plant is set by
-- whoever encoded it and may legitimately differ from the supervisor's own, and
-- a mismatch here would silently block a valid approval — the exact failure
-- mode as 029. Role is the security boundary; plant is not.
--
-- Additive: it only ADDS a policy. PD (018) and admin (003) paths are
-- untouched. Idempotent (drop + create).
--
-- ROLLOUT: run this BEFORE deploying the client change that shows the Approve
-- button to an Area Supervisor.
-- ============================================================

DROP POLICY IF EXISTS users_as_insert ON public.users;
CREATE POLICY users_as_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_role() = 'area_manager'
    AND role IN ('franchisee_distributor', 'franchisee_direct')
  );

-- PostgREST caches the schema; policies are picked up live, but reload anyway
-- so this is consistent with every other migration in the project.
NOTIFY pgrst, 'reload schema';

-- ── REVERT (dev only) ─────────────────────────────────────────────────────
--   DROP POLICY IF EXISTS users_as_insert ON public.users;
-- ...and remove 'area_manager' from canSetStatus in
-- src/lib/applicationMonitoring.ts, or the button will 42501 again.
