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
  Distributor,
  SubPartnerDistributor,
  AreaSupervisor,
  User,
  BillingRevision,
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
  delivery_schedule: s.deliverySchedule ?? null,
  opening_date: s.openingDate ?? null,
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
  sub_partner_distributor_id: r.subPartnerDistributorId ?? null,
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
  type: p.type ?? 'billing',
  reference_number: p.referenceNumber,
  date_paid: p.datePaid,
  proof_url: p.proofUrl ?? null,
  status: p.status,
  collected_by: p.collectedBy ?? null,
  collected_at: p.collectedAt ?? null,
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

const mapBillingRevisionToDB = (r: BillingRevision) => ({
  id: r.id,
  delivery_id: r.deliveryId,
  store_id: r.storeId,
  requested_by: r.requestedBy,
  requested_at: r.requestedAt,
  reason: r.reason,
  // JSONB columns — pass the arrays through; inner camelCase keys (skuId,
  // skuName, quantity) are stored verbatim and read back as-is.
  corrected_beginning: r.correctedBeginning,
  corrected_ending: r.correctedEnding,
  status: r.status,
  additional_amount: r.additionalAmount ?? 0,
  dispute_note: r.disputeNote ?? null,
  disputed_at: r.disputedAt ?? null,
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
  address: a.address,
  lat: a.lat,
  lng: a.lng,
  store_photo_url: a.storePhotoUrl,
  gov_id_url: a.govIdUrl,
  proof_of_billing_url: a.proofOfBillingUrl,
  referral_code: a.referralCode,
  referral_type: a.referralType,
  assigned_distributor_id: a.assignedDistributorId ?? null,
  assigned_sub_partner_distributor_id: a.assignedSubPartnerDistributorId ?? null,
  assigned_area_supervisor_id: a.assignedAreaSupervisorId ?? null,
  assigned_plant_id: a.assignedPlantId,
  shop_code: a.shopCode ?? null,
  delivery_schedule: a.deliverySchedule ?? null,
  opening_date: a.openingDate ?? null,
  terms_accepted_at: a.termsAcceptedAt ?? null,
  // Self-service onboarding (/onboarding) fields — Phase 1.
  first_name: a.firstName ?? null,
  middle_name: a.middleName ?? null,
  last_name: a.lastName ?? null,
  suffix: a.suffix ?? null,
  residential_address: a.residentialAddress ?? null,
  facebook_link: a.facebookLink ?? null,
  operating_hours: a.operatingHours ?? null,
  selfie_url: a.selfieUrl ?? null,
  accepted_consignment_at: a.acceptedConsignmentAt ?? null,
  accepted_privacy_at: a.acceptedPrivacyAt ?? null,
  accepted_terms_at: a.acceptedTermsAt ?? null,
  certified_at: a.certifiedAt ?? null,
  agreement_version: a.agreementVersion ?? null,
  application_number: a.applicationNumber ?? null,
  // Phase 3 — ID OCR autofill (editable).
  id_scanned_name: a.idScannedName ?? null,
  id_number: a.idNumber ?? null,
  // Phase 2 — submission provenance metadata + PDF copy.
  submitted_ip: a.submittedIp ?? null,
  user_agent: a.userAgent ?? null,
  device_info: a.deviceInfo ?? null,
  gps_lat: a.gpsLat ?? null,
  gps_lng: a.gpsLng ?? null,
  pdf_url: a.pdfUrl ?? null,
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

export async function insertBillingRevision(rev: BillingRevision): Promise<void> {
  const { error } = await supabase
    .from('billing_revisions')
    .insert(mapBillingRevisionToDB(rev) as never);
  if (error) throw error;
}

export async function updateBillingRevision(rev: BillingRevision): Promise<void> {
  const { error } = await supabase
    .from('billing_revisions')
    .update(mapBillingRevisionToDB(rev) as never)
    .eq('id', rev.id);
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

// ── Org entities + user profiles (Account Creation) ──────────
// Written by the "New Account" flow. Reference tables — owner/ops write via the
// admin RLS policy; PD writes SPD/AS within scope (migration 011).

const mapDistributorToDB = (d: Distributor) => ({
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

const mapSubPartnerDistributorToDB = (s: SubPartnerDistributor) => ({
  id: s.id,
  name: s.name,
  contact_person: s.contactPerson,
  email: s.email,
  phone: s.phone,
  parent_distributor_id: s.parentDistributorId,
  plant_id: s.plantId,
  assigned_store_ids: s.assignedStoreIds,
  status: s.status,
  referral_code: s.referralCode ?? null,
});

const mapAreaSupervisorToDB = (a: AreaSupervisor) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  phone: a.phone,
  assigned_areas: a.assignedAreas,
  plant_id: a.plantId,
  assigned_store_ids: a.assignedStoreIds,
});

const mapUserToDB = (u: User) => ({
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

export async function insertDistributor(d: Distributor): Promise<void> {
  const { error } = await supabase.from('distributors').insert(mapDistributorToDB(d) as never);
  if (error) throw error;
}

export async function insertSubPartnerDistributor(s: SubPartnerDistributor): Promise<void> {
  const { error } = await supabase
    .from('sub_partner_distributors')
    .insert(mapSubPartnerDistributorToDB(s) as never);
  if (error) throw error;
}

export async function insertAreaSupervisor(a: AreaSupervisor): Promise<void> {
  const { error } = await supabase
    .from('area_supervisors')
    .insert(mapAreaSupervisorToDB(a) as never);
  if (error) throw error;
}

export async function insertUser(u: User): Promise<void> {
  const { error } = await supabase.from('users').insert(mapUserToDB(u) as never);
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
