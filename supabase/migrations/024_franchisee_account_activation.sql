-- ============================================================
-- 024_franchisee_account_activation.sql
-- ============================================================
-- Login Credentials & First-Time Account Activation — Phase A.
--
-- Approving an application now auto-generates the franchisee's login. The
-- account starts locked and must pass document verification before the
-- franchisee can reach any ERP module.
--
-- State machine (users.account_status):
--   not_activated       — login exists, franchisee has never completed
--                         verification. Blocked from every module.
--   pending_verification— documents submitted, waiting for staff review.
--                         Still blocked.
--   active              — verified. Full access.
--
-- NULLABLE ON PURPOSE — no default. NULL means "not applicable": every existing
-- staff account and every franchisee created before this migration keeps
-- working untouched. The access gate only locks a user that HAS a status and it
-- isn't 'active', so back-compat is automatic rather than needing a backfill.
--
-- password_changed_at: NULL = still on the system-generated temporary password.
-- This is what lets the Login Credentials card show "Password Updated" instead
-- of the temp password, per the boss's own Enhancement note. We deliberately do
-- NOT store the password itself — Supabase Auth hashes it (bcrypt) and it is
-- shown exactly once, at creation. Storing it to re-display later would mean
-- keeping it in plaintext, which is precisely what "passwords must be securely
-- encrypted" forbids.
--
-- applications.account_user_id links an application to the login it generated,
-- so the Login Credentials card can find it. The synthetic username email
-- (<shopcode>@shop.zappdonuts.ph) never matches the applicant's own email, so
-- an explicit link is required.
--
-- RLS: none needed. `users` is a reference table (003 ref_select/ref_write) and
-- `applications` policies are row-level, so new columns inherit them.
--
-- Idempotent. Run BEFORE deploying the client change.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT
  CHECK (account_status IN ('not_activated', 'pending_verification', 'active'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS account_user_id TEXT;

-- ── REVERT (manual) ───────────────────────────────────────────────────────
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS account_status,
--   DROP COLUMN IF EXISTS password_changed_at;
-- ALTER TABLE applications DROP COLUMN IF EXISTS account_user_id;
