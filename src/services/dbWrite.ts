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
  AuditEntry,
  Plant,
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
  SKU,
  PackagingItem,
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
  application_source: a.applicationSource ?? null,
  // "Endorsed to others" (048).
  endorsed_by_distributor_id: a.endorsedByDistributorId ?? null,
  endorsed_to_distributor_id: a.endorsedToDistributorId ?? null,
  endorsed_to_sub_partner_distributor_id: a.endorsedToSubPartnerDistributorId ?? null,
  endorsement_status: a.endorsementStatus ?? null,
  endorsed_at: a.endorsedAt ?? null,
  endorsement_resolved_at: a.endorsementResolvedAt ?? null,
  endorsement_note: a.endorsementNote ?? null,
  endorsement_decline_reason: a.endorsementDeclineReason ?? null,
  // Phase 3 — ID OCR autofill (editable).
  id_scanned_name: a.idScannedName ?? null,
  id_number: a.idNumber ?? null,
  // Login this application generated on approval (024).
  account_user_id: a.accountUserId ?? null,
  // Per-document staff verification (026). JSONB — inner camelCase kept as-is.
  document_reviews: a.documentReviews ?? {},
  // New Application Monitoring (migration 021) — form-filled.
  province: a.province ?? null,
  location: a.location ?? null,
  operating_days: a.operatingDays ?? null,
  // ...PD/SD-filled during evaluation.
  google_maps_picture_url: a.googleMapsPictureUrl ?? null,
  google_maps_link: a.googleMapsLink ?? null,
  // JSONB array of option keys (migration 030); passed through verbatim.
  market_source: a.marketSource ?? null,
  market_source_other: a.marketSourceOther ?? null,
  remarks_pd_sd: a.remarksPdSd ?? null,
  // ...AS/OS-filled during evaluation.
  comparable: a.comparable ?? null,
  ads: a.ads ?? null,
  rtc: a.rtc ?? null,
  remarks_as: a.remarksAs ?? null,
  remarks_os: a.remarksOs ?? null,
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

/**
 * Throw when an UPDATE changed NOTHING.
 *
 * ⚠️ A row-level-security denial is NOT an error. When a policy's USING clause
 * excludes the row, Postgres updates ZERO rows and PostgREST answers 204 with
 * `error: null` — so `if (error) throw error` passes, the optimistic UI keeps the
 * change, the success toast fires, and the edit silently disappears on the next
 * hydration. Migration 035 documents exactly this: verifying the last document
 * flipped the account to active while the store stayed 'pending' forever,
 * because the UPDATE "matched zero rows and reported no error".
 *
 * Every update therefore asks for the affected ids back and treats an empty
 * result as a failure, letting the caller's existing rollback + error toast do
 * their job. Safe because SELECT is at least as permissive as UPDATE everywhere
 * in this schema: reference tables are `ref_select USING (true)`, and
 * store-scoped tables share one scope between their select and write policies.
 */
function assertRowChanged(data: unknown, table: string): void {
  if (Array.isArray(data) && data.length > 0) return;
  throw new Error(
    `Walang na-save sa "${table}" — 0 rows updated. Malamang walang permiso ang account mo para sa record na ito, o wala na ito.`,
  );
}

export async function updateApplication(app: Application): Promise<void> {
  const { data, error } = await supabase
    .from('applications')
    .update(mapApplicationToDB(app) as never)
    .eq('id', app.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'applications');
}

/**
 * Reserve the next application reference number (migration 036).
 *
 * A sequence rather than max()+1 in the client: /apply is public, so two people
 * submitting at the same moment would otherwise be handed the same number.
 *
 * Best-effort by design — returns null instead of throwing. The BEFORE INSERT
 * trigger assigns a number regardless, so the only cost of a failure here is
 * that the applicant does not see their number until the next hydration. That
 * must never be a reason to reject their application.
 */
export async function reserveApplicationNumber(): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_application_number');
  if (error) {
    console.warn('[dbWrite] could not reserve an application number:', error.message);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

/**
 * Update ONLY the named columns of an application. Takes snake_case DB keys —
 * it is a targeted patch, not a mapped entity write.
 *
 * Use this instead of `updateApplication` whenever the caller changes a couple
 * of known columns. `updateApplication` re-sends EVERY column from the caller's
 * in-memory copy, so any column that changed in the DB since that copy was
 * hydrated is silently reverted. That is not theoretical: a franchisee hit it in
 * production. `recordLogin` appends a `first_login` entry AFTER hydration, so
 * their slice is stale seconds after signing in; submitting verification
 * documents then re-sent the pre-login audit_log and migration 025's
 * append-only trigger rejected the whole write with a bare error. The documents
 * uploaded to Storage, nothing saved, and it looked like the upload had failed.
 *
 * Pair this with `appendApplicationAudit` for the history entry.
 */
/**
 * Answer an endorsement (049). Goes through an RPC rather than a direct UPDATE
 * because a row-level predicate cannot express a STATE TRANSITION.
 *
 * ⚠️ DECLINE is the reason this exists. Declining changes no assignment, so the
 * recipient is writing a row that is not and never was theirs; 048's policy
 * refused it ("new row violates row-level security policy") while ACCEPT only
 * appeared to work because it sets the assignment to the recipient and so
 * satisfied 003 on its own.
 *
 * The audit entry is passed IN and appended inside the same statement: on
 * decline the row stays with the sender, so a follow-up append from the client
 * would be dropped by RLS and the decline would vanish from the history.
 */
export async function respondToEndorsementRpc(
  applicationId: string,
  accept: boolean,
  entry: unknown,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_endorsement', {
    p_application_id: applicationId,
    p_accept: accept,
    p_entry: entry,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function updateApplicationFields(
  applicationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase
    .from('applications')
    .update(patch as never)
    .eq('id', applicationId)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'applications');
}

/**
 * Persist only what actually CHANGED between two versions of an application.
 *
 * Diffing happens on the mapped DB rows, so callers pass plain TS objects and
 * never need to know column names. `audit_log` is always excluded — history is
 * appended through `appendApplicationAudit`, never rewritten wholesale.
 *
 * Returns the columns it wrote, which is useful in a log when a save looks like
 * it did nothing.
 */
/**
 * Open a franchisee's store the moment their account activates.
 *
 * Targets the row by shop_code instead of taking a Store object, because the
 * caller (an Area Supervisor verifying documents) may not have the store in
 * memory at all — RLS decides what they hydrated, and their scope was empty
 * until migration 035. Relying on the client slice meant the update silently
 * never ran.
 *
 * Still subject to RLS: a caller who cannot update the row matches zero rows
 * and gets no error, which is why 035 has to land for an AS to activate.
 */
export async function activateStoreByShopCode(shopCode: string): Promise<void> {
  const { data, error } = await supabase
    .from('stores')
    .update({ status: 'active' } as never)
    .eq('shop_code', shopCode)
    .neq('status', 'active')
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'stores');
}

export async function updateApplicationChanges(
  before: Application,
  after: Application,
): Promise<string[]> {
  const mappedBefore = mapApplicationToDB(before) as Record<string, unknown>;
  const mappedAfter = mapApplicationToDB(after) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const column of Object.keys(mappedAfter)) {
    if (column === 'audit_log' || column === 'id') continue;
    // JSON compare so JSONB columns (items, market_source, …) are compared by
    // value rather than by reference.
    if (JSON.stringify(mappedAfter[column]) !== JSON.stringify(mappedBefore[column])) {
      patch[column] = mappedAfter[column];
    }
  }

  const columns = Object.keys(patch);
  if (columns.length) await updateApplicationFields(after.id, patch);
  return columns;
}

/**
 * Append ONE entry to an application's Transaction History (migration 028).
 *
 * Not `updateApplication` with a longer array: that sends the caller's whole
 * copy, so a stale slice silently deletes entries — and the slice goes stale
 * routinely, because hydrateFromDB re-runs on every SIGNED_IN / TOKEN_REFRESHED
 * and can land after an append. The RPC does `audit_log || entry` against the
 * CURRENT row in one statement, so it cannot drop anything.
 *
 * RLS still applies (the function is SECURITY INVOKER) — this is an operation,
 * not a privilege.
 */
export async function appendApplicationAudit(
  applicationId: string,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.rpc('append_application_audit', {
    p_app_id: applicationId,
    p_entry: entry as never,
  });
  if (error) throw error;
}

export async function insertDelivery(delivery: Delivery): Promise<void> {
  const { error } = await supabase
    .from('deliveries')
    .insert(mapDeliveryToDB(delivery) as never);
  if (error) throw error;
}

export async function updateDelivery(delivery: Delivery): Promise<void> {
  const { data, error } = await supabase
    .from('deliveries')
    .update(mapDeliveryToDB(delivery) as never)
    .eq('id', delivery.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'deliveries');
}

export async function insertBeginningInventory(bi: BeginningInventory): Promise<void> {
  const { error } = await supabase
    .from('beginning_inventories')
    .insert(mapBeginningInventoryToDB(bi) as never);
  if (error) throw error;
}

export async function updateBeginningInventory(bi: BeginningInventory): Promise<void> {
  const { data, error } = await supabase
    .from('beginning_inventories')
    .update(mapBeginningInventoryToDB(bi) as never)
    .eq('id', bi.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'beginning_inventories');
}

export async function insertEndingInventory(ei: EndingInventory): Promise<void> {
  const { error } = await supabase
    .from('ending_inventories')
    .insert(mapEndingInventoryToDB(ei) as never);
  if (error) throw error;
}

export async function updateEndingInventory(ei: EndingInventory): Promise<void> {
  const { data, error } = await supabase
    .from('ending_inventories')
    .update(mapEndingInventoryToDB(ei) as never)
    .eq('id', ei.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'ending_inventories');
}

export async function insertBillingRevision(rev: BillingRevision): Promise<void> {
  const { error } = await supabase
    .from('billing_revisions')
    .insert(mapBillingRevisionToDB(rev) as never);
  if (error) throw error;
}

export async function updateBillingRevision(rev: BillingRevision): Promise<void> {
  const { data, error } = await supabase
    .from('billing_revisions')
    .update(mapBillingRevisionToDB(rev) as never)
    .eq('id', rev.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'billing_revisions');
}

export async function insertPayment(payment: Payment): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .insert(mapPaymentToDB(payment) as never);
  if (error) throw error;
}

export async function updatePayment(payment: Payment): Promise<void> {
  const { data, error } = await supabase
    .from('payments')
    .update(mapPaymentToDB(payment) as never)
    .eq('id', payment.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'payments');
}

export async function updateStore(store: Store): Promise<void> {
  const { data, error } = await supabase
    .from('stores')
    .update(mapStoreToDB(store) as never)
    .eq('id', store.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'stores');
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
  // migration 042 — every plant served; null means "only plant_id".
  plant_ids: d.plantIds ?? null,
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
  // migration 043 — every plant served; null means "only plant_id".
  plant_ids: s.plantIds ?? null,
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
  // migration 043 — every plant covered; null means "only plant_id".
  plant_ids: a.plantIds ?? null,
  assigned_store_ids: a.assignedStoreIds,
  // Province master list (023) — the column is NOT NULL DEFAULT '{}', so coerce
  // undefined to an empty array rather than null.
  assigned_provinces: a.assignedProvinces ?? [],
});

const mapUserToDB = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  plant_id: u.plantId ?? null,
  // Multi-plant coverage for Billing (031). Empty = all plants, not none.
  plant_ids: u.plantIds ?? null,
  distributor_id: u.distributorId ?? null,
  sub_partner_distributor_id: u.subPartnerDistributorId ?? null,
  area_ids: u.areaIds ?? null,
  assigned_store_ids: u.assignedStoreIds ?? null,
  // Activation gate (024). null = not applicable (staff / pre-024 franchisees).
  account_status: u.accountStatus ?? null,
  password_changed_at: u.passwordChangedAt ?? null,
  // Login audit (027). Self-updatable — 027 widened the guard trigger's clamp.
  last_login_at: u.lastLoginAt ?? null,
});

export async function insertDistributor(d: Distributor): Promise<void> {
  const { error } = await supabase.from('distributors').insert(mapDistributorToDB(d) as never);
  if (error) throw error;
}

export async function updateDistributor(d: Distributor): Promise<void> {
  const { data, error } = await supabase
    .from('distributors')
    .update(mapDistributorToDB(d) as never)
    .eq('id', d.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'distributors');
}

// Plants are reference data — admin-only writes (003 ref_write). Editable so a
// typo in a plant's name/code/region can be corrected without a redeploy.
const mapPlantToDB = (p: Plant) => ({
  id: p.id,
  name: p.name,
  location: p.location,
  region: p.region,
  code: p.code,
});

// ── SKUs (donut catalog) ──────────────────────────────────────
//
// `skus` is a REFERENCE table: 003's `ref_write` already restricts writes to
// app_is_admin() (owner + operations_manager), so no migration was needed to
// open this up — only the client helpers were missing.
//
// ⚠️ `id` is the DR/SAP product code and is referenced by every delivery,
// inventory, forecast and special-order line ever written. `updateSku` keys on
// it and never changes it; the form makes it read-only after creation. Changing
// a code would orphan every historical record that quotes it.

// `sort_order` is intentionally NOT written here. It is set only by
// `updateSkuOrder`, so an ordinary name/price/code edit does not touch it and
// therefore does not require migration 039 — only the reorder action does.
const mapSkuToDB = (s: SKU) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  dr_price: s.drPrice,
  srp_price: s.srpPrice,
  unit: s.unit,
});

export async function insertSku(s: SKU): Promise<void> {
  const { error } = await supabase.from('skus').insert(mapSkuToDB(s) as never);
  if (error) throw error;
}

/**
 * Update a SKU. `matchId` is the row's CURRENT primary key; pass it whenever the
 * product code (`s.id`) itself is being changed, so the WHERE clause still finds
 * the row while the SET rewrites its id. There is no FK on `skus.id`, so a
 * primary-key change is DB-legal — past JSONB line items keep the old code as a
 * snapshot (not retroactive, like prices). Defaults to `s.id` for the common
 * case where the code is unchanged.
 */
export async function updateSku(s: SKU, matchId: string = s.id): Promise<void> {
  const { data, error } = await supabase
    .from('skus')
    .update(mapSkuToDB(s) as never)
    .eq('id', matchId)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'skus');
}

/** Persist only a SKU's display order (migration 039). */
export async function updateSkuOrder(id: string, sortOrder: number): Promise<void> {
  const { data, error } = await supabase
    .from('skus')
    .update({ sort_order: sortOrder } as never)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'skus');
}

// ── Packaging catalog ─────────────────────────────────────────
//
// Same shape as the SKU helpers: `packaging_catalog` is a reference table, so
// 003's `ref_write` covers owner + operations_manager and migration 037 adds
// the Area Supervisor.
//
// ⚠️ `id` is referenced by every packaging_orders line ever written, so
// `updatePackagingItem` keys on it and never changes it.

const mapPackagingItemToDB = (p: PackagingItem) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  image_url: p.imageUrl ?? null,
  category: p.category,
});

export async function insertPackagingItem(p: PackagingItem): Promise<void> {
  const { error } = await supabase
    .from('packaging_catalog')
    .insert(mapPackagingItemToDB(p) as never);
  if (error) throw error;
}

export async function updatePackagingItem(p: PackagingItem): Promise<void> {
  const { data, error } = await supabase
    .from('packaging_catalog')
    .update(mapPackagingItemToDB(p) as never)
    .eq('id', p.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'packaging_catalog');
}

export async function insertPlant(p: Plant): Promise<void> {
  const { error } = await supabase.from('plants').insert(mapPlantToDB(p) as never);
  if (error) throw error;
}

export async function updatePlant(p: Plant): Promise<void> {
  const { data, error } = await supabase
    .from('plants')
    .update(mapPlantToDB(p) as never)
    .eq('id', p.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'plants');
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

export async function updateAreaSupervisor(a: AreaSupervisor): Promise<void> {
  const { data, error } = await supabase
    .from('area_supervisors')
    .update(mapAreaSupervisorToDB(a) as never)
    .eq('id', a.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'area_supervisors');
}

export async function insertUser(u: User): Promise<void> {
  const { error } = await supabase.from('users').insert(mapUserToDB(u) as never);
  if (error) throw error;
}

export async function updateUser(u: User): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .update(mapUserToDB(u) as never)
    .eq('id', u.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'users');
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
  const { data, error } = await supabase
    .from('notifications')
    .update(mapNotificationToDB(n) as never)
    .eq('id', n.id)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'notifications');
}

// ── Referral / channel codes ──────────────────────────────────
//
// A code is safe to rename ONLY while nothing points at it. `usage_count` is
// NOT the answer — nothing in the app ever increments it, so it reads 0 for
// every code ever created. The real test is whether any application carries the
// string, because that is the link that would break.

/** Is this code already taken by ANOTHER code row? */
export async function isReferralCodeTaken(code: string, exceptId?: string): Promise<boolean> {
  let q = supabase.from('referral_codes').select('id').eq('code', code);
  if (exceptId) q = q.neq('id', exceptId);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** How many applications were filed under this code. 0 = safe to rename. */
export async function countApplicationsUsingReferralCode(code: string): Promise<number> {
  const { count, error } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('referral_code', code);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Rename a code in BOTH places it is stored.
 *
 * `referral_codes.code` is the record; `distributors.referral_code` /
 * `sub_partner_distributors.referral_code` are denormalised copies shown in the
 * UI. Updating one without the other leaves them silently disagreeing — the
 * table would show one code while `/apply` accepted a different one.
 */
export async function renameReferralCode(input: {
  codeRowId: string;
  newCode: string;
  distributorId?: string;
  subPartnerDistributorId?: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from('referral_codes')
    .update({ code: input.newCode } as never)
    .eq('id', input.codeRowId)
    .select('id');
  if (error) throw error;
  assertRowChanged(data, 'referral_codes');

  if (input.distributorId) {
    const { data: d, error: e } = await supabase
      .from('distributors')
      .update({ referral_code: input.newCode } as never)
      .eq('id', input.distributorId)
      .select('id');
    if (e) throw e;
    assertRowChanged(d, 'distributors');
  }
  if (input.subPartnerDistributorId) {
    const { data: s, error: e } = await supabase
      .from('sub_partner_distributors')
      .update({ referral_code: input.newCode } as never)
      .eq('id', input.subPartnerDistributorId)
      .select('id');
    if (e) throw e;
    assertRowChanged(s, 'sub_partner_distributors');
  }
}
