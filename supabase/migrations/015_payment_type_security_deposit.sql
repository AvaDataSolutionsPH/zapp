-- ============================================================
-- 015_payment_type_security_deposit.sql
-- ============================================================
-- Partner Onboarding Phase 5: the one-time ₱2,000 security deposit is recorded
-- through the payments layer as a distinct payment type. Add a nullable `type`
-- column (defaults to 'billing' for every existing row) constrained to the two
-- known kinds.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'billing';
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('billing', 'security_deposit'));

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
-- ALTER TABLE payments DROP COLUMN IF EXISTS type;
