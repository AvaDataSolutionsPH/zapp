// ============================================================
// ZAPP Donuts ERP — FULL WIPE, keeping ONE owner account
// ============================================================
//
// Clears EVERYTHING so the business can be encoded from scratch: all
// operational data, all accounts, all org records (distributors, sub-PDs, area
// supervisors, referral codes) and — unless told otherwise — the plants.
//
// The only thing left standing is a single owner login, because without it
// nobody can get back in: `/accounts/new` can create a Partner Distributor,
// Sub-Partner, Area Supervisor, Operations Manager or Billing User, but it
// CANNOT create an `owner`, `forecaster` or `plant_manager`. Delete the last
// owner and the only way back is raw SQL.
//
// ── WHAT THE OWNER CAN REBUILD FROM THE UI AFTERWARDS ──────────────────────
//   Plants ................ Plants → "New Plant"
//   Donut catalog ......... Admin → Donut Catalog
//   Packaging catalog ..... Admin → Packaging Catalog
//   Distributors + code ... New Account → Partner Distributor
//   Sub-Partners + code ... New Account → Sub-Partner Distributor
//   Area Supervisors ...... New Account → Area Supervisor
//   Franchisees ........... created automatically when an application is approved
//
// ── ORDER MATTERS (there is no ON DELETE CASCADE anywhere) ─────────────────
//   The keeper's own references are nulled FIRST: users.plant_id has an FK to
//   plants(id), so an owner sitting on plant-01 blocks the plants delete. Then
//   operational rows (children first), then profiles, then org rows bottom-up
//   (referral_codes -> sub_partner_distributors -> distributors), then plants,
//   then auth.users last so a half-finished run never leaves a login that
//   authenticates into a missing profile.
//
// ── THE DONUT CATALOG IS REAL DATA ─────────────────────────────────────────
//   `skus` holds the REAL products with their 10-digit SAP codes and real
//   DR/SRP prices (2000000520 Bavarian - Choco, DR 18.24 / SRP 25 ...). Those
//   codes are what DR-slip OCR matches on, and a typo becomes a wrong price in
//   billing. They are therefore KEPT BY DEFAULT. Pass --wipe-catalog only if
//   the boss wants to re-enter all nine by hand.
//
// Usage:
//   npx tsx scripts/wipe-all-keep-owner.ts                    # dry run
//   npx tsx scripts/wipe-all-keep-owner.ts --yes              # wipe
//   npx tsx scripts/wipe-all-keep-owner.ts --yes --keep-plants
//   npx tsx scripts/wipe-all-keep-owner.ts --yes --wipe-catalog
//   npx tsx scripts/wipe-all-keep-owner.ts --yes --owner someone@example.com
//
// ⚠️ IRREVERSIBLE. Take a backup first. Storage files (photos, DR slips, IDs)
//    are NOT touched — the rows referencing them are gone, so they become
//    unreachable orphans; clear the buckets in the Supabase dashboard if you
//    want the files gone too.
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

const argv = process.argv.slice(2);
const LIVE = argv.includes('--yes');
const KEEP_PLANTS = argv.includes('--keep-plants');
const WIPE_CATALOG = argv.includes('--wipe-catalog');
const ownerFlag = argv.indexOf('--owner');
const OWNER_EMAIL = (ownerFlag !== -1 ? argv[ownerFlag + 1] : 'josebenitua@gmail.com').toLowerCase();

// Children first; `stores` last — everything else references store_id.
const OPERATIONAL = [
  'notifications', 'special_orders', 'sales_metrics', 'forecasts',
  'packaging_orders', 'payments', 'billing_revisions',
  'ending_inventories', 'beginning_inventories', 'deliveries',
  'applications', 'stores',
];
// sales_metrics has a composite PK and no `id` column.
const KEY_COLUMN: Record<string, string> = { sales_metrics: 'store_id' };

async function count(table: string): Promise<string> {
  const { count: c, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  return error ? 'ERR' : String(c ?? 0);
}

async function clearAll(table: string) {
  const col = KEY_COLUMN[table] ?? 'id';
  const { error } = await sb.from(table).delete().not(col, 'is', null);
  if (error) { console.log(`  ✗ ${table}: ${error.message}`); return false; }
  console.log(`  ✓ ${table}`);
  return true;
}

async function main() {
  console.log(`\nTarget:  ${url}`);
  console.log(`Keeping: ${OWNER_EMAIL}`);
  console.log(LIVE ? '\n⚠️  LIVE RUN — data WILL be deleted.\n' : '\n(dry run — pass --yes to actually delete)\n');

  // ── The keeper must exist in BOTH layers, or this locks everyone out ──────
  const { data: keeper } = await sb.from('users')
    .select('id, name, email, role, plant_id, distributor_id').eq('email', OWNER_EMAIL).maybeSingle();
  const { data: authList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const keeperAuth = (authList?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === OWNER_EMAIL);

  if (!keeper || !keeperAuth) {
    console.error(`✗ ABORT: "${OWNER_EMAIL}" must exist in BOTH public.users (${keeper ? 'ok' : 'MISSING'}) and auth.users (${keeperAuth ? 'ok' : 'MISSING'}).`);
    console.error('  Refusing to wipe — there would be no way back in.');
    process.exit(1);
  }
  if (keeper.role !== 'owner') {
    console.error(`✗ ABORT: "${OWNER_EMAIL}" has role "${keeper.role}", not "owner".`);
    console.error('  Only an owner can rebuild plants, catalogs and accounts from the UI.');
    process.exit(1);
  }
  console.log(`Keeper OK: ${keeper.name} (${keeper.role})\n`);

  const allTables = [...OPERATIONAL, 'users', 'referral_codes', 'sub_partner_distributors',
    'distributors', 'area_supervisors', 'plants', 'skus', 'packaging_catalog'];
  console.log('CURRENT ROW COUNTS:');
  for (const t of allTables) console.log(`  · ${t}: ${await count(t)}`);
  console.log(`  · auth.users: ${(authList?.users ?? []).length}`);

  console.log('\nPLAN:');
  console.log('  clear ALL operational tables');
  console.log(`  delete every profile + login EXCEPT ${OWNER_EMAIL}`);
  console.log('  delete ALL referral_codes, sub_partner_distributors, distributors, area_supervisors');
  console.log(`  plants:  ${KEEP_PLANTS ? 'KEPT (--keep-plants)' : 'DELETED'}`);
  console.log(`  catalog: ${WIPE_CATALOG ? 'DELETED (--wipe-catalog)' : 'KEPT — real SAP codes + prices'}`);

  if (!LIVE) {
    console.log('\nNothing deleted. Re-run with --yes when this looks right.\n');
    return;
  }

  console.log('\nDELETING:');

  // 1. Detach the keeper so their FKs stop protecting rows we are removing.
  const { error: detachErr } = await sb.from('users').update({
    plant_id: null, distributor_id: null, sub_partner_distributor_id: null,
    area_ids: null, assigned_store_ids: null, plant_ids: null,
  }).eq('email', OWNER_EMAIL);
  console.log(detachErr ? `  ✗ detach keeper: ${detachErr.message}` : '  ✓ detached keeper from plant/distributor');

  // 2. Operational rows.
  for (const t of OPERATIONAL) await clearAll(t);

  // 3. Every profile except the keeper.
  const { error: uErr } = await sb.from('users').delete().neq('email', OWNER_EMAIL);
  console.log(uErr ? `  ✗ users: ${uErr.message}` : '  ✓ users (except keeper)');

  // 4. Org rows, bottom-up.
  await clearAll('referral_codes');
  await clearAll('sub_partner_distributors');
  await clearAll('distributors');
  await clearAll('area_supervisors');
  if (!KEEP_PLANTS) await clearAll('plants');
  if (WIPE_CATALOG) { await clearAll('skus'); await clearAll('packaging_catalog'); }

  // 5. Logins last.
  let authDeleted = 0, authFailed = 0;
  for (const u of authList?.users ?? []) {
    if ((u.email ?? '').toLowerCase() === OWNER_EMAIL) continue;
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) { authFailed++; console.log(`  ✗ auth ${u.email}: ${error.message}`); } else authDeleted++;
  }
  console.log(`  ✓ auth.users: ${authDeleted} deleted${authFailed ? `, ${authFailed} failed` : ''}`);

  // ── Prove the way back in still exists ───────────────────────────────────
  console.log('\nAFTER:');
  for (const t of allTables) console.log(`  · ${t}: ${await count(t)}`);
  const { data: still } = await sb.from('users').select('email, role').eq('email', OWNER_EMAIL).maybeSingle();
  const { data: reList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const stillAuth = (reList?.users ?? []).some((u) => (u.email ?? '').toLowerCase() === OWNER_EMAIL);
  console.log(`\nOWNER CHECK — profile: ${still ? `${still.email} (${still.role})` : '✗ MISSING'} | login: ${stillAuth ? 'ok' : '✗ MISSING'}`);
  if (!still || !stillAuth) console.log('  ⚠️  Do NOT sign out anywhere until this is fixed.');
  else console.log('\n✅ Blank slate. Sign in as the owner and start with Plants → New Plant.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
