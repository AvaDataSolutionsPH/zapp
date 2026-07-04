// ============================================================
// ZAPP Donuts ERP - Supabase Write Layer (Phase 2B)
// ============================================================
//
// Insert / update wrappers that mirror src/services/db.ts on the
// write direction. Each helper accepts a TypeScript object
// (camelCase) and writes the equivalent snake_case row to Supabase.
//
// Used by useStore actions to persist mutations alongside the
// optimistic in-memory update.

import { supabase } from '@/lib/supabase';
import type {
  Store,
  Application,
  Delivery,
  BeginningInventory,
  EndingInventory,
  Payment,
  PackagingOrder,
  Forecast,
  ReferralCode,
  SpecialOrder,
  Notification,
} from '@/types';

// ── Mappers (TS camelCase → DB snake_case) ────────────────────
// Kept duplicate of scripts/seed-from-mock.ts mappers on purpose:
// the seed script runs under Node (tsx) and this module runs in
// the browser. Keeping them separate avoids pulling Node-only
// imports into the client bundle.

const mapStoreToDB = (s: Store) => ({
  id: s.id,
  name: s.name,
  business_name: s.businessName,
  owner_name: s.ownerName,
  address: s.address,
  lat: s.lat,
  lng: s.lng,
  shop_code: s.shopCode ?? null,
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

const mapPackagingOrderToDB = (p: PackagingOrder) => ({
  id: p.id,
  store_id: p.storeId,
  items: p.items,
  total_amount: p.totalAmount,
  status: p.status,
  ordered_at: p.orderedAt,
  delivery_id: p.deliveryId ?? null,
});

const mapForecastToDB = (f: Forecast) => ({
  id: f.id,
  store_id: f.storeId,
  date: f.date,
  items: f.items,
  created_by: f.createdBy,
  status: f.status,
});

const mapReferralCodeToDB = (r: ReferralCode) => ({
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

const mapSpecialOrderToDB = (s: SpecialOrder) => ({
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

const mapNotificationToDB = (n: Notification) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  read: n.read,
  created_at: n.createdAt,
  target_role: n.targetRole ?? null,
  target_store_id: n.targetStoreId ?? null,
});

const mapPaymentToDB = (p: Payment) => ({
  id: p.id,
  // billing_id is plain TEXT (no FK) because billings are computed
  // client-side and don't exist as a DB table — see Phase 2A schema.
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

const mapBeginningInventoryToDB = (b: BeginningInventory) => ({
  id: b.id,
  delivery_id: b.deliveryId,
  store_id: b.storeId,
  date: b.date,
  dr_image_url: b.drImageUrl,
  // TEXT[] column — pass array through.
  crate_image_urls: b.crateImageUrls,
  // JSONB columns — nested camelCase keys stored as-is.
  ai_results: b.aiResults,
  confirmed_items: b.confirmedItems,
  status: b.status,
  notes: b.notes ?? null,
});

const mapEndingInventoryToDB = (e: EndingInventory) => ({
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

const mapDeliveryToDB = (d: Delivery) => ({
  id: d.id,
  store_id: d.storeId,
  plant_id: d.plantId,
  date: d.date,
  status: d.status,
  dr_number: d.drNumber,
  // JSONB column — pass the items array straight through; nested
  // camelCase keys (skuId, drPrice, etc.) are stored verbatim and
  // read back the same way by transformRow in db.ts (it only touches
  // top-level keys).
  items: d.items,
  total_dr_cost: d.totalDRCost,
  total_srp: d.totalSRP,
});

const mapApplicationToDB = (a: Application) => ({
  id: a.id,
  full_name: a.fullName,
  mobile: a.mobile,
  email: a.email,
  store_name: a.storeName,
  shop_code: a.shopCode ?? null,
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

// ── Writers ───────────────────────────────────────────────────
// Each writer throws on error so the caller can roll back the
// optimistic in-memory state. The supabase client's generic
// .insert()/.update() signature is too strict for a dynamic row
// shape, so we cast through `never` (same pattern as the seed
// script).

export async function insertStore(store: Store): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .insert(mapStoreToDB(store) as never);
  if (error) throw error;
}

export async function insertApplication(app: Application): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .insert(mapApplicationToDB(app) as never);
  if (error) throw error;
}

export async function updateApplication(app: Application): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update(mapApplicationToDB(app) as never)
    .eq('id', app.id);
  if (error) throw error;
}

export async function insertDelivery(delivery: Delivery): Promise<void> {
  const { error } = await supabase
    .from('deliveries')
    .insert(mapDeliveryToDB(delivery) as never);
  if (error) throw error;
}

export async function updateDelivery(delivery: Delivery): Promise<void> {
  const { error } = await supabase
    .from('deliveries')
    .update(mapDeliveryToDB(delivery) as never)
    .eq('id', delivery.id);
  if (error) throw error;
}

export async function insertBeginningInventory(bi: BeginningInventory): Promise<void> {
  const { error } = await supabase
    .from('beginning_inventories')
    .insert(mapBeginningInventoryToDB(bi) as never);
  if (error) throw error;
}

export async function updateBeginningInventory(bi: BeginningInventory): Promise<void> {
  const { error } = await supabase
    .from('beginning_inventories')
    .update(mapBeginningInventoryToDB(bi) as never)
    .eq('id', bi.id);
  if (error) throw error;
}

export async function insertEndingInventory(ei: EndingInventory): Promise<void> {
  const { error } = await supabase
    .from('ending_inventories')
    .insert(mapEndingInventoryToDB(ei) as never);
  if (error) throw error;
}

export async function updateEndingInventory(ei: EndingInventory): Promise<void> {
  const { error } = await supabase
    .from('ending_inventories')
    .update(mapEndingInventoryToDB(ei) as never)
    .eq('id', ei.id);
  if (error) throw error;
}

export async function insertPayment(payment: Payment): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .insert(mapPaymentToDB(payment) as never);
  if (error) throw error;
}

export async function updatePayment(payment: Payment): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update(mapPaymentToDB(payment) as never)
    .eq('id', payment.id);
  if (error) throw error;
}

export async function updateStore(store: Store): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .update(mapStoreToDB(store) as never)
    .eq('id', store.id);
  if (error) throw error;
}

export async function insertPackagingOrder(po: PackagingOrder): Promise<void> {
  const { error } = await supabase
    .from('packaging_orders')
    .insert(mapPackagingOrderToDB(po) as never);
  if (error) throw error;
}

// Forecasts use upsert because saveForecast can both create a brand
// new forecast or revise an existing one for the same store/date.
export async function upsertForecast(f: Forecast): Promise<void> {
  const { error } = await supabase
    .from('forecasts')
    .upsert(mapForecastToDB(f) as never);
  if (error) throw error;
}

export async function insertReferralCode(r: ReferralCode): Promise<void> {
  const { error } = await supabase
    .from('referral_codes')
    .insert(mapReferralCodeToDB(r) as never);
  if (error) throw error;
}

export async function insertSpecialOrder(s: SpecialOrder): Promise<void> {
  const { error } = await supabase
    .from('special_orders')
    .insert(mapSpecialOrderToDB(s) as never);
  if (error) throw error;
}

export async function insertNotification(n: Notification): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert(mapNotificationToDB(n) as never);
  if (error) throw error;
}

export async function updateNotification(n: Notification): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update(mapNotificationToDB(n) as never)
    .eq('id', n.id);
  if (error) throw error;
}
