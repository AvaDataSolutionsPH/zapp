-- ============================================================
-- 047 — 🔴 Identity documents were readable by ANYONE
-- ============================================================
--
-- Found by the pre-go-live audit, and this is the most serious thing in it.
--
-- ── FINDING 1: PUBLIC. No login required. ────────────────────────────────
-- 004's `stor_read_anon` granted the `anon` role SELECT on
-- `zapp-private/gov-id/%` and `zapp-private/proof-of-billing/%`. SELECT on
-- storage.objects is what both LIST and DOWNLOAD check, so a plain visitor
-- holding nothing but the publishable anon key — which ships inside the browser
-- bundle and is readable by anyone who opens devtools — could enumerate the
-- folders and download the files. Verified against production:
--
--     anon list  zapp-private/gov-id           -> folders enumerated
--     anon fetch gov-id/<folder>/<file>.png    -> 200, bytes returned
--
-- These are government IDs and proof-of-billing documents belonging to real
-- applicants.
--
-- ── FINDING 2: every franchisee could read every OTHER applicant's ID. ───
-- `stor_read_auth` granted authenticated SELECT on the whole private bucket.
-- A franchisee login could therefore list all 17 gov-id folders, download
-- anyone's ID, and mint a shareable signed URL for it. Verified the same way.
-- Harmless while the only logins were eleven demo accounts; not harmless now
-- that every franchisee gets one.
--
-- ── WHY THE ANON GRANT CAN JUST GO ───────────────────────────────────────
-- 004's comment justifies it as letting "the apply form sign its own
-- just-uploaded gov-id / proof-of-billing". That is no longer true, and
-- arguably never needed to be:
--   · `/apply` stopped collecting those documents entirely — it sends empty
--     strings for both and they are gathered after approval instead;
--   · every remaining uploader passes `{ sign: false }` — PartnerOnboardingPage
--     (anonymous), AccountVerificationPage (the franchisee) and
--     MonitoringFieldsCard all upload WITHOUT reading back.
-- Writes are untouched, so no upload path breaks. Checked every `uploadFile`
-- call against the identity prefixes before writing this.
--
-- ── WHAT FRANCHISEES KEEP ────────────────────────────────────────────────
-- Only the three identity prefixes are restricted. DR slips, crate photos and
-- payment proofs stay readable, because a franchisee genuinely needs to see the
-- photos attached to their own deliveries. Per-store scoping of THOSE is the
-- long-standing B2 item and needs a client path change first (paths shard by
-- entity id, not store id) — it is not attempted here.
--
-- ⚠️ Staff keep full read: PD / SPD / Area Supervisor verify these documents
-- (026's canVerifyDocuments), so they must still be able to open them.
-- The role test is an explicit ALLOWLIST, so an authenticated caller with no
-- `public.users` row — an /onboarding applicant mid-wizard is exactly that,
-- and `app_role()` returns NULL for them — gets nothing.
--
-- VERIFY AFTER RUNNING:
--   anon        list/download gov-id      -> blocked
--   franchisee  download someone's gov-id -> blocked
--   owner       signed URL for a gov-id   -> still works
--   /onboarding anonymous upload          -> still works (writes untouched)
-- ============================================================

drop policy if exists stor_read_auth on storage.objects;
drop policy if exists stor_read_anon on storage.objects;

-- Anon: the PUBLIC bucket only. Nothing in zapp-private, ever.
create policy stor_read_anon on storage.objects
  for select to anon
  using (bucket_id = 'zapp-public');

-- Authenticated: public bucket freely; private bucket freely EXCEPT the
-- identity prefixes, which are staff-only.
create policy stor_read_auth on storage.objects
  for select to authenticated
  using (
    bucket_id = 'zapp-public'
    or (
      bucket_id = 'zapp-private'
      and (
        case
          when name like 'gov-id/%'
            or name like 'proof-of-billing/%'
            or name like 'selfie/%'
          then public.app_role() in (
            'owner',
            'operations_manager',
            'forecaster',
            'plant_manager',
            'billing_user',
            'partner_distributor',
            'sub_partner_distributor',
            'area_manager'
          )
          else true
        end
      )
    )
  );

-- Verify
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ── REVERT (manual) — back to 004 ────────────────────────────────────────
-- Only if a staff role turns out to be unable to open a document it must
-- review. Do NOT revert to regain anon access; nothing needs it.
--
-- drop policy if exists stor_read_auth on storage.objects;
-- drop policy if exists stor_read_anon on storage.objects;
-- create policy stor_read_auth on storage.objects
--   for select to authenticated
--   using (bucket_id in ('zapp-public', 'zapp-private'));
-- create policy stor_read_anon on storage.objects
--   for select to anon
--   using (
--     bucket_id = 'zapp-public'
--     or (bucket_id = 'zapp-private'
--         and (name like 'gov-id/%' or name like 'proof-of-billing/%'))
--   );
