-- ============================================================
-- ZAPP Donuts ERP — 006 Public /apply anonymous INSERT
-- ============================================================
--
-- PROBLEM this fixes:
--   The public /apply form is used by ANONYMOUS visitors (no login).
--   Migration 003 replaced the permissive `allow_all_dev` policy with
--   role-scoped policies that are all `TO authenticated`, and the
--   `applications` INSERT policy (`apps_insert`) assumed /apply still
--   ran on mock data ("internal INSERTs come from reviewers"). So a
--   real anonymous applicant's submission was blocked by RLS — the
--   form showed "Submitted!" but nothing ever reached the DB / the
--   reviewer queue. (The client used to also skip the write for anon;
--   that gate was removed in the same change — see useStore
--   `submitApplication`.)
--
-- WHAT THIS DOES:
--   Lets the anon role INSERT into `applications`, but ONLY rows in
--   `status = 'pending'` (can't inject approved/reviewed rows). Anon
--   still cannot SELECT / UPDATE / DELETE applications — a submitter
--   can create a pending application and nothing else.
--
-- SECURITY NOTE (pilot-acceptable, harden later):
--   This is a public write path, same posture as the already-open
--   anonymous Storage uploads the /apply form uses for gov-id /
--   proof-of-billing. It is a spam vector in theory (anyone with the
--   anon key can insert pending applications). The production-correct
--   version routes submission through a Supabase Edge Function that
--   validates the referral code server-side with the service_role key
--   — same track as franchisee account provisioning. For the Bicol
--   pilot the scoped anon policy below is the pragmatic MVP.
--
-- HOW TO RUN: Supabase SQL Editor → paste → Run. Run AFTER 003.
-- Re-runnable (drops the policy it creates first).
--
-- REVERT:
--   drop policy if exists apps_insert_public on public.applications;
--   revoke insert on public.applications from anon;

-- Table-level privilege (RLS policy alone is not enough without the grant).
grant insert on public.applications to anon;

-- Anon may create ONLY pending applications.
drop policy if exists apps_insert_public on public.applications;
create policy apps_insert_public on public.applications
  for insert to anon
  with check (status = 'pending');

-- Verify
select policyname, cmd, roles, with_check
from pg_policies
where schemaname = 'public' and tablename = 'applications'
order by policyname;
