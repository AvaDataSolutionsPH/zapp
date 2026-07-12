// ============================================================
// ZAPP Donuts ERP - Supabase Database Service (Phase 2A)
// ============================================================
//
// Read-only query layer for the entity tables created by
// supabase/migrations/001_create_tables.sql. Each fetchX function
// returns data already transformed from snake_case (DB) to camelCase
// (TypeScript) so callers can drop the result straight into Zustand.
//
// JSONB columns (items, auditLog, aiResults, revisions, etc.) are
// stored with camelCase keys intact, so only the TOP-LEVEL row keys
// need transformation. Null values are stripped so optional TS fields
// (notes?: string) come back as undefined, not null.
//
// Phase 2B will add insert/update wrappers. Phase 3 will scope reads
// to the current user's role via stricter RLS policies.

import { supabase } from '@/lib/supabase';
import type {
  Plant,
  SKU,
  PackagingItem,
  Distributor,
  SubPartnerDistributor,
  AreaSupervisor,
  User,
  Store,
  Application,
  Delivery,
  BeginningInventory,
  EndingInventory,
  Payment,
  PackagingOrder,
  Forecast,
  ReferralCode,
  SalesMetric,
  Notification,
  SpecialOrder,
} from '@/types';

// ── Transform helpers ─────────────────────────────────────────

// Field-level overrides for DB column → TS field where the legacy
// TS naming uses non-standard casing (e.g. uppercase "DR"/"SRP" in
// the middle of an identifier). Stay surgical here — only add an
// entry when the auto-converter produces the wrong key.
const FIELD_OVERRIDES: Record<string, string> = {
  total_dr_cost: 'totalDRCost',
  total_dr: 'totalDR',
  total_srp: 'totalSRP',
};

function snakeToCamel(key: string): string {
  if (FIELD_OVERRIDES[key]) return FIELD_OVERRIDES[key];
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function transformRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    result[snakeToCamel(k)] = v;
  }
  return result as T;
}

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data ?? []).map((row) => transformRow<T>(row as Record<string, unknown>));
}

// ── Per-entity fetchers ───────────────────────────────────────

export const fetchPlants = (): Promise<Plant[]> => fetchAll<Plant>('plants');
export const fetchSkus = (): Promise<SKU[]> => fetchAll<SKU>('skus');
export const fetchPackagingCatalog = (): Promise<PackagingItem[]> =>
  fetchAll<PackagingItem>('packaging_catalog');

export const fetchDistributors = (): Promise<Distributor[]> =>
  fetchAll<Distributor>('distributors');
export const fetchSubPartnerDistributors = (): Promise<SubPartnerDistributor[]> =>
  fetchAll<SubPartnerDistributor>('sub_partner_distributors');
export const fetchAreaSupervisors = (): Promise<AreaSupervisor[]> =>
  fetchAll<AreaSupervisor>('area_supervisors');

export const fetchUsers = (): Promise<User[]> => fetchAll<User>('users');

/**
 * Fetch a single user profile by email (case-insensitive). Used by the auth
 * flow to resolve accounts that exist in the DB but not in the in-memory seed
 * (e.g. accounts created via the "New Account" admin flow). Returns null if
 * none match or the query errors.
 */
export async function fetchUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return transformRow<User>(data[0] as Record<string, unknown>);
}

export const fetchStores = (): Promise<Store[]> => fetchAll<Store>('stores');
export const fetchApplications = (): Promise<Application[]> =>
  fetchAll<Application>('applications');

export const fetchDeliveries = (): Promise<Delivery[]> => fetchAll<Delivery>('deliveries');
export const fetchBeginningInventories = (): Promise<BeginningInventory[]> =>
  fetchAll<BeginningInventory>('beginning_inventories');
export const fetchEndingInventories = (): Promise<EndingInventory[]> =>
  fetchAll<EndingInventory>('ending_inventories');

export const fetchPayments = (): Promise<Payment[]> => fetchAll<Payment>('payments');
export const fetchPackagingOrders = (): Promise<PackagingOrder[]> =>
  fetchAll<PackagingOrder>('packaging_orders');

export const fetchForecasts = (): Promise<Forecast[]> => fetchAll<Forecast>('forecasts');
export const fetchReferralCodes = (): Promise<ReferralCode[]> =>
  fetchAll<ReferralCode>('referral_codes');
export const fetchSalesMetrics = (): Promise<SalesMetric[]> =>
  fetchAll<SalesMetric>('sales_metrics');
export const fetchNotifications = (): Promise<Notification[]> =>
  fetchAll<Notification>('notifications');
export const fetchSpecialOrders = (): Promise<SpecialOrder[]> =>
  fetchAll<SpecialOrder>('special_orders');

// ── Aggregate hydrate (used by store on auth) ─────────────────

export interface HydratedState {
  plants: Plant[];
  skus: SKU[];
  packagingCatalog: PackagingItem[];
  distributors: Distributor[];
  subPartnerDistributors: SubPartnerDistributor[];
  areaSupervisors: AreaSupervisor[];
  users: User[];
  stores: Store[];
  applications: Application[];
  deliveries: Delivery[];
  beginningInventories: BeginningInventory[];
  endingInventories: EndingInventory[];
  payments: Payment[];
  packagingOrders: PackagingOrder[];
  forecasts: Forecast[];
  referralCodes: ReferralCode[];
  salesMetrics: SalesMetric[];
  notifications: Notification[];
  specialOrders: SpecialOrder[];
}

/**
 * Fetch all entity tables in parallel. Throws on any error so the
 * caller can fall back to mock data.
 */
export async function hydrateAll(): Promise<HydratedState> {
  const [
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
  ] = await Promise.all([
    fetchPlants(),
    fetchSkus(),
    fetchPackagingCatalog(),
    fetchDistributors(),
    fetchSubPartnerDistributors(),
    fetchAreaSupervisors(),
    fetchUsers(),
    fetchStores(),
    fetchApplications(),
    fetchDeliveries(),
    fetchBeginningInventories(),
    fetchEndingInventories(),
    fetchPayments(),
    fetchPackagingOrders(),
    fetchForecasts(),
    fetchReferralCodes(),
    fetchSalesMetrics(),
    fetchNotifications(),
    fetchSpecialOrders(),
  ]);

  return {
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
  };
}
