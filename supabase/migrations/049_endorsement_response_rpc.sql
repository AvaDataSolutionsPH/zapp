-- ============================================================
-- 049 — Answering an endorsement moves to an RPC (fixes DECLINE)
-- ============================================================
--
-- 048 let the recipient resolve an offer with a plain UPDATE, guarded by
-- `apps_update_endorsement`. ACCEPT worked; DECLINE was rejected with
-- "new row violates row-level security policy". Isolated against production,
-- one column at a time:
--
--   declined + assigned_distributor_id = me   -> OK      (003's WITH CHECK carried it)
--   declined, assignment untouched            -> REJECTED
--   accepted, assignment untouched            -> REJECTED
--   endorsement_status back to 'pending'      -> OK
--   endorsement_note only                     -> OK
--
-- The pattern is exact: any write that leaves `endorsement_status = 'pending'`
-- is refused unless some OTHER policy's WITH CHECK independently passes. That
-- is 048's USING clause being applied to the NEW row — the WITH CHECK it also
-- declares is not what is deciding. ACCEPT only ever looked fine because it
-- sets `assigned_distributor_id` to the recipient, which satisfies 003 on its
-- own; DECLINE deliberately changes no assignment, so it had nothing to hide
-- behind.
--
-- ── WHY AN RPC RATHER THAN A THIRD ATTEMPT AT THE PREDICATE ──────────────
-- A row-level predicate is the wrong tool for a STATE TRANSITION. It can only
-- describe what a row may look like, never what change is legitimate, so the
-- recipient still had to be trusted to write the right columns: nothing in 048
-- stopped them marking an offer `accepted` while quietly leaving the
-- assignment with the sender, or accepting on behalf of a different plant.
--
-- One SECURITY DEFINER function states the transition once and enforces it for
-- everyone: who may answer, what accepting actually does, and that the audit
-- entry lands with it. Same reasoning as migration 028 moving audit appends off
-- the whole-row write.
--
-- ⚠️ The audit entry MUST be appended in here, not by the client afterwards.
-- On decline the application stays with the SENDER, so once the update policy
-- below is dropped the recipient can no longer write that row at all — a
-- follow-up `append_application_audit` would be silently dropped by RLS and
-- the decline would vanish from the history.
--
-- SECURITY DEFINER bypasses RLS, so authorization is re-checked in the body:
-- the caller must BE the channel the offer was made to, and the offer must
-- still be pending.
-- ============================================================

BEGIN;

-- 048's update policy is what broke DECLINE, and the RPC replaces every write
-- it was there to allow.
DROP POLICY IF EXISTS apps_update_endorsement ON applications;

CREATE OR REPLACE FUNCTION public.respond_to_endorsement(
  p_application_id text,
  p_accept         boolean,
  p_entry          jsonb,
  p_reason         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  text := public.app_role();
  v_app   applications%ROWTYPE;
  v_dist  text;
  v_spd   text;
  v_plant text;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hindi mahanap ang application.';
  END IF;

  IF v_app.endorsement_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Wala nang nakabinbing endorsement dito.';
  END IF;

  -- Who is answering? Resolving the channel here is also what decides the
  -- plant, so the client cannot pick one.
  IF v_role = 'partner_distributor'
     AND v_app.endorsed_to_distributor_id IS NOT NULL
     AND v_app.endorsed_to_distributor_id = public.app_distributor() THEN
    v_dist := public.app_distributor();
    v_spd  := NULL;
    SELECT plant_id INTO v_plant FROM distributors WHERE id = v_dist;

  ELSIF v_role = 'sub_partner_distributor'
     AND v_app.endorsed_to_sub_partner_distributor_id IS NOT NULL
     AND v_app.endorsed_to_sub_partner_distributor_id = public.app_spd() THEN
    v_spd := public.app_spd();
    -- BOTH ids: an application under a sub-partner must still carry the parent
    -- distributor or the parent's own scope stops matching it.
    SELECT parent_distributor_id, plant_id INTO v_dist, v_plant
      FROM sub_partner_distributors WHERE id = v_spd;

  ELSE
    RAISE EXCEPTION 'Ikaw lang ang pinag-endorsuhan ang pwedeng sumagot dito.';
  END IF;

  IF p_accept THEN
    UPDATE applications SET
      assigned_distributor_id             = v_dist,
      assigned_sub_partner_distributor_id = v_spd,
      -- The point of the hand-over is that the RECIPIENT serves this area;
      -- leaving the sender's plant would build the store under a plant that
      -- does not deliver there. COALESCE keeps a NOT NULL column safe if a
      -- channel somehow has no plant recorded.
      assigned_plant_id          = COALESCE(v_plant, v_app.assigned_plant_id),
      endorsement_status         = 'accepted',
      endorsement_resolved_at    = now(),
      endorsement_decline_reason = NULL,
      audit_log                  = audit_log || p_entry
    WHERE id = p_application_id;
  ELSE
    -- Declining changes NO assignment: the application was never the
    -- recipient's, and it has to stay pointing home.
    UPDATE applications SET
      endorsement_status         = 'declined',
      endorsement_resolved_at    = now(),
      endorsement_decline_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      audit_log                  = audit_log || p_entry
    WHERE id = p_application_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_endorsement(text, boolean, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.respond_to_endorsement(text, boolean, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Shows what is left on the table, so the policy set can be eyeballed after
-- running this.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'applications'
ORDER BY policyname;

-- ── REVERT (manual) ──────────────────────────────────────────────────────
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.respond_to_endorsement(text, boolean, jsonb, text);
-- CREATE POLICY apps_update_endorsement ON applications FOR UPDATE TO authenticated
--   USING (
--     endorsement_status = 'pending'
--     AND (
--       (public.app_role() = 'partner_distributor'
--        AND endorsed_to_distributor_id = public.app_distributor())
--       OR (public.app_role() = 'sub_partner_distributor'
--           AND endorsed_to_sub_partner_distributor_id = public.app_spd())
--     )
--   );
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
