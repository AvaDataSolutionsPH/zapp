-- ============================================================
-- 020_billing_revision_amount.sql
-- ============================================================
-- Phases C + D of the PD billing-review / revision subsystem.
--
-- Phase C — "Additional Amount Due after Revision": when the PD's corrected
-- counts increase the store's SOLD quantity, the store's DR-based billing
-- (Zapp Billing = DR Sold Value) goes up. The POSITIVE delta
--   additional_amount = max(0, revised DR-sold − original DR-sold)
-- is captured as a SEPARATE amount (the original billing row is left
-- untouched — audit trail, boss-confirmed). Snapshotted at file time here for
-- audit stability (the UI also derives it live for robustness).
--
-- Phase D — Franchisee dispute: the franchisee can view the corrected counts +
-- additional amount and DISPUTE it. dispute_note / disputed_at record that; the
-- status flips 'requested' → 'disputed' (the CHECK from 019 already allows it).
-- The brev_update policy from 019 (store-scoped, non-view-only) already lets the
-- franchisee update its own store's revision, so no new policy is needed.
--
-- Additive columns only. Existing 019 rows get additional_amount = 0 and NULL
-- dispute fields. Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE billing_revisions
  ADD COLUMN IF NOT EXISTS additional_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_note TEXT,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;

-- ── REVERT (dev only) ─────────────────────────────────────────────────────
-- ALTER TABLE billing_revisions
--   DROP COLUMN IF EXISTS additional_amount,
--   DROP COLUMN IF EXISTS dispute_note,
--   DROP COLUMN IF EXISTS disputed_at;
