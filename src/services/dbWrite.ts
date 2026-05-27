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
import type { Store, Application } from '@/types';

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
