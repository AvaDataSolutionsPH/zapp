-- ============================================================
-- 048 — "Endorsed to others": a PD hands an application to another channel
-- ============================================================
--
-- Boss: "Example may inquiries na mapunta sakin pero metro manila ang location.
-- Gusto ko sya ipasa sa ibang PD. Lagyan natin ng 'Endorsed to others' tapos
-- may ma drop down na list ng ibang PD. Pero ang makakagawa lang nyan is yung
-- PD lang mismo at applications na nakuha nya mismo" — plus, later: "pakidagdag
-- din ang SPD sa list".
--
-- A Partner Distributor gets an inquiry through their own referral code for a
-- place they do not serve. Today the only options are approve it (wrong
-- channel, wrong plant, wrong deliveries) or decline it (the applicant is lost
-- to the business entirely). This adds the third, obvious option: pass it to
-- the channel that does serve that area.
--
-- ── THE HAND-OVER IS A TWO-STEP, NOT A FIELD ─────────────────────────────
-- Decided with the boss: the receiving channel must ACCEPT. So this is a small
-- state machine, not a dropdown that reassigns on the spot:
--
--   (none) --endorse--> pending --accept--> accepted   (ownership moves)
--                          |
--                          +----decline--> declined    (stays with the sender)
--                          +----cancel---> (none)      (sender changes their mind)
--
-- ⚠️ `assigned_distributor_id` DOES NOT MOVE UNTIL ACCEPTANCE. That column is
-- the ONLY thing deciding who can see an application — 003's apps_select,
-- apps_update and the client scope all key on it. Moving it at endorse time
-- would make the application vanish from the sender the instant they offered
-- it, before anyone had agreed to take it, and if the recipient then declined
-- there would be nothing left pointing home.
--
-- ── WHO SEES WHAT ────────────────────────────────────────────────────────
-- Two new read branches, each deliberately narrow:
--   · while PENDING, the TARGET sees the application (they must read it to
--     decide) even though nothing is assigned to them yet;
--   · after ACCEPTANCE, the SENDER keeps SELECT via endorsed_by_distributor_id.
--     The boss asked for this explicitly: without it the application simply
--     disappears and the sender never learns whether it was taken up.
--
-- The sender's UPDATE is NOT re-granted. After acceptance
-- `assigned_distributor_id` is the recipient's, so 003's update policy stops
-- matching the sender on its own — read-only falls out of the existing rule
-- rather than needing a new one.
--
-- ── ENDORSING TO A SUB-PARTNER ───────────────────────────────────────────
-- An SPD always sits under a parent PD, and an application under an SPD must
-- carry BOTH ids or the parent's own scope stops matching. So accepting an
-- SPD endorsement sets `assigned_sub_partner_distributor_id` to the SPD *and*
-- `assigned_distributor_id` to that SPD's parent. The client writes both; the
-- WITH CHECK below is what makes the write legal for the SPD.
--
-- ⚠️ MONEY FOLLOWS ASSIGNMENT. Once accepted, the receiving channel is the
-- servicing distributor and earns the PD Profit when the store trades; an SPD
-- recipient takes their 50% share of it and the parent PD the rest. Nothing is
-- retained for the sender. That is a consequence of the existing billing
-- model, not something this migration chooses — flagged to the boss up front.
-- ============================================================

BEGIN;

-- ── Columns ──────────────────────────────────────────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS endorsed_by_distributor_id TEXT REFERENCES distributors(id),
  ADD COLUMN IF NOT EXISTS endorsed_to_distributor_id TEXT REFERENCES distributors(id),
  ADD COLUMN IF NOT EXISTS endorsed_to_sub_partner_distributor_id TEXT
    REFERENCES sub_partner_distributors(id),
  -- NULL = never endorsed. Not defaulted: "no endorsement" and "an endorsement
  -- that is waiting" must stay distinguishable.
  ADD COLUMN IF NOT EXISTS endorsement_status TEXT
    CHECK (endorsement_status IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS endorsed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS endorsement_resolved_at TIMESTAMPTZ,
  -- Why it was passed on ("Metro Manila, wala akong coverage"). The recipient
  -- is being asked to take work; they should see the reason.
  ADD COLUMN IF NOT EXISTS endorsement_note TEXT,
  ADD COLUMN IF NOT EXISTS endorsement_decline_reason TEXT;

-- The pending-target lookup runs on every application list load for a PD/SPD.
CREATE INDEX IF NOT EXISTS applications_endorsed_to_idx
  ON applications (endorsed_to_distributor_id);
CREATE INDEX IF NOT EXISTS applications_endorsed_to_spd_idx
  ON applications (endorsed_to_sub_partner_distributor_id);
CREATE INDEX IF NOT EXISTS applications_endorsed_by_idx
  ON applications (endorsed_by_distributor_id);

-- ── Read: the target while pending, the sender after acceptance ──────────
DROP POLICY IF EXISTS apps_select_endorsement ON applications;
CREATE POLICY apps_select_endorsement ON applications FOR SELECT TO authenticated
  USING (
    -- The channel an offer is sitting with, while it is still an offer.
    (
      endorsement_status = 'pending'
      AND (
        (public.app_role() = 'partner_distributor'
         AND endorsed_to_distributor_id = public.app_distributor())
        OR (public.app_role() = 'sub_partner_distributor'
            AND endorsed_to_sub_partner_distributor_id = public.app_spd())
      )
    )
    -- The sender keeps a read-only record of what they passed on, forever.
    OR (
      public.app_role() = 'partner_distributor'
      AND endorsed_by_distributor_id = public.app_distributor()
    )
  );

-- ── Write: ONLY the pending target, and only to resolve the offer ────────
-- USING selects the rows they may touch (a pending offer addressed to them).
-- WITH CHECK describes the row AFTERWARDS, which is why it has to allow the
-- post-acceptance shape too — on accept the row stops being theirs-by-offer
-- and becomes theirs-by-assignment in the same statement.
DROP POLICY IF EXISTS apps_update_endorsement ON applications;
CREATE POLICY apps_update_endorsement ON applications FOR UPDATE TO authenticated
  USING (
    endorsement_status = 'pending'
    AND (
      (public.app_role() = 'partner_distributor'
       AND endorsed_to_distributor_id = public.app_distributor())
      OR (public.app_role() = 'sub_partner_distributor'
          AND endorsed_to_sub_partner_distributor_id = public.app_spd())
    )
  )
  WITH CHECK (
    (public.app_role() = 'partner_distributor'
     AND (endorsed_to_distributor_id = public.app_distributor()
          OR assigned_distributor_id = public.app_distributor()))
    OR (public.app_role() = 'sub_partner_distributor'
        AND (endorsed_to_sub_partner_distributor_id = public.app_spd()
             OR assigned_sub_partner_distributor_id = public.app_spd()))
  );

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── REVERT (manual) ──────────────────────────────────────────────────────
-- Policies first; dropping the columns without dropping the policies that
-- reference them will fail.
--
-- BEGIN;
-- DROP POLICY IF EXISTS apps_select_endorsement ON applications;
-- DROP POLICY IF EXISTS apps_update_endorsement ON applications;
-- DROP INDEX IF EXISTS applications_endorsed_to_idx;
-- DROP INDEX IF EXISTS applications_endorsed_to_spd_idx;
-- DROP INDEX IF EXISTS applications_endorsed_by_idx;
-- ALTER TABLE applications
--   DROP COLUMN IF EXISTS endorsed_by_distributor_id,
--   DROP COLUMN IF EXISTS endorsed_to_distributor_id,
--   DROP COLUMN IF EXISTS endorsed_to_sub_partner_distributor_id,
--   DROP COLUMN IF EXISTS endorsement_status,
--   DROP COLUMN IF EXISTS endorsed_at,
--   DROP COLUMN IF EXISTS endorsement_resolved_at,
--   DROP COLUMN IF EXISTS endorsement_note,
--   DROP COLUMN IF EXISTS endorsement_decline_reason;
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
