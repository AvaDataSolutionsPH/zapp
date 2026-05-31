// ============================================================
// ZAPP Donuts ERP — Phase 2A Seed Script (one-time)
// ============================================================
//
// Reads mock data from src/data/mockData.ts and inserts into the
// Supabase Postgres tables created by migrations/001_create_tables.sql.
//
// HOW TO RUN:
//   1. .env.local needs VITE_SUPABASE_URL plus a key:
//        - pre-003 DB:  VITE_SUPABASE_ANON_KEY is enough
//        - 003 RLS live: SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) is REQUIRED
//      (service-role key stays local-only — never commit it or add to Vercel)
//   2. Run migrations 001 + 002 (+ 003 for role-scoped RLS) in SQL Editor
//   3. From project root:
//        npx tsx scripts/seed-from-mock.ts
//
// WHAT IT DOES:
//   - Clears existing rows in dependency-safe order
//   - Inserts mock entities in forward dependency order
//   - Logs per-table counts so you can verify
//
// SAFE TO RE-RUN: yes — each run truncates and re-seeds.

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Vite reads .env.local automatically; Node scripts have to point dotenv at it.
loadEnv({ path: '.env.local' });

import {
  plants,
  skus,
  packagingCatalog,
  distributors,
  subPartnerDistributors,
  areaSupervisors,
  users,
  stores,
  applications,
  deliveries,
  beginningInventories,
  endingInventories,
  payments,
  packagingOrders,
  forecasts,
  referralCodes,
  salesMetrics,
  notifications,
  specialOrders,
} from '../src/data/mockData';

const url = process.env.VITE_SUPABASE_URL;
// After Phase 3 (003_role_scoped_rls.sql) the anon/authenticated key is
// blocked by role-scoped policies, so seeding needs the service-role key
// (DB admin, bypasses RLS). Keep it ONLY in .env.local (gitignored) — never
// in client code or Vercel env. Falls back to anon for pre-003 databases.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const key = serviceKey ?? anonKey;

if (!url || !key) {
  console.error(
    'Missing VITE_SUPABASE_URL and a key. Set SUPABASE_SERVICE_ROLE_KEY (preferred, ' +
      'required once role-scoped RLS is live) or VITE_SUPABASE_ANON_KEY in .env.local',
  );
  process.exit(1);
}

if (serviceKey) {
  console.log('🔑 Using service-role key — bypasses RLS (correct for seeding).');
} else {
  console.warn(
    '⚠️  Using anon key. This works only on a DB WITHOUT role-scoped RLS (pre-003). ' +
      'If 003_role_scoped_rls.sql is applied, add SUPABASE_SERVICE_ROLE_KEY to .env.local or seeding will fail.',
  );
}

// Service role must not try to persist/refresh a session.
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Reverse-dependency order for clearing ─────────────────────
// (leaf tables first, root tables last)
const CLEAR_ORDER = [
  'special_orders',
  'notifications',
  'sales_metrics',
  'referral_codes',
  'forecasts',
  'packaging_orders',
  'payments',
  'ending_inventories',
  'beginning_inventories',
  'deliveries',
  'applications',
  'stores',
  'users',
  'area_supervisors',
  'sub_partner_distributors',
  'distributors',
  'packaging_catalog',
  'skus',
  'plants',
];

// Most tables have a TEXT `id` PK we can filter on to "delete all"
// (Supabase requires a WHERE clause on delete). `sales_metrics` is the
// exception — it has a COMPOSITE PK (store_id, date, period) and NO `id`
// column, so filtering on `id` throws "column id does not exist". Map any
// such table to a column that actually exists.
const CLEAR_KEY_COLUMN: Record<string, string> = {
  sales_metrics: 'store_id',
};

async function clearAll(): Promise<void> {
  for (const table of CLEAR_ORDER) {
    const keyCol = CLEAR_KEY_COLUMN[table] ?? 'id';
    const { error } = await supabase.from(table).delete().neq(keyCol, '__NEVER_MATCHES__');
    // Only ignore "table does not exist" (a not-yet-migrated table is fine
    // to skip). Any other error — including a missing column or an FK
    // violation — must fail loud so a half-cleared DB isn't mistaken for a
    // clean one (which previously cascaded into duplicate-key seed errors).
    if (error && !error.message.includes('does not exist')) {
      console.error(`  ✗ ${table}: ${error.message}`);
      throw error;
    }
    console.log(`  ✓ cleared ${table}`);
  }
}

async function insert(table: string, rows: object[]): Promise<void> {
  if (rows.length === 0) {
    console.log(`  · ${table}: (no rows to seed)`);
    return;
  }
  // Cast to `never` because the supabase client is untyped here and its
  // generic .insert() signature is too strict for a dynamic table name.
  const { error } = await supabase.from(table).insert(rows as never);
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    throw error;
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

// ── Per-table mappers (camelCase TS → snake_case DB) ──────────

const mapPlant = (p: typeof plants[number]) => ({
  id: p.id,
  name: p.name,
  location: p.location,
  region: p.region,
  code: p.code,
});

const mapSku = (s: typeof skus[number]) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  dr_price: s.drPrice,
  srp_price: s.srpPrice,
  unit: s.unit,
});

const mapPackagingCatalog = (p: typeof packagingCatalog[number]) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  image_url: p.imageUrl ?? null,
  category: p.category,
});

const mapDistributor = (d: typeof distributors[number]) => ({
  id: d.id,
  name: d.name,
  contact_person: d.contactPerson,
  email: d.email,
  phone: d.phone,
  plant_id: d.plantId,
  referral_code: d.referralCode,
  assigned_area_ids: d.assignedAreaIds,
  status: d.status,
});

const mapSubPartnerDistributor = (s: typeof subPartnerDistributors[number]) => ({
  id: s.id,
  name: s.name,
  contact_person: s.contactPerson,
  email: s.email,
  phone: s.phone,
  parent_distributor_id: s.parentDistributorId,
  plant_id: s.plantId,
  assigned_store_ids: s.assignedStoreIds,
  status: s.status,
});

const mapAreaSupervisor = (a: typeof areaSupervisors[number]) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  phone: a.phone,
  assigned_areas: a.assignedAreas,
  plant_id: a.plantId,
  assigned_store_ids: a.assignedStoreIds,
});

const mapUser = (u: typeof users[number]) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  plant_id: u.plantId ?? null,
  distributor_id: u.distributorId ?? null,
  sub_partner_distributor_id: u.subPartnerDistributorId ?? null,
  area_ids: u.areaIds ?? null,
  assigned_store_ids: u.assignedStoreIds ?? null,
});

const mapStore = (s: typeof stores[number]) => ({
  id: s.id,
  name: s.name,
  business_name: s.businessName,
  owner_name: s.ownerName,
  address: s.address,
  lat: s.lat,
  lng: s.lng,
  plant_id: s.plantId,
  distributor_id: s.distributorId ?? null,
  sub_partner_distributor_id: s.subPartnerDistributorId ?? null,
  area_supervisor_id: s.areaSupervisorId,
  franchise_type: s.franchiseType,
  status: s.status,
  province: s.province,
  area: s.area,
  phone: s.phone,
  email: s.email,
  created_at: s.createdAt,
  delivery_status: s.deliveryStatus,
});

const mapApplication = (a: typeof applications[number]) => ({
  id: a.id,
  full_name: a.fullName,
  mobile: a.mobile,
  email: a.email,
  store_name: a.storeName,
  address: a.address,
  lat: a.lat,
  lng: a.lng,
  store_photo_url: a.storePhotoUrl,
  gov_id_url: a.govIdUrl,
  proof_of_billing_url: a.proofOfBillingUrl,
  referral_code: a.referralCode,
  referral_type: a.referralType,
  assigned_distributor_id: a.assignedDistributorId ?? null,
  assigned_area_supervisor_id: a.assignedAreaSupervisorId ?? null,
  assigned_plant_id: a.assignedPlantId,
  status: a.status,
  submitted_at: a.submittedAt,
  reviewed_by: a.reviewedBy ?? null,
  reviewed_at: a.reviewedAt ?? null,
  notes: a.notes ?? null,
  audit_log: a.auditLog,
});

const mapDelivery = (d: typeof deliveries[number]) => ({
  id: d.id,
  store_id: d.storeId,
  plant_id: d.plantId,
  date: d.date,
  status: d.status,
  dr_number: d.drNumber,
  items: d.items,
  total_dr_cost: d.totalDRCost,
  total_srp: d.totalSRP,
});

const mapBeginningInventory = (b: typeof beginningInventories[number]) => ({
  id: b.id,
  delivery_id: b.deliveryId,
  store_id: b.storeId,
  date: b.date,
  dr_image_url: b.drImageUrl,
  crate_image_urls: b.crateImageUrls,
  ai_results: b.aiResults,
  confirmed_items: b.confirmedItems,
  status: b.status,
  notes: b.notes ?? null,
});

const mapEndingInventory = (e: typeof endingInventories[number]) => ({
  id: e.id,
  delivery_id: e.deliveryId,
  store_id: e.storeId,
  date: e.date,
  crate_image_urls: e.crateImageUrls,
  unsold_items: e.unsoldItems,
  ai_results: e.aiResults,
  status: e.status,
  notes: e.notes ?? null,
  submitted_at: e.submittedAt ?? null,
  original_unsold_items: e.originalUnsoldItems ?? null,
  revisions: e.revisions ?? null,
  reviewed_by: e.reviewedBy ?? null,
  reviewed_at: e.reviewedAt ?? null,
});

const mapPayment = (p: typeof payments[number]) => ({
  id: p.id,
  billing_id: p.billingId,
  store_id: p.storeId,
  amount: p.amount,
  method: p.method,
  reference_number: p.referenceNumber,
  date_paid: p.datePaid,
  proof_url: p.proofUrl ?? null,
  status: p.status,
  verified_by: p.verifiedBy ?? null,
  rejected_reason: p.rejectedReason ?? null,
  submitted_at: p.submittedAt,
});

const mapPackagingOrder = (p: typeof packagingOrders[number]) => ({
  id: p.id,
  store_id: p.storeId,
  items: p.items,
  total_amount: p.totalAmount,
  status: p.status,
  ordered_at: p.orderedAt,
  delivery_id: p.deliveryId ?? null,
});

const mapForecast = (f: typeof forecasts[number]) => ({
  id: f.id,
  store_id: f.storeId,
  date: f.date,
  items: f.items,
  created_by: f.createdBy,
  status: f.status,
});

const mapReferralCode = (r: typeof referralCodes[number]) => ({
  id: r.id,
  code: r.code,
  type: r.type,
  distributor_id: r.distributorId ?? null,
  area_supervisor_id: r.areaSupervisorId ?? null,
  plant_id: r.plantId,
  status: r.status,
  created_at: r.createdAt,
  usage_count: r.usageCount,
});

const mapSalesMetric = (m: typeof salesMetrics[number]) => ({
  store_id: m.storeId,
  store_name: m.storeName,
  area: m.area,
  province: m.province,
  plant_id: m.plantId,
  distributor_id: m.distributorId ?? null,
  dr_sales: m.drSales,
  srp_sales: m.srpSales,
  period: m.period,
  date: m.date,
});

const mapNotification = (n: typeof notifications[number]) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  read: n.read,
  created_at: n.createdAt,
  target_role: n.targetRole ?? null,
  target_store_id: n.targetStoreId ?? null,
});

const mapSpecialOrder = (s: typeof specialOrders[number]) => ({
  id: s.id,
  store_id: s.storeId,
  date: s.date,
  items: s.items,
  total_dr: s.totalDR,
  total_srp: s.totalSRP,
  status: s.status,
  notes: s.notes ?? null,
  created_at: s.createdAt,
});

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('▶ Clearing existing rows...');
  await clearAll();

  console.log('\n▶ Seeding...');
  await insert('plants', plants.map(mapPlant));
  await insert('skus', skus.map(mapSku));
  await insert('packaging_catalog', packagingCatalog.map(mapPackagingCatalog));
  await insert('distributors', distributors.map(mapDistributor));
  await insert('sub_partner_distributors', subPartnerDistributors.map(mapSubPartnerDistributor));
  await insert('area_supervisors', areaSupervisors.map(mapAreaSupervisor));
  await insert('users', users.map(mapUser));
  await insert('stores', stores.map(mapStore));
  await insert('applications', applications.map(mapApplication));
  await insert('deliveries', deliveries.map(mapDelivery));
  await insert('beginning_inventories', beginningInventories.map(mapBeginningInventory));
  await insert('ending_inventories', endingInventories.map(mapEndingInventory));
  await insert('payments', payments.map(mapPayment));
  await insert('packaging_orders', packagingOrders.map(mapPackagingOrder));
  await insert('forecasts', forecasts.map(mapForecast));
  await insert('referral_codes', referralCodes.map(mapReferralCode));
  await insert('sales_metrics', salesMetrics.map(mapSalesMetric));
  await insert('notifications', notifications.map(mapNotification));
  await insert('special_orders', specialOrders.map(mapSpecialOrder));

  console.log('\n✅ Seed complete.');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
