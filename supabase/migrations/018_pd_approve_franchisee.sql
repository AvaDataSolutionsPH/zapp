-- ============================================================
-- 018_pd_approve_franchisee.sql
-- ============================================================
-- Let a Partner Distributor APPROVE a franchisee onboarding application under
-- its own channel (boss: "pwede rin sila mag approve ng franchisee na under
-- sakanila").
--
-- Approving an onboarding application (`reviewApplication` → 'approved') does
-- three writes: UPDATE applications, INSERT stores, INSERT the franchisee's
-- `users` profile (role franchisee_distributor / franchisee_direct, with
-- distributor_id = the PD). The first two already work for a PD:
--   * apps_update (003) allows partner_distributor for its own distributor.
--   * stores_insert (003) checks app_is_reviewer(), which INCLUDES
--     partner_distributor.
-- Only the users INSERT was blocked: users_pd_insert (011) allowed a PD to
-- create SPD / area_manager profiles but NOT franchisee ones, so the approval
-- failed with RLS 42501 at the user-profile step.
--
-- This widens users_pd_insert to also let a PD create a franchisee login scoped
-- to its own distributor (distributor_id = app_distributor()). SPD / AS creation
-- is unchanged. Additive, safe (a PD can already onboard its own franchisees via
-- the New Franchisee form; this just lets the same happen through approval).
--
-- Idempotent (drop+create). Run BEFORE the PD approve flow is used.
-- ============================================================

DROP POLICY IF EXISTS users_pd_insert ON public.users;
CREATE POLICY users_pd_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_role() = 'partner_distributor'
    AND (
      (role = 'sub_partner_distributor'
        AND sub_partner_distributor_id IN (
          SELECT id FROM public.sub_partner_distributors
          WHERE parent_distributor_id = public.app_distributor()))
      OR (role = 'area_manager' AND plant_id = public.app_plant())
      -- NEW: PD approves a franchisee under its own distributor.
      OR (role IN ('franchisee_distributor', 'franchisee_direct')
        AND distributor_id = public.app_distributor())
    )
  );

-- ── REVERT (dev only) ─────────────────────────────────────────────────────
-- Re-run migration 011's users_pd_insert (SPD / AS only) to drop the franchisee
-- branch.
