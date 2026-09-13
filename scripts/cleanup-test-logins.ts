// ============================================================
// ZAPP Donuts ERP — delete the leftover TEST logins + test entities
// ============================================================
//
// `npm run db:reset` deliberately KEEPS users, distributors,
// sub_partner_distributors, area_supervisors, plants, skus, packaging_catalog
// and referral_codes — otherwise you would lose the ability to log in at all.
// That means every throwaway account created while testing survives it. This
// script removes exactly those, and nothing else.
//
// SAFETY DESIGN
//   · Dry run by default. Deletes only with `--yes`.
//   · Works from an explicit ALLOWLIST. Anything not named here is untouchable,
//     so a typo can never widen the blast radius.
//   · Refuses to run if an address on the KEEP list somehow appears in the
//     delete list.
//   · Deletes BOTH layers of an account (public.users + auth.users). Deleting
//     one side only leaves a login that authenticates into a blank screen —
//     every RLS helper resolves the caller via users.email.
//   · Child rows first (referral_codes -> sub_partner_distributors ->
//     distributors), because there is no ON DELETE CASCADE anywhere.
//
// ⚠️ RUN `npm run db:reset -- --yes` FIRST. While stores still exist they
//    reference area_supervisors and distributors (stores.area_supervisor_id is
//    NOT NULL), and those deletes will fail with a 23503.
//
// Usage:
//   npx tsx scripts/cleanup-test-logins.ts          # dry run — shows the plan
//   npx tsx scripts/cleanup-test-logins.ts --yes    # actually deletes
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
// ============================================================
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('✗ Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ── Accounts to DELETE (exact match, lowercased) ────────────────────────────
const DELETE_EMAILS = [
  // franchisee logins minted by test approvals
  'zapp001@shop.zappdonuts.ph',
  'zapp002@shop.zappdonuts.ph',
  'zapp003@shop.zappdonuts.com',
  'zapp004@shop.zappdonuts.com',
  'zapp005@shop.zappdonuts.com',
  'qa001@shop.zappdonuts.com',        // created during the 2026-09-13 E2E check
  'dms01@shop.zappdonuts.com',
  'md-9001@shop.zappdonuts.ph',
  'md-demo-01@shop.zappdonuts.ph',
  // self-service onboarding tests
  'onbtest1@example.com',
  'onbtest2@example.com',
  'onbtest3@example.com',
  'onbtest4@example.com',
  // partner/staff test accounts
  'testpd.bicol@example.com',
  'testspd.bicol@example.com',
  'jojo@gmail.com',
  'qa.verify.as@zappdonuts.com',      // created during the 2026-09-13 E2E check
];

// ── Accounts that must SURVIVE. Guard rail, not documentation. ──────────────
const KEEP_EMAILS = [
  'josebenitua@gmail.com',            // Randy — owner
  'pd01@zappdonuts.com',              // PD Placeholder 01
  'alfonso@zappdonuts.com', 'diana@zappdonuts.com', 'gabriel@zappdonuts.com',
  'helen@zappdonuts.com', 'ivan@zappdonuts.com', 'marco@zappdonuts.com',
  'ricardo@zappdonuts.com', 'mariel@zappdonuts.com', 'patricia@zappdonuts.com',
  'legazpi.centro@zappdonuts.com', 'legazpi.port@zappdonuts.com',
];

// ── Test ENTITY rows (not accounts). Named, never pattern-matched. ──────────
const DELETE_DISTRIBUTOR_NAMES = ['Test PD Bicol'];
const DELETE_SPD_NAMES = ['Test SPD Under Bicol', 'jojo'];
const DELETE_AREA_SUPERVISOR_NAMES = ['QA Verify Supervisor'];

async function main() {
  const live = process.argv.includes('--yes');
  console.log(`\nTarget: ${url}`);
  console.log(live ? '\n⚠️  LIVE RUN — rows WILL be deleted.\n' : '\n(dry run — pass --yes to actually delete)\n');

  const overlap = DELETE_EMAILS.filter((e) => KEEP_EMAILS.includes(e));
  if (overlap.length) {
    console.error('✗ ABORT: these are on BOTH lists:', overlap.join(', '));
    process.exit(1);
  }

  // ── Report what exists ────────────────────────────────────────────────────
  const { data: profiles } = await sb.from('users').select('id, email, name, role').in('email', DELETE_EMAILS);
  const { data: authList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authHits = (authList?.users ?? []).filter((u) => DELETE_EMAILS.includes((u.email ?? '').toLowerCase()));

  console.log(`public.users profiles matched: ${profiles?.length ?? 0}`);
  for (const p of profiles ?? []) console.log(`   · ${p.email}  (${p.name} / ${p.role})`);
  console.log(`auth.users logins matched:     ${authHits.length}`);
  for (const u of authHits) console.log(`   · ${u.email}`);

  const { data: dists } = await sb.from('distributors').select('id, name').in('name', DELETE_DISTRIBUTOR_NAMES);
  const { data: spds } = await sb.from('sub_partner_distributors').select('id, name').in('name', DELETE_SPD_NAMES);
  const { data: ases } = await sb.from('area_supervisors').select('id, name').in('name', DELETE_AREA_SUPERVISOR_NAMES);
  console.log(`distributors: ${(dists ?? []).map((d) => d.name).join(', ') || 'none'}`);
  console.log(`sub-PDs:      ${(spds ?? []).map((d) => d.name).join(', ') || 'none'}`);
  console.log(`area sups:    ${(ases ?? []).map((d) => d.name).join(', ') || 'none'}`);

  // Anything still pointing at those entities blocks the delete (no cascade).
  const distIds = (dists ?? []).map((d) => d.id);
  const asIds = (ases ?? []).map((d) => d.id);
  if (distIds.length) {
    const { count } = await sb.from('stores').select('*', { count: 'exact', head: true }).in('distributor_id', distIds);
    if (count) console.log(`   ⚠️  ${count} store(s) still reference those distributors — run db:reset first.`);
  }
  if (asIds.length) {
    const { count } = await sb.from('stores').select('*', { count: 'exact', head: true }).in('area_supervisor_id', asIds);
    if (count) console.log(`   ⚠️  ${count} store(s) still reference those area supervisors — run db:reset first.`);
  }

  if (!live) {
    console.log('\nNothing deleted. Re-run with --yes when the plan above looks right.\n');
    return;
  }

  // ── Delete, children first ────────────────────────────────────────────────
  let errors = 0;
  // PromiseLike, not Promise: a Supabase query builder is thenable but is not
  // an actual Promise until awaited.
  const step = async (label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) { errors++; console.log(`  ✗ ${label}: ${error.message}`); }
    else console.log(`  ✓ ${label}`);
  };

  const spdIds = (spds ?? []).map((d) => d.id);
  if (distIds.length) await step('referral_codes (by distributor)', () => sb.from('referral_codes').delete().in('distributor_id', distIds));
  if (spdIds.length) await step('referral_codes (by sub-PD)', () => sb.from('referral_codes').delete().in('sub_partner_distributor_id', spdIds));
  if (spdIds.length) await step('sub_partner_distributors', () => sb.from('sub_partner_distributors').delete().in('id', spdIds));
  if (distIds.length) await step('distributors', () => sb.from('distributors').delete().in('id', distIds));
  if (asIds.length) await step('area_supervisors', () => sb.from('area_supervisors').delete().in('id', asIds));

  await step('public.users profiles', () => sb.from('users').delete().in('email', DELETE_EMAILS));

  for (const u of authHits) {
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) { errors++; console.log(`  ✗ auth.users ${u.email}: ${error.message}`); }
    else console.log(`  ✓ auth.users ${u.email}`);
  }

  // ── Prove the keepers survived ────────────────────────────────────────────
  const { data: kept } = await sb.from('users').select('email').in('email', KEEP_EMAILS);
  console.log(`\nKEEP list still present: ${kept?.length ?? 0}/${KEEP_EMAILS.length}`);
  const missing = KEEP_EMAILS.filter((e) => !(kept ?? []).some((k) => k.email === e));
  if (missing.length) console.log('  ⚠️  MISSING:', missing.join(', '));

  console.log(errors ? `\nDone with ${errors} error(s).\n` : '\nDone, no errors.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
