// ============================================================
// ZAPP Donuts ERP — Scoped Operational Reset (for go-live)
// ============================================================
//
// Clears the DEMO/OPERATIONAL data so the team can start entering REAL data,
// WITHOUT wiping the scaffolding needed to log in and route applications.
//
//   CLEARS (operational + demo franchisees):
//     notifications, special_orders, sales_metrics, forecasts,
//     packaging_orders, payments, ending_inventories, beginning_inventories,
//     deliveries, applications, stores
//
//   KEEPS (scaffolding — logins, org, catalog, channel codes):
//     users, distributors, sub_partner_distributors, area_supervisors,
//     plants, skus, packaging_catalog, referral_codes
//
// This is DIFFERENT from `npm run db:seed` (which wipes EVERYTHING and re-inserts
// mock data). This keeps the org/logins/codes so real franchisees can be encoded
// through the "New Franchisee" onboarding form right after.
//
// SAFETY: dry-run by default. It only deletes when you pass `--yes`:
//     npx tsx scripts/reset-operational.ts          # dry run: shows counts
//     npx tsx scripts/reset-operational.ts --yes    # actually clears
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS). NEVER commit
// the key or add it to Vercel.
//
// ⚠️ IRREVERSIBLE against whichever Supabase project VITE_SUPABASE_URL points to.
//    Double-check you are pointed at the intended project before `--yes`.

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '✗ Missing env. Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Child tables first, `stores` last (everything else references store_id).
const CLEAR_ORDER = [
  'notifications',
  'special_orders',
  'sales_metrics',
  'forecasts',
  'packaging_orders',
  'payments',
  'ending_inventories',
  'beginning_inventories',
  'deliveries',
  'applications',
  'stores',
];

const KEEP = [
  'users',
  'distributors',
  'sub_partner_distributors',
  'area_supervisors',
  'plants',
  'skus',
  'packaging_catalog',
  'referral_codes',
];

// sales_metrics has a composite PK and no `id` column — filter on a real column.
const CLEAR_KEY_COLUMN: Record<string, string> = { sales_metrics: 'store_id' };

async function count(table: string): Promise<number | null> {
  const { count: c, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return null;
  return c ?? 0;
}

async function main() {
  const confirmed = process.argv.includes('--yes');
  console.log(`\nTarget project: ${url}`);
  console.log(confirmed ? '\n⚠️  LIVE RUN — data WILL be deleted.\n' : '\n(dry run — pass --yes to actually delete)\n');

  console.log('KEEP (untouched):');
  for (const t of KEEP) {
    console.log(`  · ${t}: ${await count(t) ?? '—'} rows`);
  }

  console.log('\nCLEAR:');
  for (const table of CLEAR_ORDER) {
    const before = await count(table);
    if (before === null) {
      console.log(`  · ${table}: (not present — skipped)`);
      continue;
    }
    if (!confirmed) {
      console.log(`  · ${table}: ${before} rows → would clear`);
      continue;
    }
    const keyCol = CLEAR_KEY_COLUMN[table] ?? 'id';
    const { error } = await supabase.from(table).delete().neq(keyCol, '__NEVER_MATCHES__');
    if (error && !error.message.includes('does not exist')) {
      console.error(`  ✗ ${table}: ${error.message}`);
      throw error;
    }
    console.log(`  ✓ cleared ${table} (${before} → 0)`);
  }

  console.log(
    confirmed
      ? '\n✅ Operational reset complete. Scaffolding preserved; ready for real onboarding.\n'
      : '\nNothing deleted. Re-run with --yes to apply.\n',
  );
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
