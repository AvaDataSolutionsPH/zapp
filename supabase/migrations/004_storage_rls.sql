-- ============================================================
-- ZAPP Donuts ERP — Phase 3b Storage RLS (read-tightening)
-- ============================================================
--
-- Closes the main Storage leak: the dev policy `allow_read_dev` granted
-- SELECT on storage.objects to BOTH anon and authenticated for BOTH
-- buckets — so anyone holding the public anon key (it ships in the client
-- JS) could LIST and READ every payment proof, gov ID, billing proof, DR
-- slip, and inventory photo.
--
-- SCOPE — read-only tightening, deliberately conservative ("wag magka-error"):
--   * Only the SELECT policy is replaced. INSERT/UPDATE/DELETE dev policies
--     are left UNTOUCHED so no upload or rollback path can break — including
--     the public /apply form, which uploads gov-id / proof-of-billing
--     (zapp-private) and store-photo (zapp-public) while ANONYMOUS.
--   * Authenticated sessions keep full read on both buckets (ERP rendering,
--     reviewer queue, payment/inventory photo previews all keep working).
--   * Anon keeps read on zapp-public (low-sensitivity, and it's a public
--     bucket served via public URL anyway) and on zapp-private ONLY for the
--     `gov-id/` and `proof-of-billing/` prefixes — so the /apply form can
--     still sign a URL for the file it just uploaded. Anon can no longer
--     list or read payment-proof / bi-dr / bi-crate / ei-crate.
--
-- RESIDUAL GAPS (intentionally deferred to a future hardening pass):
--   * INSERT/UPDATE/DELETE remain permissive (anon can still write/delete).
--   * Authenticated can read all private objects (no per-role / per-store
--     scoping). Object paths shard by entity id, not storeId, so true
--     per-store scoping needs a client path change first (see CLAUDE.md
--     "Phase 3b" / B2). Anon can still read gov-id/proof-of-billing by exact
--     path, but paths carry a random scopeId + filename so listing is
--     blocked and guessing is infeasible.
--
-- HOW TO RUN: Supabase SQL Editor -> paste -> Run. Run AFTER 001/002/003.
-- Re-runnable (drops the policies it creates first).
--
-- REVERT: re-create the permissive read policy —
--   drop policy if exists stor_read_auth on storage.objects;
--   drop policy if exists stor_read_anon on storage.objects;
--   create policy allow_read_dev on storage.objects for select
--     to anon, authenticated
--     using (bucket_id = any (array['zapp-public','zapp-private']));

-- Remove the permissive read policy + any prior run of the new ones.
drop policy if exists allow_read_dev on storage.objects;
drop policy if exists stor_read_auth on storage.objects;
drop policy if exists stor_read_anon on storage.objects;

-- Authenticated: read both buckets (ERP image rendering + reviewer queue).
create policy stor_read_auth on storage.objects
  for select to authenticated
  using (bucket_id in ('zapp-public', 'zapp-private'));

-- Anon: public bucket fully; private only the public-/apply upload prefixes
-- so the apply form can sign its own just-uploaded gov-id / proof-of-billing.
-- Anon can NOT read payment-proof / bi-dr / bi-crate / ei-crate anymore.
create policy stor_read_anon on storage.objects
  for select to anon
  using (
    bucket_id = 'zapp-public'
    or (
      bucket_id = 'zapp-private'
      and (name like 'gov-id/%' or name like 'proof-of-billing/%')
    )
  );

-- Verify
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
