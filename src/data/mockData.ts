// ============================================================
// ZAPP Donuts ERP - Comprehensive Mock Data
// ============================================================

import type {
  User,
  Plant,
  SKU,
  Distributor,
  SubPartnerDistributor,
  AreaSupervisor,
  Store,
  Application,
  Delivery,
  DeliveryItem,
  BillingRecord,
  Payment,
  PackagingItem,
  PackagingOrder,
  Forecast,
  ForecastItem,
  ReferralCode,
  SalesMetric,
  Notification,
  BeginningInventory,
  EndingInventory,
  SpecialOrder,
} from '@/types';

// ─── Plants ──────────────────────────────────────────────────

export const plants: Plant[] = [
  { id: 'plant-01', name: 'Daraga Plant', location: 'Daraga, Albay', region: 'Bicol', code: 'DRG' },
  { id: 'plant-02', name: 'Manila Plant', location: 'Tondo, Manila', region: 'NCR', code: 'MNL' },
  { id: 'plant-03', name: 'Cebu Plant', location: 'Mandaue, Cebu', region: 'Visayas', code: 'CEB' },
];

// ─── SKUs ────────────────────────────────────────────────────

// Real ZAPP Donuts catalog (sourced from the client's actual Delivery
// Receipt — UberDeli Corp DR# 858368251 — plus in-store price-tag photos
// for SRP). The `id` IS the real 10-digit SAP/material code printed on the
// DR's Code column, so OCR can match a scanned DR line to a SKU by exact
// code (most reliable signal) before falling back to fuzzy name matching.
// DR prices are 4-decimal VAT-inclusive exactly as printed; SRP is the
// rack price tag (rounded peso). Names are Title-Cased for the UI; the
// matcher is tolerant of the "ZP "/"ZAPP " prefixes printed on the slip.
export const skus: SKU[] = [
  { id: '2000017949', name: 'Chocolate Zprinkles', category: 'Premium', drPrice: 20.44, srpPrice: 28, unit: 'pc' },
  { id: '2000015696', name: 'Zapp Its! Choco Butternut', category: 'Classic', drPrice: 6.5632, srpPrice: 9, unit: 'pc' },
  { id: '2000015695', name: 'Choco Butternut', category: 'Classic', drPrice: 20.44, srpPrice: 28, unit: 'pc' },
  { id: '2000000519', name: 'Zapp Its!', category: 'Classic', drPrice: 6.5632, srpPrice: 9, unit: 'pc' },
  { id: '2000000538', name: 'Bavarian - Classic', category: 'Filled', drPrice: 18.2448, srpPrice: 25, unit: 'pc' },
  { id: '2000000520', name: 'Bavarian - Choco', category: 'Filled', drPrice: 18.2448, srpPrice: 25, unit: 'pc' },
  { id: '2000000521', name: 'Strawberry Zprinkles', category: 'Filled', drPrice: 18.2448, srpPrice: 25, unit: 'pc' },
  { id: '2000020575', name: 'Dobol Bav - Classic, Chocolate', category: 'Premium', drPrice: 21.0, srpPrice: 28, unit: 'pc' },
  { id: '2000020576', name: 'Dobol Bav - Classic, Strawberry', category: 'Premium', drPrice: 21.0, srpPrice: 28, unit: 'pc' },
];

// ─── Legacy SKU remap (16 mock SKUs → 9 real products) ───────
//
// The demo data (deliveries, forecasts, inventories, special orders) was
// authored against the old sku-01…sku-16 mock catalog. Rather than hand-
// edit ~116 embedded references (error-prone), we map each legacy id to a
// real product code and rewrite the demo data programmatically at module
// load via `realSku()` + the deep-remap pass at the bottom of this file.
// Mapping is by rough flavor/category affinity; exact pairing is
// cosmetic since this is demo data. All 9 real products are covered.
const LEGACY_SKU_REMAP: Record<string, string> = {
  'sku-01': '2000000519', // Classic Glazed      → Zapp Its!
  'sku-02': '2000015695', // Chocolate Ring      → Choco Butternut
  'sku-03': '2000000538', // Bavarian Cream      → Bavarian - Classic
  'sku-04': '2000000520', // Ube Cheese          → Bavarian - Choco
  'sku-05': '2000000521', // Strawberry Sprinkle → Strawberry Zprinkles
  'sku-06': '2000017949', // Cookies & Cream     → Chocolate Zprinkles
  'sku-07': '2000000538', // Matcha Glazed       → Bavarian - Classic
  'sku-08': '2000015695', // Salted Caramel      → Choco Butternut
  'sku-09': '2000015696', // Cinnamon Sugar      → Zapp Its! Choco Butternut
  'sku-10': '2000000520', // Pandan Cream        → Bavarian - Choco
  'sku-11': '2000000521', // Mango Graham        → Strawberry Zprinkles
  'sku-12': '2000020575', // Double Choco        → Dobol Bav - Classic, Chocolate
  'sku-13': '2000000519', // Lemon Twist         → Zapp Its!
  'sku-14': '2000020576', // Red Velvet          → Dobol Bav - Classic, Strawberry
  'sku-15': '2000020575', // Caramel Macchiato   → Dobol Bav - Classic, Chocolate
  'sku-16': '2000020576', // Blueberry Burst     → Dobol Bav - Classic, Strawberry
};

/**
 * Resolve a legacy `sku-XX` id (or an already-real code) to the real SKU.
 * Falls back to the first catalog entry if an id is somehow unknown so the
 * demo never crashes on a stray reference.
 */
function realSku(legacyOrCode: string): SKU {
  const code = LEGACY_SKU_REMAP[legacyOrCode] ?? legacyOrCode;
  return skus.find((s) => s.id === code) ?? skus[0];
}

/**
 * Recursively rewrite any object carrying a `skuId` to the real catalog:
 * remaps skuId, and (when present) skuName / drPrice / srpPrice so every
 * denormalized copy stays consistent with the new catalog. Mutates in
 * place; safe to run once at module load over the exported demo arrays.
 */
function deepRemapSkus(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(deepRemapSkus);
    return;
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (typeof rec.skuId === 'string') {
      const sku = realSku(rec.skuId);
      rec.skuId = sku.id;
      if ('skuName' in rec) rec.skuName = sku.name;
      if (typeof rec.drPrice === 'number') rec.drPrice = sku.drPrice;
      if (typeof rec.srpPrice === 'number') rec.srpPrice = sku.srpPrice;
    }
    for (const value of Object.values(rec)) deepRemapSkus(value);
  }
}

// ─── Distributors ────────────────────────────────────────────

export const distributors: Distributor[] = [
  {
    id: 'dist-01',
    name: 'Bicol Express Distributing',
    contactPerson: 'Marco Villanueva',
    email: 'marco@zappdonuts.com',
    phone: '+63-917-111-0001',
    plantId: 'plant-01',
    referralCode: 'BICOL-MARCO',
    assignedAreaIds: ['area-albay-01', 'area-albay-02'],
    status: 'active',
  },
  {
    id: 'dist-02',
    name: 'CamSur Donut Supply',
    contactPerson: 'Liza Reyes',
    email: 'liza@camsursupply.ph',
    phone: '+63-917-111-0002',
    plantId: 'plant-01',
    referralCode: 'CAMSUR-LIZA',
    assignedAreaIds: ['area-camsur-01'],
    status: 'active',
  },
  {
    id: 'dist-03',
    name: 'Metro Manila Foods Inc.',
    contactPerson: 'Ricardo Santos',
    email: 'ricardo@zappdonuts.com',
    phone: '+63-917-222-0001',
    plantId: 'plant-02',
    referralCode: 'METRO-RICK',
    assignedAreaIds: ['area-manila-01', 'area-makati-01'],
    status: 'active',
  },
  {
    id: 'dist-04',
    name: 'Quezon City Wholesale',
    contactPerson: 'Angela Cruz',
    email: 'angela@qcwholesale.ph',
    phone: '+63-917-222-0002',
    plantId: 'plant-02',
    referralCode: 'QC-ANGELA',
    assignedAreaIds: ['area-qc-01'],
    status: 'active',
  },
  {
    id: 'dist-05',
    name: 'Visayas Trade Corp.',
    contactPerson: 'Jose Tan',
    email: 'jose@visayastrade.ph',
    phone: '+63-917-333-0001',
    plantId: 'plant-03',
    referralCode: 'VIS-JOSE',
    assignedAreaIds: ['area-cebu-01', 'area-cebu-02'],
    status: 'active',
  },
];

// ─── Sub-Partner Distributors ───────────────────────────────────
// Optional layer under a Partner Distributor. Receives a 50% share of the
// parent PD's profit (i.e. 5% of Gross instead of the parent's 10%).

export const subPartnerDistributors: SubPartnerDistributor[] = [
  {
    id: 'spd-01',
    name: 'Albay South Sub-Distribution',
    contactPerson: 'Mariel Tan',
    email: 'mariel@zappdonuts.com',
    phone: '+63-918-222-3344',
    parentDistributorId: 'dist-01',
    plantId: 'plant-01',
    assignedStoreIds: ['store-02', 'store-04'],
    status: 'active',
    referralCode: 'SPD-MARIEL',
  },
];

// ─── Area Supervisors ───────────────────────────────────────────

export const areaSupervisors: AreaSupervisor[] = [
  {
    id: 'am-01',
    name: 'Patricia Bautista',
    email: 'patricia@zappdonuts.com',
    phone: '+63-918-100-0001',
    assignedAreas: ['Legazpi City', 'Daraga'],
    plantId: 'plant-01',
    assignedStoreIds: ['store-01', 'store-02', 'store-03'],
  },
  {
    id: 'am-02',
    name: 'Daniel Mercado',
    email: 'daniel@zappdonuts.com',
    phone: '+63-918-100-0002',
    assignedAreas: ['Tabaco', 'Malilipot', 'Sorsogon City'],
    plantId: 'plant-01',
    assignedStoreIds: ['store-04', 'store-05', 'store-26'],
  },
  {
    id: 'am-03',
    name: 'Karen Flores',
    email: 'karen@zappdonuts.com',
    phone: '+63-918-100-0003',
    assignedAreas: ['Naga City', 'Pili'],
    plantId: 'plant-01',
    assignedStoreIds: ['store-06', 'store-07', 'store-08'],
  },
  {
    id: 'am-04',
    name: 'Bryan Hernandez',
    email: 'bryan@zappdonuts.com',
    phone: '+63-918-200-0001',
    assignedAreas: ['Tondo', 'Sampaloc', 'Quiapo'],
    plantId: 'plant-02',
    assignedStoreIds: ['store-09', 'store-10', 'store-11'],
  },
  {
    id: 'am-05',
    name: 'Janine Aquino',
    email: 'janine@zappdonuts.com',
    phone: '+63-918-200-0002',
    assignedAreas: ['Makati CBD', 'Poblacion'],
    plantId: 'plant-02',
    assignedStoreIds: ['store-12', 'store-13', 'store-14'],
  },
  {
    id: 'am-06',
    name: 'Miguel dela Cruz',
    email: 'miguel@zappdonuts.com',
    phone: '+63-918-200-0003',
    assignedAreas: ['Quezon City', 'Cubao'],
    plantId: 'plant-02',
    assignedStoreIds: ['store-15', 'store-16', 'store-17'],
  },
  {
    id: 'am-07',
    name: 'Rachelle Sy',
    email: 'rachelle@zappdonuts.com',
    phone: '+63-918-300-0001',
    assignedAreas: ['Cebu City', 'Mandaue'],
    plantId: 'plant-03',
    assignedStoreIds: ['store-18', 'store-19', 'store-20', 'store-21'],
  },
  {
    id: 'am-08',
    name: 'Kevin Ong',
    email: 'kevin@zappdonuts.com',
    phone: '+63-918-300-0002',
    assignedAreas: ['Lapu-Lapu', 'Talisay'],
    plantId: 'plant-03',
    assignedStoreIds: ['store-22', 'store-23', 'store-24', 'store-25'],
  },
];

// ─── Stores ──────────────────────────────────────────────────

export const stores: Store[] = [
  // --- Bicol / Daraga Plant ---
  {
    id: 'store-01', name: 'ZAPP Legazpi Centro', businessName: 'Legazpi Centro Donuts', ownerName: 'Maria Santos',
    address: '123 Rizal St, Legazpi City, Albay', lat: 13.1391, lng: 123.7438, plantId: 'plant-01',
    distributorId: 'dist-01', areaSupervisorId: 'am-01', franchiseType: 'distributor', status: 'active',
    province: 'Albay', area: 'Legazpi City', phone: '+63-926-001-0001', email: 'legazpi.centro@zappdonuts.com', createdAt: '2025-06-15', deliveryStatus: 'active',
  },
  {
    id: 'store-02', name: 'ZAPP Daraga Market', businessName: 'Daraga Market Treats', ownerName: 'Jose Ramos',
    address: '45 Market Rd, Daraga, Albay', lat: 13.1548, lng: 123.6982, plantId: 'plant-01',
    distributorId: 'dist-01', subPartnerDistributorId: 'spd-01', areaSupervisorId: 'am-01', franchiseType: 'distributor', status: 'active',
    province: 'Albay', area: 'Daraga', phone: '+63-926-001-0002', email: 'daraga.market@zappdonuts.com', createdAt: '2025-07-01', deliveryStatus: 'active',
  },
  {
    id: 'store-03', name: 'ZAPP Legazpi Port', businessName: 'Port Area Sweets', ownerName: 'Ana Lim',
    address: '78 Port Area, Legazpi City, Albay', lat: 13.1345, lng: 123.7552, plantId: 'plant-01',
    areaSupervisorId: 'am-01', franchiseType: 'direct', status: 'active',
    province: 'Albay', area: 'Legazpi City', phone: '+63-926-001-0003', email: 'legazpi.port@zappdonuts.com', createdAt: '2025-08-10', deliveryStatus: 'active',
  },
  {
    id: 'store-04', name: 'ZAPP Tabaco Plaza', businessName: 'Tabaco Donut Hub', ownerName: 'Pedro Garcia',
    address: '12 National Hwy, Tabaco City, Albay', lat: 13.3587, lng: 123.7338, plantId: 'plant-01',
    distributorId: 'dist-01', subPartnerDistributorId: 'spd-01', areaSupervisorId: 'am-02', franchiseType: 'distributor', status: 'active',
    province: 'Albay', area: 'Tabaco', phone: '+63-926-001-0004', email: 'tabaco.plaza@zappdonuts.com', createdAt: '2025-09-01', deliveryStatus: 'active',
  },
  {
    id: 'store-05', name: 'ZAPP Malilipot Stop', businessName: 'Malilipot Bites', ownerName: 'Rosa Diaz',
    address: '3 Camalig Rd, Malilipot, Albay', lat: 13.3193, lng: 123.7314, plantId: 'plant-01',
    areaSupervisorId: 'am-02', franchiseType: 'direct', status: 'active',
    province: 'Albay', area: 'Malilipot', phone: '+63-926-001-0005', email: 'malilipot@zappdonuts.com', createdAt: '2025-09-20', deliveryStatus: 'active',
  },
  {
    id: 'store-06', name: 'ZAPP Naga Centro', businessName: 'Naga Centro Food', ownerName: 'Carlos Mendoza',
    address: '88 Magsaysay Ave, Naga City, Camarines Sur', lat: 13.6218, lng: 123.1948, plantId: 'plant-01',
    distributorId: 'dist-02', areaSupervisorId: 'am-03', franchiseType: 'distributor', status: 'active',
    province: 'Camarines Sur', area: 'Naga City', phone: '+63-926-002-0001', email: 'naga.centro@zappdonuts.com', createdAt: '2025-07-15', deliveryStatus: 'active',
  },
  {
    id: 'store-07', name: 'ZAPP Naga SM', businessName: 'SM Naga Donuts', ownerName: 'Elena Cruz',
    address: 'SM City Naga, CBD II, Naga City', lat: 13.6155, lng: 123.2032, plantId: 'plant-01',
    distributorId: 'dist-02', areaSupervisorId: 'am-03', franchiseType: 'distributor', status: 'active',
    province: 'Camarines Sur', area: 'Naga City', phone: '+63-926-002-0002', email: 'naga.sm@zappdonuts.com', createdAt: '2025-08-01', deliveryStatus: 'active',
  },
  {
    id: 'store-08', name: 'ZAPP Pili Junction', businessName: 'Pili Donut Corner', ownerName: 'Roberto Tan',
    address: '5 Pili Junction, Pili, Camarines Sur', lat: 13.5791, lng: 123.2826, plantId: 'plant-01',
    areaSupervisorId: 'am-03', franchiseType: 'direct', status: 'pending',
    province: 'Camarines Sur', area: 'Pili', phone: '+63-926-002-0003', email: 'pili@zappdonuts.com', createdAt: '2026-01-10', deliveryStatus: 'active',
  },

  // --- NCR / Manila Plant ---
  {
    id: 'store-09', name: 'ZAPP Tondo Main', businessName: 'Tondo Main Sweets', ownerName: 'Antonio Reyes',
    address: '320 Juan Luna St, Tondo, Manila', lat: 14.6130, lng: 120.9671, plantId: 'plant-02',
    distributorId: 'dist-03', areaSupervisorId: 'am-04', franchiseType: 'distributor', status: 'active',
    province: 'Manila', area: 'Tondo', phone: '+63-926-003-0001', email: 'tondo.main@zappdonuts.com', createdAt: '2025-05-15', deliveryStatus: 'active',
  },
  {
    id: 'store-10', name: 'ZAPP Sampaloc University', businessName: 'Sampaloc U-Belt Snacks', ownerName: 'Linda Castillo',
    address: '55 Espana Blvd, Sampaloc, Manila', lat: 14.6103, lng: 120.9882, plantId: 'plant-02',
    distributorId: 'dist-03', areaSupervisorId: 'am-04', franchiseType: 'distributor', status: 'active',
    province: 'Manila', area: 'Sampaloc', phone: '+63-926-003-0002', email: 'sampaloc@zappdonuts.com', createdAt: '2025-06-01', deliveryStatus: 'active',
  },
  {
    id: 'store-11', name: 'ZAPP Quiapo Market', businessName: 'Quiapo Quick Bites', ownerName: 'Ferdinand Alba',
    address: '100 Quezon Blvd, Quiapo, Manila', lat: 14.5986, lng: 120.9845, plantId: 'plant-02',
    areaSupervisorId: 'am-04', franchiseType: 'direct', status: 'active',
    province: 'Manila', area: 'Quiapo', phone: '+63-926-003-0003', email: 'quiapo@zappdonuts.com', createdAt: '2025-07-20', deliveryStatus: 'active',
  },
  {
    id: 'store-12', name: 'ZAPP Makati Ayala', businessName: 'Ayala Donut Lounge', ownerName: 'Sophia Lee',
    address: 'Ground Floor, Glorietta 4, Makati', lat: 14.5510, lng: 121.0249, plantId: 'plant-02',
    distributorId: 'dist-03', areaSupervisorId: 'am-05', franchiseType: 'distributor', status: 'active',
    province: 'Makati', area: 'Makati CBD', phone: '+63-926-003-0004', email: 'makati.ayala@zappdonuts.com', createdAt: '2025-06-15', deliveryStatus: 'active',
  },
  {
    id: 'store-13', name: 'ZAPP Poblacion Hub', businessName: 'Poblacion Night Donuts', ownerName: 'James Yu',
    address: '22 Kalayaan Ave, Poblacion, Makati', lat: 14.5636, lng: 121.0307, plantId: 'plant-02',
    areaSupervisorId: 'am-05', franchiseType: 'direct', status: 'active',
    province: 'Makati', area: 'Poblacion', phone: '+63-926-003-0005', email: 'poblacion@zappdonuts.com', createdAt: '2025-09-01', deliveryStatus: 'active',
  },
  {
    id: 'store-14', name: 'ZAPP Makati Pasong Tamo', businessName: 'Pasong Tamo Treats', ownerName: 'Grace Chua',
    address: '88 Pasong Tamo Ext, Makati', lat: 14.5465, lng: 121.0198, plantId: 'plant-02',
    distributorId: 'dist-03', areaSupervisorId: 'am-05', franchiseType: 'distributor', status: 'inactive',
    province: 'Makati', area: 'Makati CBD', phone: '+63-926-003-0006', email: 'pasongtamo@zappdonuts.com', createdAt: '2025-04-10', deliveryStatus: 'active',
  },
  {
    id: 'store-15', name: 'ZAPP Cubao Gateway', businessName: 'Gateway Donut Stop', ownerName: 'Mark Villanueva',
    address: 'Gateway Mall, Cubao, Quezon City', lat: 14.6191, lng: 121.0557, plantId: 'plant-02',
    distributorId: 'dist-04', areaSupervisorId: 'am-06', franchiseType: 'distributor', status: 'active',
    province: 'Quezon City', area: 'Cubao', phone: '+63-926-004-0001', email: 'cubao@zappdonuts.com', createdAt: '2025-05-20', deliveryStatus: 'active',
  },
  {
    id: 'store-16', name: 'ZAPP Eastwood', businessName: 'Eastwood Sweet Spot', ownerName: 'Nina Gonzales',
    address: 'Eastwood City Walk, Quezon City', lat: 14.6101, lng: 121.0806, plantId: 'plant-02',
    distributorId: 'dist-04', areaSupervisorId: 'am-06', franchiseType: 'distributor', status: 'active',
    province: 'Quezon City', area: 'Quezon City', phone: '+63-926-004-0002', email: 'eastwood@zappdonuts.com', createdAt: '2025-07-05', deliveryStatus: 'active',
  },
  {
    id: 'store-17', name: 'ZAPP Trinoma', businessName: 'Trinoma Donut Bar', ownerName: 'Victor Tan',
    address: 'TriNoma Mall, North EDSA, Quezon City', lat: 14.6536, lng: 121.0326, plantId: 'plant-02',
    areaSupervisorId: 'am-06', franchiseType: 'direct', status: 'active',
    province: 'Quezon City', area: 'Quezon City', phone: '+63-926-004-0003', email: 'trinoma@zappdonuts.com', createdAt: '2025-10-01', deliveryStatus: 'active',
  },

  // --- Visayas / Cebu Plant ---
  {
    id: 'store-18', name: 'ZAPP Colon St', businessName: 'Colon Heritage Donuts', ownerName: 'Ramon Uy',
    address: '100 Colon St, Cebu City', lat: 10.2935, lng: 123.8997, plantId: 'plant-03',
    distributorId: 'dist-05', areaSupervisorId: 'am-07', franchiseType: 'distributor', status: 'active',
    province: 'Cebu', area: 'Cebu City', phone: '+63-926-005-0001', email: 'colon@zappdonuts.com', createdAt: '2025-06-01', deliveryStatus: 'active',
  },
  {
    id: 'store-19', name: 'ZAPP Ayala Cebu', businessName: 'Ayala Center Cebu Donuts', ownerName: 'Christine Go',
    address: 'Ayala Center Cebu, Cebu Business Park', lat: 10.3186, lng: 123.9056, plantId: 'plant-03',
    distributorId: 'dist-05', areaSupervisorId: 'am-07', franchiseType: 'distributor', status: 'active',
    province: 'Cebu', area: 'Cebu City', phone: '+63-926-005-0002', email: 'ayala.cebu@zappdonuts.com', createdAt: '2025-06-20', deliveryStatus: 'active',
  },
  {
    id: 'store-20', name: 'ZAPP IT Park', businessName: 'IT Park Midnight Donuts', ownerName: 'Dennis Lim',
    address: 'Cebu IT Park, Lahug, Cebu City', lat: 10.3290, lng: 123.9059, plantId: 'plant-03',
    areaSupervisorId: 'am-07', franchiseType: 'direct', status: 'active',
    province: 'Cebu', area: 'Cebu City', phone: '+63-926-005-0003', email: 'itpark@zappdonuts.com', createdAt: '2025-08-15', deliveryStatus: 'active',
  },
  {
    id: 'store-21', name: 'ZAPP Mandaue Center', businessName: 'Mandaue City Sweets', ownerName: 'Patricia Ong',
    address: '56 A.C. Cortes Ave, Mandaue City', lat: 10.3338, lng: 123.9322, plantId: 'plant-03',
    distributorId: 'dist-05', areaSupervisorId: 'am-07', franchiseType: 'distributor', status: 'active',
    province: 'Cebu', area: 'Mandaue', phone: '+63-926-005-0004', email: 'mandaue@zappdonuts.com', createdAt: '2025-09-01', deliveryStatus: 'active',
  },
  {
    id: 'store-22', name: 'ZAPP Lapu-Lapu Marina', businessName: 'Marina Mall Bites', ownerName: 'Eric Tan',
    address: 'Marina Mall, Lapu-Lapu City', lat: 10.3103, lng: 123.9494, plantId: 'plant-03',
    distributorId: 'dist-05', areaSupervisorId: 'am-08', franchiseType: 'distributor', status: 'active',
    province: 'Cebu', area: 'Lapu-Lapu', phone: '+63-926-005-0005', email: 'lapulapu@zappdonuts.com', createdAt: '2025-07-15', deliveryStatus: 'active',
  },
  {
    id: 'store-23', name: 'ZAPP Mactan Airport', businessName: 'Mactan Terminal Donuts', ownerName: 'Iris Santos',
    address: 'MCIA Terminal 2, Lapu-Lapu City', lat: 10.3076, lng: 123.9793, plantId: 'plant-03',
    areaSupervisorId: 'am-08', franchiseType: 'direct', status: 'active',
    province: 'Cebu', area: 'Lapu-Lapu', phone: '+63-926-005-0006', email: 'mactan.airport@zappdonuts.com', createdAt: '2025-10-10', deliveryStatus: 'active',
  },
  {
    id: 'store-24', name: 'ZAPP Talisay City', businessName: 'Talisay Donut Express', ownerName: 'Raymond Cruz',
    address: '12 Tabunok, Talisay City, Cebu', lat: 10.2444, lng: 123.8496, plantId: 'plant-03',
    distributorId: 'dist-05', areaSupervisorId: 'am-08', franchiseType: 'distributor', status: 'active',
    province: 'Cebu', area: 'Talisay', phone: '+63-926-005-0007', email: 'talisay@zappdonuts.com', createdAt: '2025-11-01', deliveryStatus: 'active',
  },
  {
    id: 'store-25', name: 'ZAPP Talisay South', businessName: 'South Cebu Bites', ownerName: 'Michelle Fernandez',
    address: '88 SRP Road, Talisay City, Cebu', lat: 10.2380, lng: 123.8420, plantId: 'plant-03',
    areaSupervisorId: 'am-08', franchiseType: 'direct', status: 'blocked',
    province: 'Cebu', area: 'Talisay', phone: '+63-926-005-0008', email: 'talisay.south@zappdonuts.com', createdAt: '2025-11-15', deliveryStatus: 'active',
  },
  {
    id: 'store-26', name: 'ZAPP Sorsogon Town', businessName: 'Sorsogon Donut House', ownerName: 'Alfredo Morales',
    address: '40 Rizal St, Sorsogon City, Sorsogon', lat: 12.9742, lng: 124.0049, plantId: 'plant-01',
    areaSupervisorId: 'am-02', franchiseType: 'direct', status: 'active',
    province: 'Sorsogon', area: 'Sorsogon City', phone: '+63-926-006-0001', email: 'sorsogon@zappdonuts.com', createdAt: '2025-12-01', deliveryStatus: 'active',
  },
];

// ─── Applications ────────────────────────────────────────────

export const applications: Application[] = [
  {
    id: 'app-01', fullName: 'Jasmine Reyes', mobile: '+63-917-500-0001', email: 'jasmine.r@gmail.com',
    storeName: 'ZAPP Iriga City', address: '90 San Roque, Iriga City, Camarines Sur',
    lat: 13.4218, lng: 123.4127, storePhotoUrl: '/uploads/app-01/store.jpg',
    govIdUrl: '/uploads/app-01/gov-id.jpg', proofOfBillingUrl: '/uploads/app-01/billing.jpg',
    referralCode: 'CAMSUR-LIZA', referralType: 'distributor', assignedDistributorId: 'dist-02',
    assignedAreaSupervisorId: 'am-03', assignedPlantId: 'plant-01', status: 'pending',
    submittedAt: '2026-03-10T09:30:00Z', auditLog: [
      { id: 'audit-01', action: 'Application submitted', performedBy: 'jasmine.r@gmail.com', performedAt: '2026-03-10T09:30:00Z', details: 'Online form submission' },
    ],
  },
  {
    id: 'app-02', fullName: 'Armando Diaz', mobile: '+63-917-500-0002', email: 'armando.d@gmail.com',
    storeName: 'ZAPP Pasig Kapitolyo', address: '15 Kapitolyo Dr, Pasig City',
    lat: 14.5714, lng: 121.0609, storePhotoUrl: '/uploads/app-02/store.jpg',
    govIdUrl: '/uploads/app-02/gov-id.jpg', proofOfBillingUrl: '/uploads/app-02/billing.jpg',
    referralCode: 'ZAPP-INT-001', referralType: 'zapp_internal',
    assignedAreaSupervisorId: 'am-06', assignedPlantId: 'plant-02', status: 'approved',
    submittedAt: '2026-02-20T14:00:00Z', reviewedBy: 'user-02', reviewedAt: '2026-02-25T10:00:00Z',
    notes: 'Excellent location near commercial area.',
    auditLog: [
      { id: 'audit-02', action: 'Application submitted', performedBy: 'armando.d@gmail.com', performedAt: '2026-02-20T14:00:00Z', details: 'Online form submission' },
      { id: 'audit-03', action: 'Application approved', performedBy: 'user-02', performedAt: '2026-02-25T10:00:00Z', details: 'Location verified, financials checked' },
    ],
  },
  {
    id: 'app-03', fullName: 'Lorna Villanueva', mobile: '+63-917-500-0003', email: 'lorna.v@gmail.com',
    storeName: 'ZAPP Legazpi Embarcadero', address: 'Embarcadero de Legazpi, Legazpi City',
    lat: 13.1365, lng: 123.7501, storePhotoUrl: '/uploads/app-03/store.jpg',
    govIdUrl: '/uploads/app-03/gov-id.jpg', proofOfBillingUrl: '/uploads/app-03/billing.jpg',
    referralCode: 'BICOL-MARCO', referralType: 'distributor', assignedDistributorId: 'dist-01',
    assignedAreaSupervisorId: 'am-01', assignedPlantId: 'plant-01', status: 'declined',
    submittedAt: '2026-01-15T08:00:00Z', reviewedBy: 'user-02', reviewedAt: '2026-01-20T11:30:00Z',
    notes: 'Too close to existing ZAPP Legazpi Centro. Market saturation risk.',
    auditLog: [
      { id: 'audit-04', action: 'Application submitted', performedBy: 'lorna.v@gmail.com', performedAt: '2026-01-15T08:00:00Z', details: 'Online form submission' },
      { id: 'audit-05', action: 'Application declined', performedBy: 'user-02', performedAt: '2026-01-20T11:30:00Z', details: 'Proximity conflict with store-01' },
    ],
  },
  {
    id: 'app-04', fullName: 'Benedict Co', mobile: '+63-917-500-0004', email: 'bene.co@gmail.com',
    storeName: 'ZAPP Mandaue Pacific', address: 'Pacific Mall, Mandaue City',
    lat: 10.3380, lng: 123.9350, storePhotoUrl: '/uploads/app-04/store.jpg',
    govIdUrl: '/uploads/app-04/gov-id.jpg', proofOfBillingUrl: '/uploads/app-04/billing.jpg',
    referralCode: 'VIS-JOSE', referralType: 'distributor', assignedDistributorId: 'dist-05',
    assignedAreaSupervisorId: 'am-07', assignedPlantId: 'plant-03', status: 'pending',
    submittedAt: '2026-03-18T10:45:00Z',
    auditLog: [
      { id: 'audit-06', action: 'Application submitted', performedBy: 'bene.co@gmail.com', performedAt: '2026-03-18T10:45:00Z', details: 'Online form submission' },
    ],
  },
  {
    id: 'app-05', fullName: 'Teresa Magno', mobile: '+63-917-500-0005', email: 'teresa.m@gmail.com',
    storeName: 'ZAPP Marikina Riverbanks', address: 'Riverbanks Center, Marikina City',
    lat: 14.6275, lng: 121.0967, storePhotoUrl: '/uploads/app-05/store.jpg',
    govIdUrl: '/uploads/app-05/gov-id.jpg', proofOfBillingUrl: '/uploads/app-05/billing.jpg',
    referralCode: 'QC-ANGELA', referralType: 'distributor', assignedDistributorId: 'dist-04',
    assignedAreaSupervisorId: 'am-06', assignedPlantId: 'plant-02', status: 'pending',
    submittedAt: '2026-03-20T16:00:00Z',
    auditLog: [
      { id: 'audit-07', action: 'Application submitted', performedBy: 'teresa.m@gmail.com', performedAt: '2026-03-20T16:00:00Z', details: 'Online form submission' },
    ],
  },
  {
    id: 'app-06', fullName: 'Dario Buenaventura', mobile: '+63-917-500-0006', email: 'dario.b@gmail.com',
    storeName: 'ZAPP Sorsogon Market', address: '22 Public Market, Sorsogon City',
    lat: 12.9700, lng: 124.0010, storePhotoUrl: '/uploads/app-06/store.jpg',
    govIdUrl: '/uploads/app-06/gov-id.jpg', proofOfBillingUrl: '/uploads/app-06/billing.jpg',
    referralCode: 'ZAPP-INT-002', referralType: 'zapp_internal',
    assignedAreaSupervisorId: 'am-02', assignedPlantId: 'plant-01', status: 'approved',
    submittedAt: '2026-02-01T11:00:00Z', reviewedBy: 'user-04', reviewedAt: '2026-02-10T09:00:00Z',
    notes: 'Good potential for Sorsogon expansion.',
    auditLog: [
      { id: 'audit-08', action: 'Application submitted', performedBy: 'dario.b@gmail.com', performedAt: '2026-02-01T11:00:00Z', details: 'Online form submission' },
      { id: 'audit-09', action: 'Application approved', performedBy: 'user-04', performedAt: '2026-02-10T09:00:00Z', details: 'First store in Sorsogon market area' },
    ],
  },
  {
    id: 'app-07', fullName: 'Camille Tan', mobile: '+63-917-500-0007', email: 'camille.t@gmail.com',
    storeName: 'ZAPP Talisay Gaisano', address: 'Gaisano Talisay, Cebu',
    lat: 10.2460, lng: 123.8500, storePhotoUrl: '/uploads/app-07/store.jpg',
    govIdUrl: '/uploads/app-07/gov-id.jpg', proofOfBillingUrl: '/uploads/app-07/billing.jpg',
    referralCode: 'VIS-JOSE', referralType: 'distributor', assignedDistributorId: 'dist-05',
    assignedAreaSupervisorId: 'am-08', assignedPlantId: 'plant-03', status: 'pending',
    submittedAt: '2026-03-21T08:30:00Z',
    auditLog: [
      { id: 'audit-10', action: 'Application submitted', performedBy: 'camille.t@gmail.com', performedAt: '2026-03-21T08:30:00Z', details: 'Online form submission' },
    ],
  },
  {
    id: 'app-08', fullName: 'Rodel Ponce', mobile: '+63-917-500-0008', email: 'rodel.p@gmail.com',
    storeName: 'ZAPP Naga Panganiban', address: 'Panganiban Drive, Naga City',
    lat: 13.6250, lng: 123.1900, storePhotoUrl: '/uploads/app-08/store.jpg',
    govIdUrl: '/uploads/app-08/gov-id.jpg', proofOfBillingUrl: '/uploads/app-08/billing.jpg',
    referralCode: 'CAMSUR-LIZA', referralType: 'distributor', assignedDistributorId: 'dist-02',
    assignedAreaSupervisorId: 'am-03', assignedPlantId: 'plant-01', status: 'declined',
    submittedAt: '2026-01-28T13:00:00Z', reviewedBy: 'user-02', reviewedAt: '2026-02-05T15:00:00Z',
    notes: 'Incomplete documentation. Applicant failed to provide updated proof of billing.',
    auditLog: [
      { id: 'audit-11', action: 'Application submitted', performedBy: 'rodel.p@gmail.com', performedAt: '2026-01-28T13:00:00Z', details: 'Online form submission' },
      { id: 'audit-12', action: 'Application declined', performedBy: 'user-02', performedAt: '2026-02-05T15:00:00Z', details: 'Missing documents' },
    ],
  },
  {
    id: 'app-09', fullName: 'Glenda Samson', mobile: '+63-917-500-0009', email: 'glenda.s@gmail.com',
    storeName: 'ZAPP Pasay MOA', address: 'Mall of Asia Complex, Pasay City',
    lat: 14.5352, lng: 120.9826, storePhotoUrl: '/uploads/app-09/store.jpg',
    govIdUrl: '/uploads/app-09/gov-id.jpg', proofOfBillingUrl: '/uploads/app-09/billing.jpg',
    referralCode: 'METRO-RICK', referralType: 'distributor', assignedDistributorId: 'dist-03',
    assignedAreaSupervisorId: 'am-05', assignedPlantId: 'plant-02', status: 'approved',
    submittedAt: '2026-02-14T09:00:00Z', reviewedBy: 'user-02', reviewedAt: '2026-02-20T10:00:00Z',
    notes: 'High foot traffic location. Priority onboarding.',
    auditLog: [
      { id: 'audit-13', action: 'Application submitted', performedBy: 'glenda.s@gmail.com', performedAt: '2026-02-14T09:00:00Z', details: 'Online form submission' },
      { id: 'audit-14', action: 'Application approved', performedBy: 'user-02', performedAt: '2026-02-20T10:00:00Z', details: 'Premium mall location approved' },
    ],
  },
  {
    id: 'app-10', fullName: 'Norman Reyes', mobile: '+63-917-500-0010', email: 'norman.r@gmail.com',
    storeName: 'ZAPP Cebu Fuente', address: 'Fuente Osmena Circle, Cebu City',
    lat: 10.3100, lng: 123.8916, storePhotoUrl: '/uploads/app-10/store.jpg',
    govIdUrl: '/uploads/app-10/gov-id.jpg', proofOfBillingUrl: '/uploads/app-10/billing.jpg',
    referralCode: 'ZAPP-INT-003', referralType: 'zapp_internal',
    assignedAreaSupervisorId: 'am-07', assignedPlantId: 'plant-03', status: 'pending',
    submittedAt: '2026-03-22T07:00:00Z',
    auditLog: [
      { id: 'audit-15', action: 'Application submitted', performedBy: 'norman.r@gmail.com', performedAt: '2026-03-22T07:00:00Z', details: 'Online form submission' },
    ],
  },
  {
    id: 'app-11', fullName: 'Cherry Lozano', mobile: '+63-917-500-0011', email: 'cherry.l@gmail.com',
    storeName: 'ZAPP Tabaco New Market', address: 'New Public Market, Tabaco City, Albay',
    lat: 13.3600, lng: 123.7350, storePhotoUrl: '/uploads/app-11/store.jpg',
    govIdUrl: '/uploads/app-11/gov-id.jpg', proofOfBillingUrl: '/uploads/app-11/billing.jpg',
    referralCode: 'BICOL-MARCO', referralType: 'distributor', assignedDistributorId: 'dist-01',
    assignedAreaSupervisorId: 'am-02', assignedPlantId: 'plant-01', status: 'pending',
    submittedAt: '2026-03-19T12:00:00Z',
    auditLog: [
      { id: 'audit-16', action: 'Application submitted', performedBy: 'cherry.l@gmail.com', performedAt: '2026-03-19T12:00:00Z', details: 'Online form submission' },
    ],
  },
];

// ─── Helper: build delivery items from SKU subset ────────────

function buildDeliveryItems(skuIds: string[], quantities: number[]): {
  items: DeliveryItem[];
  totalDRCost: number;
  totalSRP: number;
} {
  const items: DeliveryItem[] = skuIds.map((sid, i) => {
    const sku = realSku(sid);
    return { skuId: sku.id, skuName: sku.name, quantity: quantities[i], drPrice: sku.drPrice, srpPrice: sku.srpPrice };
  });
  const totalDRCost = items.reduce((s, it) => s + it.quantity * it.drPrice, 0);
  const totalSRP = items.reduce((s, it) => s + it.quantity * it.srpPrice, 0);
  return { items, totalDRCost, totalSRP };
}

// ─── Deliveries ──────────────────────────────────────────────

const d01 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-03', 'sku-05', 'sku-09'], [50, 40, 30, 25, 20]);
const d02 = buildDeliveryItems(['sku-01', 'sku-04', 'sku-06', 'sku-10'], [60, 35, 30, 25]);
const d03 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-03', 'sku-07', 'sku-11', 'sku-14'], [80, 60, 50, 40, 30, 25]);
const d04 = buildDeliveryItems(['sku-01', 'sku-05', 'sku-08', 'sku-12'], [45, 30, 25, 20]);
const d05 = buildDeliveryItems(['sku-02', 'sku-03', 'sku-06', 'sku-09', 'sku-13'], [55, 40, 35, 30, 20]);
const d06 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-04', 'sku-07'], [70, 50, 40, 35]);
const d07 = buildDeliveryItems(['sku-03', 'sku-05', 'sku-10', 'sku-15'], [40, 30, 25, 20]);
const d08 = buildDeliveryItems(['sku-01', 'sku-06', 'sku-08', 'sku-11', 'sku-14'], [65, 45, 35, 30, 20]);
const d09 = buildDeliveryItems(['sku-02', 'sku-04', 'sku-07', 'sku-12'], [50, 35, 30, 25]);
const d10 = buildDeliveryItems(['sku-01', 'sku-03', 'sku-09', 'sku-16'], [55, 40, 30, 20]);
const d11 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-05', 'sku-08', 'sku-10'], [75, 55, 40, 30, 25]);
const d12 = buildDeliveryItems(['sku-03', 'sku-06', 'sku-11', 'sku-13'], [45, 35, 25, 20]);
const d13 = buildDeliveryItems(['sku-01', 'sku-04', 'sku-07', 'sku-14', 'sku-15'], [60, 40, 35, 25, 20]);
const d14 = buildDeliveryItems(['sku-02', 'sku-05', 'sku-09', 'sku-12'], [50, 30, 25, 20]);
const d15 = buildDeliveryItems(['sku-01', 'sku-03', 'sku-08', 'sku-10', 'sku-16'], [70, 50, 35, 30, 15]);
const d16 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-06', 'sku-11'], [55, 40, 30, 25]);
const d17 = buildDeliveryItems(['sku-04', 'sku-07', 'sku-13', 'sku-15'], [40, 30, 25, 20]);
const d18 = buildDeliveryItems(['sku-01', 'sku-02', 'sku-03', 'sku-05', 'sku-09', 'sku-14'], [90, 70, 55, 40, 35, 25]);
const d19 = buildDeliveryItems(['sku-01', 'sku-08', 'sku-12', 'sku-16'], [60, 35, 25, 20]);
const d20 = buildDeliveryItems(['sku-02', 'sku-04', 'sku-06', 'sku-10', 'sku-11'], [50, 35, 30, 25, 20]);
const d21 = buildDeliveryItems(['sku-01', 'sku-03', 'sku-07', 'sku-15'], [65, 45, 35, 25]);
const d22 = buildDeliveryItems(['sku-05', 'sku-09', 'sku-13', 'sku-14'], [35, 30, 25, 20]);

export const deliveries: Delivery[] = [
  { id: 'del-01', storeId: 'store-01', plantId: 'plant-01', date: '2026-03-01', status: 'reconciled', drNumber: 'DR-DRG-20260301-001', ...d01 },
  { id: 'del-02', storeId: 'store-02', plantId: 'plant-01', date: '2026-03-01', status: 'reconciled', drNumber: 'DR-DRG-20260301-002', ...d02 },
  { id: 'del-03', storeId: 'store-09', plantId: 'plant-02', date: '2026-03-01', status: 'reconciled', drNumber: 'DR-MNL-20260301-001', ...d03 },
  { id: 'del-04', storeId: 'store-04', plantId: 'plant-01', date: '2026-03-02', status: 'reconciled', drNumber: 'DR-DRG-20260302-001', ...d04 },
  { id: 'del-05', storeId: 'store-06', plantId: 'plant-01', date: '2026-03-02', status: 'delivered', drNumber: 'DR-DRG-20260302-002', ...d05 },
  { id: 'del-06', storeId: 'store-12', plantId: 'plant-02', date: '2026-03-03', status: 'delivered', drNumber: 'DR-MNL-20260303-001', ...d06 },
  { id: 'del-07', storeId: 'store-18', plantId: 'plant-03', date: '2026-03-03', status: 'delivered', drNumber: 'DR-CEB-20260303-001', ...d07 },
  { id: 'del-08', storeId: 'store-15', plantId: 'plant-02', date: '2026-03-04', status: 'delivered', drNumber: 'DR-MNL-20260304-001', ...d08 },
  { id: 'del-09', storeId: 'store-19', plantId: 'plant-03', date: '2026-03-05', status: 'in_transit', drNumber: 'DR-CEB-20260305-001', ...d09 },
  { id: 'del-10', storeId: 'store-03', plantId: 'plant-01', date: '2026-03-05', status: 'in_transit', drNumber: 'DR-DRG-20260305-001', ...d10 },
  { id: 'del-11', storeId: 'store-10', plantId: 'plant-02', date: '2026-03-06', status: 'reconciled', drNumber: 'DR-MNL-20260306-001', ...d11 },
  { id: 'del-12', storeId: 'store-20', plantId: 'plant-03', date: '2026-03-07', status: 'delivered', drNumber: 'DR-CEB-20260307-001', ...d12 },
  { id: 'del-13', storeId: 'store-22', plantId: 'plant-03', date: '2026-03-08', status: 'scheduled', drNumber: 'DR-CEB-20260308-001', ...d13 },
  { id: 'del-14', storeId: 'store-05', plantId: 'plant-01', date: '2026-03-10', status: 'reconciled', drNumber: 'DR-DRG-20260310-001', ...d14 },
  { id: 'del-15', storeId: 'store-16', plantId: 'plant-02', date: '2026-03-12', status: 'delivered', drNumber: 'DR-MNL-20260312-001', ...d15 },
  { id: 'del-16', storeId: 'store-21', plantId: 'plant-03', date: '2026-03-14', status: 'in_transit', drNumber: 'DR-CEB-20260314-001', ...d16 },
  { id: 'del-17', storeId: 'store-07', plantId: 'plant-01', date: '2026-03-15', status: 'scheduled', drNumber: 'DR-DRG-20260315-001', ...d17 },
  { id: 'del-18', storeId: 'store-12', plantId: 'plant-02', date: '2026-03-16', status: 'reconciled', drNumber: 'DR-MNL-20260316-001', ...d18 },
  { id: 'del-19', storeId: 'store-23', plantId: 'plant-03', date: '2026-03-18', status: 'delivered', drNumber: 'DR-CEB-20260318-001', ...d19 },
  { id: 'del-20', storeId: 'store-24', plantId: 'plant-03', date: '2026-03-19', status: 'scheduled', drNumber: 'DR-CEB-20260319-001', ...d20 },
  { id: 'del-21', storeId: 'store-11', plantId: 'plant-02', date: '2026-03-20', status: 'scheduled', drNumber: 'DR-MNL-20260320-001', ...d21 },
  { id: 'del-22', storeId: 'store-26', plantId: 'plant-01', date: '2026-03-22', status: 'scheduled', drNumber: 'DR-DRG-20260322-001', ...d22 },
];

// ─── Billing Records ─────────────────────────────────────────

// Billing records are now computed at runtime from approved Ending Inventory
// submissions + Special Orders + Packaging Orders by src/lib/billingComputations.ts.
// Mock data lives in the upstream entities; this slice is hydrated by the store
// initializer and recomputed on each relevant mutation.
export const billingRecords: BillingRecord[] = [];

// ─── Payments ────────────────────────────────────────────────

export const payments: Payment[] = [
  {
    id: 'pay-01', billingId: 'bill-01', storeId: 'store-01', amount: 17550, method: 'gateway',
    referenceNumber: 'GW-20260310-001', datePaid: '2026-03-10', proofUrl: '/uploads/payments/pay-01.jpg',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-10T14:30:00Z',
  },
  {
    id: 'pay-02', billingId: 'bill-02', storeId: 'store-02', amount: 14650, method: 'manual',
    referenceNumber: 'BDO-20260312-7829', datePaid: '2026-03-12', proofUrl: '/uploads/payments/pay-02.jpg',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-12T09:00:00Z',
  },
  {
    id: 'pay-03', billingId: 'bill-05', storeId: 'store-09', amount: 23200, method: 'gateway',
    referenceNumber: 'GW-20260308-002', datePaid: '2026-03-08',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-08T11:00:00Z',
  },
  {
    id: 'pay-04', billingId: 'bill-07', storeId: 'store-12', amount: 26800, method: 'gateway',
    referenceNumber: 'GW-20260305-003', datePaid: '2026-03-05',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-05T16:00:00Z',
  },
  {
    id: 'pay-05', billingId: 'bill-09', storeId: 'store-18', amount: 16950, method: 'manual',
    referenceNumber: 'BPI-20260311-4512', datePaid: '2026-03-11', proofUrl: '/uploads/payments/pay-05.jpg',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-11T10:00:00Z',
  },
  {
    id: 'pay-06', billingId: 'bill-15', storeId: 'store-20', amount: 17250, method: 'gateway',
    referenceNumber: 'GW-20260309-004', datePaid: '2026-03-09',
    status: 'verified', verifiedBy: 'user-05', submittedAt: '2026-03-09T13:00:00Z',
  },
  {
    id: 'pay-07', billingId: 'bill-03', storeId: 'store-04', amount: 11850, method: 'manual',
    referenceNumber: 'GCASH-20260318-9912', datePaid: '2026-03-18', proofUrl: '/uploads/payments/pay-07.jpg',
    status: 'submitted', submittedAt: '2026-03-18T15:00:00Z',
  },
  {
    id: 'pay-08', billingId: 'bill-06', storeId: 'store-10', amount: 18800, method: 'manual',
    referenceNumber: 'UB-20260319-3301', datePaid: '2026-03-19', proofUrl: '/uploads/payments/pay-08.jpg',
    status: 'submitted', submittedAt: '2026-03-19T08:30:00Z',
  },
  {
    id: 'pay-09', billingId: 'bill-10', storeId: 'store-19', amount: 19500, method: 'gateway',
    referenceNumber: 'GW-20260320-005', datePaid: '2026-03-20',
    status: 'submitted', submittedAt: '2026-03-20T10:00:00Z',
  },
  {
    id: 'pay-10', billingId: 'bill-04', storeId: 'store-06', amount: 10000, method: 'manual',
    referenceNumber: 'GCASH-20260316-1122', datePaid: '2026-03-16', proofUrl: '/uploads/payments/pay-10.jpg',
    status: 'rejected', rejectedReason: 'Partial payment not accepted. Full amount required.', submittedAt: '2026-03-16T11:00:00Z',
  },
  {
    id: 'pay-11', billingId: 'bill-08', storeId: 'store-15', amount: 19950, method: 'manual',
    referenceNumber: 'BDO-20260321-5567', datePaid: '2026-03-21', proofUrl: '/uploads/payments/pay-11.jpg',
    status: 'submitted', submittedAt: '2026-03-21T14:00:00Z',
  },
];

// ─── Packaging Items (Catalog) ───────────────────────────────

export const packagingItems: PackagingItem[] = [
  { id: 'pkg-01', name: 'ZAPP Box (6-pc)', description: 'Branded donut box for 6 pieces', price: 15, imageUrl: '/images/pkg/box-6.jpg', category: 'Boxes' },
  { id: 'pkg-02', name: 'ZAPP Box (12-pc)', description: 'Branded donut box for 12 pieces', price: 25, imageUrl: '/images/pkg/box-12.jpg', category: 'Boxes' },
  { id: 'pkg-03', name: 'ZAPP Paper Bag (Small)', description: 'Branded small paper bag', price: 5, imageUrl: '/images/pkg/bag-sm.jpg', category: 'Bags' },
  { id: 'pkg-04', name: 'ZAPP Paper Bag (Large)', description: 'Branded large paper bag', price: 8, imageUrl: '/images/pkg/bag-lg.jpg', category: 'Bags' },
  { id: 'pkg-05', name: 'ZAPP Tissue Pack (100 sheets)', description: 'Food-grade tissue paper pack', price: 35, imageUrl: '/images/pkg/tissue.jpg', category: 'Supplies' },
  { id: 'pkg-06', name: 'ZAPP Sticker Roll (500 pcs)', description: 'Branded seal stickers', price: 120, imageUrl: '/images/pkg/sticker.jpg', category: 'Branding' },
  { id: 'pkg-07', name: 'ZAPP Tray Liner (100 pcs)', description: 'Grease-proof tray liners', price: 45, imageUrl: '/images/pkg/liner.jpg', category: 'Supplies' },
  { id: 'pkg-08', name: 'ZAPP Cup (Hot, 12oz, 50 pcs)', description: 'Branded hot beverage cups', price: 90, imageUrl: '/images/pkg/cup-hot.jpg', category: 'Beverages' },
  { id: 'pkg-09', name: 'ZAPP Cup (Cold, 16oz, 50 pcs)', description: 'Branded cold beverage cups', price: 85, imageUrl: '/images/pkg/cup-cold.jpg', category: 'Beverages' },
  { id: 'pkg-10', name: 'ZAPP Crate Divider Set', description: 'Plastic crate dividers for delivery', price: 60, imageUrl: '/images/pkg/divider.jpg', category: 'Logistics' },
];

// ─── Packaging Orders ────────────────────────────────────────

export const packagingOrders: PackagingOrder[] = [
  {
    id: 'pkgord-01', storeId: 'store-01',
    items: [
      { packagingItemId: 'pkg-01', quantity: 50, price: 15 },
      { packagingItemId: 'pkg-03', quantity: 100, price: 5 },
      { packagingItemId: 'pkg-05', quantity: 3, price: 35 },
    ],
    totalAmount: 1355, status: 'billed', orderedAt: '2026-02-20T10:00:00Z', deliveryId: 'del-01',
  },
  {
    id: 'pkgord-02', storeId: 'store-09',
    items: [
      { packagingItemId: 'pkg-02', quantity: 80, price: 25 },
      { packagingItemId: 'pkg-04', quantity: 60, price: 8 },
      { packagingItemId: 'pkg-06', quantity: 2, price: 120 },
    ],
    totalAmount: 2720, status: 'billed', orderedAt: '2026-02-22T14:00:00Z', deliveryId: 'del-03',
  },
  {
    id: 'pkgord-03', storeId: 'store-12',
    items: [
      { packagingItemId: 'pkg-01', quantity: 100, price: 15 },
      { packagingItemId: 'pkg-02', quantity: 50, price: 25 },
      { packagingItemId: 'pkg-07', quantity: 5, price: 45 },
      { packagingItemId: 'pkg-08', quantity: 4, price: 90 },
    ],
    totalAmount: 3235, status: 'included_in_delivery', orderedAt: '2026-03-10T09:00:00Z', deliveryId: 'del-18',
  },
  {
    id: 'pkgord-04', storeId: 'store-18',
    items: [
      { packagingItemId: 'pkg-01', quantity: 40, price: 15 },
      { packagingItemId: 'pkg-03', quantity: 80, price: 5 },
    ],
    totalAmount: 1000, status: 'billed', orderedAt: '2026-02-25T11:30:00Z', deliveryId: 'del-07',
  },
  {
    id: 'pkgord-05', storeId: 'store-15',
    items: [
      { packagingItemId: 'pkg-02', quantity: 60, price: 25 },
      { packagingItemId: 'pkg-05', quantity: 4, price: 35 },
      { packagingItemId: 'pkg-09', quantity: 3, price: 85 },
    ],
    totalAmount: 1895, status: 'pending', orderedAt: '2026-03-20T16:00:00Z',
  },
  {
    id: 'pkgord-06', storeId: 'store-22',
    items: [
      { packagingItemId: 'pkg-01', quantity: 30, price: 15 },
      { packagingItemId: 'pkg-10', quantity: 2, price: 60 },
    ],
    totalAmount: 570, status: 'pending', orderedAt: '2026-03-21T08:00:00Z',
  },
];

// ─── Forecasts ───────────────────────────────────────────────

function buildForecastItems1(): ForecastItem[] {
  return [
    { skuId: 'sku-01', skuName: 'Classic Glazed', avg14Day: 48, unsoldAdjustment: -3, dayOfWeekAdjustment: 5, demandPressure: 'hot', pressureModifier: 1.15, finalForecast: 58, actualSold: 55 },
    { skuId: 'sku-02', skuName: 'Chocolate Ring', avg14Day: 38, unsoldAdjustment: -2, dayOfWeekAdjustment: 3, demandPressure: 'hot', pressureModifier: 1.10, finalForecast: 43, actualSold: 41 },
    { skuId: 'sku-03', skuName: 'Bavarian Cream', avg14Day: 30, unsoldAdjustment: -4, dayOfWeekAdjustment: 2, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 28, actualSold: 27 },
    { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', avg14Day: 22, unsoldAdjustment: -1, dayOfWeekAdjustment: 4, demandPressure: 'hot', pressureModifier: 1.12, finalForecast: 28, actualSold: 26 },
    { skuId: 'sku-07', skuName: 'Matcha Glazed', avg14Day: 18, unsoldAdjustment: -5, dayOfWeekAdjustment: 1, demandPressure: 'weak', pressureModifier: 0.90, finalForecast: 13 },
    { skuId: 'sku-09', skuName: 'Cinnamon Sugar', avg14Day: 25, unsoldAdjustment: -2, dayOfWeekAdjustment: 3, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 26, actualSold: 24 },
    { skuId: 'sku-14', skuName: 'Red Velvet', avg14Day: 20, unsoldAdjustment: -1, dayOfWeekAdjustment: 6, demandPressure: 'hot', pressureModifier: 1.20, finalForecast: 30, actualSold: 29 },
  ];
}

function buildForecastItems2(): ForecastItem[] {
  return [
    { skuId: 'sku-01', skuName: 'Classic Glazed', avg14Day: 62, unsoldAdjustment: -5, dayOfWeekAdjustment: 8, demandPressure: 'hot', pressureModifier: 1.18, finalForecast: 77, actualSold: 72 },
    { skuId: 'sku-02', skuName: 'Chocolate Ring', avg14Day: 50, unsoldAdjustment: -3, dayOfWeekAdjustment: 5, demandPressure: 'hot', pressureModifier: 1.10, finalForecast: 57, actualSold: 54 },
    { skuId: 'sku-04', skuName: 'Ube Cheese', avg14Day: 35, unsoldAdjustment: -6, dayOfWeekAdjustment: 2, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 31 },
    { skuId: 'sku-06', skuName: 'Cookies & Cream', avg14Day: 28, unsoldAdjustment: -2, dayOfWeekAdjustment: 4, demandPressure: 'normal', pressureModifier: 1.05, finalForecast: 32, actualSold: 30 },
    { skuId: 'sku-08', skuName: 'Salted Caramel', avg14Day: 24, unsoldAdjustment: -3, dayOfWeekAdjustment: 3, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 24 },
    { skuId: 'sku-11', skuName: 'Mango Graham', avg14Day: 15, unsoldAdjustment: -4, dayOfWeekAdjustment: 1, demandPressure: 'weak', pressureModifier: 0.85, finalForecast: 10 },
    { skuId: 'sku-15', skuName: 'Caramel Macchiato', avg14Day: 19, unsoldAdjustment: -1, dayOfWeekAdjustment: 5, demandPressure: 'hot', pressureModifier: 1.15, finalForecast: 26 },
  ];
}

function buildForecastItems3(): ForecastItem[] {
  return [
    { skuId: 'sku-01', skuName: 'Classic Glazed', avg14Day: 40, unsoldAdjustment: -2, dayOfWeekAdjustment: 4, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 42 },
    { skuId: 'sku-03', skuName: 'Bavarian Cream', avg14Day: 25, unsoldAdjustment: -3, dayOfWeekAdjustment: 2, demandPressure: 'normal', pressureModifier: 1.00, finalForecast: 24 },
    { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', avg14Day: 18, unsoldAdjustment: -1, dayOfWeekAdjustment: 3, demandPressure: 'normal', pressureModifier: 1.05, finalForecast: 21 },
    { skuId: 'sku-10', skuName: 'Pandan Cream', avg14Day: 22, unsoldAdjustment: -4, dayOfWeekAdjustment: 1, demandPressure: 'weak', pressureModifier: 0.88, finalForecast: 17 },
    { skuId: 'sku-12', skuName: 'Double Choco', avg14Day: 30, unsoldAdjustment: -2, dayOfWeekAdjustment: 5, demandPressure: 'hot', pressureModifier: 1.12, finalForecast: 37 },
    { skuId: 'sku-16', skuName: 'Blueberry Burst', avg14Day: 14, unsoldAdjustment: -3, dayOfWeekAdjustment: 0, demandPressure: 'weak', pressureModifier: 0.90, finalForecast: 10 },
  ];
}

export const forecasts: Forecast[] = [
  { id: 'fc-01', storeId: 'store-01', date: '2026-03-22', items: buildForecastItems1(), createdBy: 'user-03', status: 'approved' },
  { id: 'fc-02', storeId: 'store-09', date: '2026-03-22', items: buildForecastItems2(), createdBy: 'user-03', status: 'approved' },
  { id: 'fc-03', storeId: 'store-12', date: '2026-03-22', items: buildForecastItems2(), createdBy: 'user-03', status: 'submitted' },
  { id: 'fc-04', storeId: 'store-18', date: '2026-03-22', items: buildForecastItems3(), createdBy: 'user-03', status: 'submitted' },
  { id: 'fc-05', storeId: 'store-15', date: '2026-03-23', items: buildForecastItems1(), createdBy: 'user-03', status: 'draft' },
  { id: 'fc-06', storeId: 'store-22', date: '2026-03-23', items: buildForecastItems3(), createdBy: 'user-03', status: 'draft' },
  { id: 'fc-07', storeId: 'store-06', date: '2026-03-23', items: buildForecastItems1(), createdBy: 'user-03', status: 'approved' },
  { id: 'fc-08', storeId: 'store-20', date: '2026-03-23', items: buildForecastItems3(), createdBy: 'user-03', status: 'submitted' },
];

// ─── Referral Codes ──────────────────────────────────────────

export const referralCodes: ReferralCode[] = [
  { id: 'ref-01', code: 'BICOL-MARCO', type: 'distributor', distributorId: 'dist-01', plantId: 'plant-01', status: 'active', createdAt: '2025-05-01', usageCount: 4 },
  { id: 'ref-02', code: 'CAMSUR-LIZA', type: 'distributor', distributorId: 'dist-02', plantId: 'plant-01', status: 'active', createdAt: '2025-05-15', usageCount: 3 },
  { id: 'ref-03', code: 'METRO-RICK', type: 'distributor', distributorId: 'dist-03', plantId: 'plant-02', status: 'active', createdAt: '2025-04-20', usageCount: 6 },
  { id: 'ref-04', code: 'QC-ANGELA', type: 'distributor', distributorId: 'dist-04', plantId: 'plant-02', status: 'active', createdAt: '2025-05-10', usageCount: 3 },
  { id: 'ref-05', code: 'VIS-JOSE', type: 'distributor', distributorId: 'dist-05', plantId: 'plant-03', status: 'active', createdAt: '2025-05-20', usageCount: 5 },
  { id: 'ref-06', code: 'ZAPP-INT-001', type: 'zapp_internal', areaSupervisorId: 'am-06', plantId: 'plant-02', status: 'active', createdAt: '2025-06-01', usageCount: 2 },
  { id: 'ref-07', code: 'ZAPP-INT-002', type: 'zapp_internal', areaSupervisorId: 'am-02', plantId: 'plant-01', status: 'active', createdAt: '2025-06-15', usageCount: 1 },
  { id: 'ref-08', code: 'ZAPP-INT-003', type: 'zapp_internal', areaSupervisorId: 'am-07', plantId: 'plant-03', status: 'active', createdAt: '2025-07-01', usageCount: 1 },
  { id: 'ref-09', code: 'BICOL-PROMO-2025', type: 'zapp_internal', areaSupervisorId: 'am-01', plantId: 'plant-01', status: 'inactive', createdAt: '2025-03-01', usageCount: 8 },
  { id: 'ref-10', code: 'MNL-LAUNCH', type: 'zapp_internal', areaSupervisorId: 'am-04', plantId: 'plant-02', status: 'inactive', createdAt: '2025-04-01', usageCount: 12 },
  { id: 'ref-11', code: 'CEBU-SUMMER', type: 'zapp_internal', areaSupervisorId: 'am-07', plantId: 'plant-03', status: 'inactive', createdAt: '2025-04-15', usageCount: 7 },
  { id: 'ref-12', code: 'DIST-MARCO-VIP', type: 'distributor', distributorId: 'dist-01', plantId: 'plant-01', status: 'active', createdAt: '2025-11-01', usageCount: 1 },
  { id: 'ref-13', code: 'DIST-LIZA-SPECIAL', type: 'distributor', distributorId: 'dist-02', plantId: 'plant-01', status: 'active', createdAt: '2025-11-15', usageCount: 0 },
  { id: 'ref-14', code: 'ZAPP-2026-Q1', type: 'zapp_internal', areaSupervisorId: 'am-05', plantId: 'plant-02', status: 'active', createdAt: '2026-01-01', usageCount: 3 },
  { id: 'ref-15', code: 'CEBU-Q1-2026', type: 'zapp_internal', areaSupervisorId: 'am-08', plantId: 'plant-03', status: 'active', createdAt: '2026-01-01', usageCount: 2 },
  { id: 'ref-16', code: 'QC-ANGELA-VIP', type: 'distributor', distributorId: 'dist-04', plantId: 'plant-02', status: 'active', createdAt: '2026-01-15', usageCount: 1 },
  { id: 'ref-17', code: 'DIST-JOSE-2026', type: 'distributor', distributorId: 'dist-05', plantId: 'plant-03', status: 'active', createdAt: '2026-02-01', usageCount: 0 },
  { id: 'ref-18', code: 'ZAPP-BICOL-MAR', type: 'zapp_internal', areaSupervisorId: 'am-01', plantId: 'plant-01', status: 'active', createdAt: '2026-03-01', usageCount: 0 },
  { id: 'ref-19', code: 'MNL-SPRING-2026', type: 'zapp_internal', areaSupervisorId: 'am-04', plantId: 'plant-02', status: 'active', createdAt: '2026-03-01', usageCount: 1 },
  { id: 'ref-20', code: 'CEBU-FIESTA', type: 'zapp_internal', areaSupervisorId: 'am-07', plantId: 'plant-03', status: 'active', createdAt: '2026-01-10', usageCount: 4 },
  // Sub-Partner (SPD) channel code — routes an onboarding application to spd-01
  // (under parent PD dist-01). Lets the system tell PD vs SPD vs direct.
  { id: 'ref-21', code: 'SPD-MARIEL', type: 'sub_partner_distributor', distributorId: 'dist-01', subPartnerDistributorId: 'spd-01', plantId: 'plant-01', status: 'active', createdAt: '2026-03-01', usageCount: 0 },
];

// ─── Sales Metrics (35 days across 12 stores) ────────────────

function generateSalesMetrics(): SalesMetric[] {
  const metrics: SalesMetric[] = [];
  const storeInfos: { storeId: string; storeName: string; area: string; province: string; plantId: string; distributorId?: string; baseDR: number }[] = [
    { storeId: 'store-01', storeName: 'ZAPP Legazpi Centro', area: 'Legazpi City', province: 'Albay', plantId: 'plant-01', distributorId: 'dist-01', baseDR: 2200 },
    { storeId: 'store-02', storeName: 'ZAPP Daraga Market', area: 'Daraga', province: 'Albay', plantId: 'plant-01', distributorId: 'dist-01', baseDR: 1800 },
    { storeId: 'store-04', storeName: 'ZAPP Tabaco Plaza', area: 'Tabaco', province: 'Albay', plantId: 'plant-01', distributorId: 'dist-01', baseDR: 1500 },
    { storeId: 'store-06', storeName: 'ZAPP Naga Centro', area: 'Naga City', province: 'Camarines Sur', plantId: 'plant-01', distributorId: 'dist-02', baseDR: 2000 },
    { storeId: 'store-09', storeName: 'ZAPP Tondo Main', area: 'Tondo', province: 'Manila', plantId: 'plant-02', distributorId: 'dist-03', baseDR: 3200 },
    { storeId: 'store-10', storeName: 'ZAPP Sampaloc University', area: 'Sampaloc', province: 'Manila', plantId: 'plant-02', distributorId: 'dist-03', baseDR: 2800 },
    { storeId: 'store-12', storeName: 'ZAPP Makati Ayala', area: 'Makati CBD', province: 'Makati', plantId: 'plant-02', distributorId: 'dist-03', baseDR: 3800 },
    { storeId: 'store-15', storeName: 'ZAPP Cubao Gateway', area: 'Cubao', province: 'Quezon City', plantId: 'plant-02', distributorId: 'dist-04', baseDR: 2600 },
    { storeId: 'store-18', storeName: 'ZAPP Colon St', area: 'Cebu City', province: 'Cebu', plantId: 'plant-03', distributorId: 'dist-05', baseDR: 2100 },
    { storeId: 'store-19', storeName: 'ZAPP Ayala Cebu', area: 'Cebu City', province: 'Cebu', plantId: 'plant-03', distributorId: 'dist-05', baseDR: 2500 },
    { storeId: 'store-20', storeName: 'ZAPP IT Park', area: 'Cebu City', province: 'Cebu', plantId: 'plant-03', baseDR: 2300 },
    { storeId: 'store-22', storeName: 'ZAPP Lapu-Lapu Marina', area: 'Lapu-Lapu', province: 'Cebu', plantId: 'plant-03', distributorId: 'dist-05', baseDR: 1700 },
  ];

  // Generate 35 days of data: Feb 17 - Mar 23, 2026
  for (let dayOffset = 0; dayOffset < 35; dayOffset++) {
    const dateObj = new Date(2026, 1, 17 + dayOffset); // month 1 = February
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const si of storeInfos) {
      const weekendMul = isWeekend ? 1.25 : 1.0;
      // Deterministic pseudo-random variance based on day + store
      const hash = (dayOffset * 7 + si.storeId.charCodeAt(si.storeId.length - 1)) % 41;
      const variance = 0.8 + (hash / 41) * 0.4; // range: 0.80 - 1.20
      const drSales = Math.round(si.baseDR * variance * weekendMul);
      const srpSales = Math.round(drSales * 1.65);

      metrics.push({
        storeId: si.storeId,
        storeName: si.storeName,
        area: si.area,
        province: si.province,
        plantId: si.plantId,
        distributorId: si.distributorId,
        drSales,
        srpSales,
        period: `${yyyy}-${mm}`,
        date: dateStr,
      });
    }
  }

  return metrics;
}

export const salesMetrics: SalesMetric[] = generateSalesMetrics();

// ─── Users (10 demo users - one per role) ────────────────────

export const users: User[] = [
  {
    id: 'user-01', name: 'Alfonso Zapp', email: 'alfonso@zappdonuts.com', role: 'owner',
    avatar: 'https://ui-avatars.com/api/?name=Alfonso+Zapp&background=F59E0B&color=fff',
  },
  {
    id: 'user-02', name: 'Diana Reyes', email: 'diana@zappdonuts.com', role: 'operations_manager',
    avatar: 'https://ui-avatars.com/api/?name=Diana+Reyes&background=8B5CF6&color=fff',
  },
  {
    id: 'user-03', name: 'Gabriel Tan', email: 'gabriel@zappdonuts.com', role: 'forecaster',
    avatar: 'https://ui-avatars.com/api/?name=Gabriel+Tan&background=3B82F6&color=fff',
    plantId: 'plant-02',
  },
  {
    id: 'user-04', name: 'Helen Bautista', email: 'helen@zappdonuts.com', role: 'plant_manager',
    avatar: 'https://ui-avatars.com/api/?name=Helen+Bautista&background=10B981&color=fff',
    plantId: 'plant-01',
  },
  {
    id: 'user-05', name: 'Ivan Cruz', email: 'ivan@zappdonuts.com', role: 'billing_user',
    avatar: 'https://ui-avatars.com/api/?name=Ivan+Cruz&background=EF4444&color=fff',
  },
  {
    id: 'user-06', name: 'Marco Villanueva', email: 'marco@zappdonuts.com', role: 'partner_distributor',
    avatar: 'https://ui-avatars.com/api/?name=Marco+Villanueva&background=F97316&color=fff',
    distributorId: 'dist-01', plantId: 'plant-01',
  },
  {
    id: 'user-07', name: 'Maria Santos', email: 'legazpi.centro@zappdonuts.com', role: 'franchisee_distributor',
    avatar: 'https://ui-avatars.com/api/?name=Maria+Santos&background=EC4899&color=fff',
    plantId: 'plant-01', distributorId: 'dist-01', assignedStoreIds: ['store-01'],
  },
  {
    id: 'user-08', name: 'Ana Lim', email: 'legazpi.port@zappdonuts.com', role: 'franchisee_direct',
    avatar: 'https://ui-avatars.com/api/?name=Ana+Lim&background=06B6D4&color=fff',
    plantId: 'plant-01', assignedStoreIds: ['store-03'],
  },
  {
    id: 'user-09', name: 'Patricia Bautista', email: 'patricia@zappdonuts.com', role: 'area_manager',
    avatar: 'https://ui-avatars.com/api/?name=Patricia+Bautista&background=84CC16&color=fff',
    plantId: 'plant-01', areaIds: ['area-albay-01', 'area-albay-02'], assignedStoreIds: ['store-01', 'store-02', 'store-03', 'store-05'],
  },
  {
    id: 'user-10', name: 'Ricardo Santos', email: 'ricardo@zappdonuts.com', role: 'partner_distributor',
    avatar: 'https://ui-avatars.com/api/?name=Ricardo+Santos&background=A855F7&color=fff',
    distributorId: 'dist-03', plantId: 'plant-02',
  },
  {
    id: 'user-11', name: 'Mariel Tan', email: 'mariel@zappdonuts.com', role: 'sub_partner_distributor',
    avatar: 'https://ui-avatars.com/api/?name=Mariel+Tan&background=14B8A6&color=fff',
    distributorId: 'dist-01', subPartnerDistributorId: 'spd-01', plantId: 'plant-01',
  },
];

// ─── Notifications ───────────────────────────────────────────

export const notifications: Notification[] = [
  {
    id: 'notif-01', title: 'New Franchise Application', message: 'Jasmine Reyes submitted an application for ZAPP Iriga City.',
    type: 'info', read: false, createdAt: '2026-03-10T09:30:00Z', targetRole: 'operations_manager',
  },
  {
    id: 'notif-02', title: 'Payment Received', message: 'Store ZAPP Legazpi Centro has submitted payment of PHP 17,550 for Feb 2026 billing.',
    type: 'success', read: true, createdAt: '2026-03-10T14:30:00Z', targetRole: 'billing_user',
  },
  {
    id: 'notif-03', title: 'Overdue Billing Alert', message: 'ZAPP Naga Centro (bill-04) is overdue. Total payable: PHP 16,000.',
    type: 'warning', read: false, createdAt: '2026-03-16T00:00:00Z', targetRole: 'billing_user',
  },
  {
    id: 'notif-04', title: 'Delivery Scheduled', message: 'Delivery DR-DRG-20260322-001 scheduled for ZAPP Sorsogon Town on Mar 22.',
    type: 'info', read: false, createdAt: '2026-03-20T08:00:00Z', targetRole: 'plant_manager',
  },
  {
    id: 'notif-05', title: 'Forecast Approved', message: 'Forecast for ZAPP Legazpi Centro (Mar 22) has been approved.',
    type: 'success', read: true, createdAt: '2026-03-21T10:00:00Z', targetRole: 'forecaster',
  },
  {
    id: 'notif-06', title: 'Payment Rejected', message: 'Partial payment from ZAPP Naga Centro was rejected. Full amount required.',
    type: 'error', read: false, createdAt: '2026-03-17T09:00:00Z', targetRole: 'franchisee_distributor',
  },
  {
    id: 'notif-07', title: 'New Application Submitted', message: 'Benedict Co applied for ZAPP Mandaue Pacific franchise.',
    type: 'info', read: false, createdAt: '2026-03-18T10:45:00Z', targetRole: 'operations_manager',
  },
  {
    id: 'notif-08', title: 'Store Blocked', message: 'ZAPP Talisay South has been blocked due to compliance issues.',
    type: 'error', read: true, createdAt: '2026-03-15T14:00:00Z', targetRole: 'area_manager',
  },
  {
    id: 'notif-09', title: 'Packaging Order Placed', message: 'ZAPP Cubao Gateway placed a packaging order totaling PHP 1,895.',
    type: 'info', read: false, createdAt: '2026-03-20T16:00:00Z', targetRole: 'plant_manager',
  },
  {
    id: 'notif-10', title: 'Delivery Completed', message: 'Delivery DR-MNL-20260306-001 to ZAPP Sampaloc University has been reconciled.',
    type: 'success', read: true, createdAt: '2026-03-07T17:00:00Z', targetRole: 'plant_manager',
  },
  {
    id: 'notif-11', title: 'Overdue Billing Alert', message: 'ZAPP Cubao Gateway (bill-08) is overdue. Total payable: PHP 19,950.',
    type: 'warning', read: false, createdAt: '2026-03-16T00:00:00Z', targetRole: 'billing_user',
  },
  {
    id: 'notif-12', title: 'Application Approved', message: 'Application for ZAPP Pasig Kapitolyo by Armando Diaz has been approved.',
    type: 'success', read: true, createdAt: '2026-02-25T10:00:00Z', targetRole: 'operations_manager',
  },
  {
    id: 'notif-13', title: 'New Referral Code Created', message: 'Referral code ZAPP-BICOL-MAR has been created for Bicol region.',
    type: 'info', read: false, createdAt: '2026-03-01T08:00:00Z', targetRole: 'owner',
  },
  {
    id: 'notif-14', title: 'Forecast Pending Review', message: '2 forecasts for Mar 23 are awaiting approval.',
    type: 'warning', read: false, createdAt: '2026-03-22T18:00:00Z', targetRole: 'plant_manager',
  },
  {
    id: 'notif-15', title: 'AI Inventory Processed', message: 'AI crate estimation completed for delivery DR-MNL-20260301-001.',
    type: 'info', read: true, createdAt: '2026-03-01T06:30:00Z', targetRole: 'area_manager',
  },
];

// ─── Beginning & Ending Inventories ──────────────────────────

export const beginningInventories: BeginningInventory[] = [
  {
    id: 'bi-01', deliveryId: 'del-01', storeId: 'store-01', date: '2026-03-01',
    drImageUrl: '/uploads/inventory/bi-01-dr.jpg',
    crateImageUrls: ['/uploads/inventory/bi-01-crate1.jpg', '/uploads/inventory/bi-01-crate2.jpg'],
    aiResults: [
      { id: 'air-01', type: 'ocr_dr', skuId: 'sku-01', skuName: 'Classic Glazed', extractedValue: 50, confidence: 'high' },
      { id: 'air-02', type: 'ocr_dr', skuId: 'sku-02', skuName: 'Chocolate Ring', extractedValue: 40, confidence: 'high' },
      { id: 'air-03', type: 'crate_estimate', skuId: 'sku-03', skuName: 'Bavarian Cream', estimatedValue: 29, confidence: 'medium', warning: 'Estimated 29 vs DR qty 30' },
      { id: 'air-04', type: 'crate_estimate', skuId: 'sku-05', skuName: 'Strawberry Sprinkle', estimatedValue: 25, confidence: 'high' },
      { id: 'air-05', type: 'crate_estimate', skuId: 'sku-09', skuName: 'Cinnamon Sugar', estimatedValue: 20, confidence: 'high' },
    ],
    confirmedItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 50, aiEstimate: 50, confidence: 'high' },
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 40, aiEstimate: 40, confidence: 'high' },
      { skuId: 'sku-03', skuName: 'Bavarian Cream', quantity: 30, aiEstimate: 29, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', quantity: 25, aiEstimate: 25, confidence: 'high' },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 20, aiEstimate: 20, confidence: 'high' },
    ],
    status: 'confirmed',
  },
  {
    id: 'bi-02', deliveryId: 'del-03', storeId: 'store-09', date: '2026-03-01',
    drImageUrl: '/uploads/inventory/bi-02-dr.jpg',
    crateImageUrls: ['/uploads/inventory/bi-02-crate1.jpg', '/uploads/inventory/bi-02-crate2.jpg', '/uploads/inventory/bi-02-crate3.jpg'],
    aiResults: [
      { id: 'air-06', type: 'ocr_dr', skuId: 'sku-01', skuName: 'Classic Glazed', extractedValue: 80, confidence: 'high' },
      { id: 'air-07', type: 'ocr_dr', skuId: 'sku-02', skuName: 'Chocolate Ring', extractedValue: 60, confidence: 'high' },
      { id: 'air-08', type: 'crate_estimate', skuId: 'sku-07', skuName: 'Matcha Glazed', estimatedValue: 38, confidence: 'medium', warning: 'Crate partially obscured' },
      { id: 'air-09', type: 'discrepancy', skuId: 'sku-11', skuName: 'Mango Graham', extractedValue: 30, estimatedValue: 28, confidence: 'low', warning: 'DR says 30, crate estimate 28' },
    ],
    confirmedItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 80, aiEstimate: 80, confidence: 'high' },
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 60, aiEstimate: 60, confidence: 'high' },
      { skuId: 'sku-03', skuName: 'Bavarian Cream', quantity: 50, aiEstimate: 50, confidence: 'high' },
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 40, aiEstimate: 38, confidence: 'medium', discrepancy: 2, manualOverride: true },
      { skuId: 'sku-11', skuName: 'Mango Graham', quantity: 30, aiEstimate: 28, confidence: 'low', discrepancy: 2, manualOverride: true },
      { skuId: 'sku-14', skuName: 'Red Velvet', quantity: 25, aiEstimate: 25, confidence: 'high' },
    ],
    status: 'confirmed',
  },
  {
    id: 'bi-03', deliveryId: 'del-06', storeId: 'store-12', date: '2026-03-03',
    drImageUrl: '/uploads/inventory/bi-03-dr.jpg',
    crateImageUrls: ['/uploads/inventory/bi-03-crate1.jpg'],
    aiResults: [
      { id: 'air-10', type: 'ocr_dr', skuId: 'sku-01', skuName: 'Classic Glazed', extractedValue: 70, confidence: 'high' },
      { id: 'air-11', type: 'crate_estimate', skuId: 'sku-04', skuName: 'Ube Cheese', estimatedValue: 40, confidence: 'high' },
    ],
    confirmedItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 70, aiEstimate: 70, confidence: 'high' },
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 50, aiEstimate: 50, confidence: 'high' },
      { skuId: 'sku-04', skuName: 'Ube Cheese', quantity: 40, aiEstimate: 40, confidence: 'high' },
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 35, aiEstimate: 35, confidence: 'high' },
    ],
    status: 'confirmed',
  },
  {
    id: 'bi-04', deliveryId: 'del-11', storeId: 'store-10', date: '2026-03-06',
    drImageUrl: '/uploads/inventory/bi-04-dr.jpg',
    crateImageUrls: ['/uploads/inventory/bi-04-crate1.jpg', '/uploads/inventory/bi-04-crate2.jpg'],
    aiResults: [
      { id: 'air-12', type: 'ocr_dr', skuId: 'sku-01', skuName: 'Classic Glazed', extractedValue: 75, confidence: 'high' },
      { id: 'air-13', type: 'ocr_dr', skuId: 'sku-02', skuName: 'Chocolate Ring', extractedValue: 55, confidence: 'high' },
      { id: 'air-14', type: 'crate_estimate', skuId: 'sku-10', skuName: 'Pandan Cream', estimatedValue: 24, confidence: 'medium', warning: 'Cream donuts hard to distinguish' },
    ],
    confirmedItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 75, aiEstimate: 75, confidence: 'high' },
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 55, aiEstimate: 55, confidence: 'high' },
      { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', quantity: 40, aiEstimate: 40, confidence: 'high' },
      { skuId: 'sku-08', skuName: 'Salted Caramel', quantity: 30, aiEstimate: 30, confidence: 'high' },
      { skuId: 'sku-10', skuName: 'Pandan Cream', quantity: 25, aiEstimate: 24, confidence: 'medium', discrepancy: 1, manualOverride: true },
    ],
    status: 'confirmed',
  },
];

export const endingInventories: EndingInventory[] = [
  // ei-01: store-01 (distributor dist-01) — fresh submission, awaiting PD (user-06) review
  {
    id: 'ei-01', deliveryId: 'del-01', storeId: 'store-01', date: '2026-03-01',
    crateImageUrls: ['/uploads/inventory/ei-01-crate1.jpg'],
    unsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 3, aiEstimate: 3, confidence: 'high' },
      { skuId: 'sku-03', skuName: 'Bavarian Cream', quantity: 5, aiEstimate: 4, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-20', type: 'crate_estimate', skuId: 'sku-01', skuName: 'Classic Glazed', estimatedValue: 3, confidence: 'high' },
      { id: 'air-21', type: 'crate_estimate', skuId: 'sku-03', skuName: 'Bavarian Cream', estimatedValue: 4, confidence: 'medium', warning: 'Possibly 4 or 5 unsold' },
      { id: 'air-22', type: 'crate_estimate', skuId: 'sku-09', skuName: 'Cinnamon Sugar', estimatedValue: 2, confidence: 'high' },
    ],
    status: 'pending_review',
    submittedAt: '2026-03-01T19:30:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 3, aiEstimate: 3, confidence: 'high' },
      { skuId: 'sku-03', skuName: 'Bavarian Cream', quantity: 5, aiEstimate: 4, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-01-01', action: 'submitted', performedBy: 'user-07',
        performedAt: '2026-03-01T19:30:00Z',
        comment: 'End-of-day inventory submitted for review.',
      },
    ],
  },

  // ei-02: store-09 (distributor) — PD flagged for clarification
  {
    id: 'ei-02', deliveryId: 'del-03', storeId: 'store-09', date: '2026-03-01',
    crateImageUrls: ['/uploads/inventory/ei-02-crate1.jpg', '/uploads/inventory/ei-02-crate2.jpg'],
    unsoldItems: [
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 8, aiEstimate: 8, confidence: 'high' },
      { skuId: 'sku-11', skuName: 'Mango Graham', quantity: 6, aiEstimate: 5, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-14', skuName: 'Red Velvet', quantity: 4, aiEstimate: 4, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-23', type: 'crate_estimate', skuId: 'sku-07', skuName: 'Matcha Glazed', estimatedValue: 8, confidence: 'high' },
      { id: 'air-24', type: 'crate_estimate', skuId: 'sku-11', skuName: 'Mango Graham', estimatedValue: 5, confidence: 'medium' },
      { id: 'air-25', type: 'crate_estimate', skuId: 'sku-14', skuName: 'Red Velvet', estimatedValue: 4, confidence: 'high' },
    ],
    status: 'needs_review',
    submittedAt: '2026-03-01T20:00:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 8, aiEstimate: 8, confidence: 'high' },
      { skuId: 'sku-11', skuName: 'Mango Graham', quantity: 6, aiEstimate: 5, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-14', skuName: 'Red Velvet', quantity: 4, aiEstimate: 4, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-02-01', action: 'submitted', performedBy: 'user-07',
        performedAt: '2026-03-01T20:00:00Z',
      },
      {
        id: 'eir-02-02', action: 'needs_review', performedBy: 'user-06',
        performedAt: '2026-03-02T09:00:00Z',
        comment: 'Mango Graham unsold count seems high vs AI estimate. Please confirm crate count with a clearer stockroom photo.',
      },
    ],
    reviewedBy: 'user-06',
    reviewedAt: '2026-03-02T09:00:00Z',
  },

  // ei-03: store-12 — PD requested correction with specific corrected figures
  {
    id: 'ei-03', deliveryId: 'del-06', storeId: 'store-12', date: '2026-03-03',
    crateImageUrls: ['/uploads/inventory/ei-03-crate1.jpg'],
    unsoldItems: [
      { skuId: 'sku-04', skuName: 'Ube Cheese', quantity: 5, aiEstimate: 5, confidence: 'high' },
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 7, aiEstimate: 7, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-26', type: 'crate_estimate', skuId: 'sku-04', skuName: 'Ube Cheese', estimatedValue: 5, confidence: 'high' },
      { id: 'air-27', type: 'crate_estimate', skuId: 'sku-07', skuName: 'Matcha Glazed', estimatedValue: 7, confidence: 'high' },
    ],
    status: 'correction_required',
    submittedAt: '2026-03-03T19:00:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-04', skuName: 'Ube Cheese', quantity: 5, aiEstimate: 5, confidence: 'high' },
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 7, aiEstimate: 7, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-03-01', action: 'submitted', performedBy: 'user-07',
        performedAt: '2026-03-03T19:00:00Z',
      },
      {
        id: 'eir-03-02', action: 'correction_requested', performedBy: 'user-06',
        performedAt: '2026-03-04T10:00:00Z',
        reason: 'Physical recount with store via video call shows different figures. Please resubmit with corrected quantities.',
        corrections: [
          { skuId: 'sku-04', skuName: 'Ube Cheese', submittedQty: 5, correctedQty: 3 },
          { skuId: 'sku-07', skuName: 'Matcha Glazed', submittedQty: 7, correctedQty: 8 },
        ],
      },
    ],
    reviewedBy: 'user-06',
    reviewedAt: '2026-03-04T10:00:00Z',
  },

  // ei-04: store-10 — clean approved
  {
    id: 'ei-04', deliveryId: 'del-11', storeId: 'store-10', date: '2026-03-06',
    crateImageUrls: ['/uploads/inventory/ei-04-crate1.jpg'],
    unsoldItems: [
      { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-08', skuName: 'Salted Caramel', quantity: 6, aiEstimate: 6, confidence: 'high' },
      { skuId: 'sku-10', skuName: 'Pandan Cream', quantity: 3, aiEstimate: 3, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-28', type: 'crate_estimate', skuId: 'sku-05', skuName: 'Strawberry Sprinkle', estimatedValue: 4, confidence: 'high' },
      { id: 'air-29', type: 'crate_estimate', skuId: 'sku-08', skuName: 'Salted Caramel', estimatedValue: 6, confidence: 'high' },
      { id: 'air-30', type: 'crate_estimate', skuId: 'sku-10', skuName: 'Pandan Cream', estimatedValue: 3, confidence: 'high' },
    ],
    status: 'approved',
    submittedAt: '2026-03-06T19:30:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-08', skuName: 'Salted Caramel', quantity: 6, aiEstimate: 6, confidence: 'high' },
      { skuId: 'sku-10', skuName: 'Pandan Cream', quantity: 3, aiEstimate: 3, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-04-01', action: 'submitted', performedBy: 'user-07',
        performedAt: '2026-03-06T19:30:00Z',
      },
      {
        id: 'eir-04-02', action: 'approved', performedBy: 'user-06',
        performedAt: '2026-03-06T21:00:00Z',
        comment: 'Figures match crate counts. Approved.',
      },
    ],
    reviewedBy: 'user-06',
    reviewedAt: '2026-03-06T21:00:00Z',
  },

  // ei-07 (NEW): store-02 (ZAPP Daraga Market — SPD spd-01 under PD dist-01) —
  // clean approved. Gives the PD's Sub-Partner (SPD) billing filter real data:
  // this store rolls into bill-store-02-2026-03-1-7 with a populated spdProfit.
  {
    id: 'ei-07', deliveryId: 'del-02', storeId: 'store-02', date: '2026-03-01',
    crateImageUrls: ['/uploads/inventory/ei-07-crate1.jpg'],
    unsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-06', skuName: 'Cookies & Cream', quantity: 3, aiEstimate: 3, confidence: 'high' },
      { skuId: 'sku-10', skuName: 'Pandan Cream', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-40', type: 'crate_estimate', skuId: 'sku-01', skuName: 'Classic Glazed', estimatedValue: 4, confidence: 'high' },
      { id: 'air-41', type: 'crate_estimate', skuId: 'sku-06', skuName: 'Cookies & Cream', estimatedValue: 3, confidence: 'high' },
      { id: 'air-42', type: 'crate_estimate', skuId: 'sku-10', skuName: 'Pandan Cream', estimatedValue: 2, confidence: 'high' },
    ],
    status: 'approved',
    submittedAt: '2026-03-01T19:45:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-06', skuName: 'Cookies & Cream', quantity: 3, aiEstimate: 3, confidence: 'high' },
      { skuId: 'sku-10', skuName: 'Pandan Cream', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-07-01', action: 'submitted', performedBy: 'user-07',
        performedAt: '2026-03-01T19:45:00Z',
      },
      {
        id: 'eir-07-02', action: 'approved', performedBy: 'user-06',
        performedAt: '2026-03-01T21:30:00Z',
        comment: 'Daraga crate counts match. Approved.',
      },
    ],
    reviewedBy: 'user-06',
    reviewedAt: '2026-03-01T21:30:00Z',
  },

  // ei-05 (NEW): store-03 (direct franchise) — in Area Supervisor user-09 (Patricia)'s queue, pending review
  {
    id: 'ei-05', deliveryId: 'del-10', storeId: 'store-03', date: '2026-03-05',
    crateImageUrls: ['/uploads/inventory/ei-05-crate1.jpg', '/uploads/inventory/ei-05-crate2.jpg'],
    unsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 6, aiEstimate: 5, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-06', skuName: 'Cookies & Cream', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-31', type: 'crate_estimate', skuId: 'sku-01', skuName: 'Classic Glazed', estimatedValue: 5, confidence: 'medium', warning: 'Blurred edge on crate-1 photo; manual recount recommended' },
      { id: 'air-32', type: 'crate_estimate', skuId: 'sku-06', skuName: 'Cookies & Cream', estimatedValue: 4, confidence: 'high' },
      { id: 'air-33', type: 'crate_estimate', skuId: 'sku-09', skuName: 'Cinnamon Sugar', estimatedValue: 2, confidence: 'high' },
    ],
    status: 'pending_review',
    submittedAt: '2026-03-05T20:15:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 6, aiEstimate: 5, confidence: 'medium', discrepancy: 1, manualOverride: true },
      { skuId: 'sku-06', skuName: 'Cookies & Cream', quantity: 4, aiEstimate: 4, confidence: 'high' },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-05-01', action: 'submitted', performedBy: 'user-08',
        performedAt: '2026-03-05T20:15:00Z',
        comment: 'Direct-to-Zapp submission. Manual override on Classic Glazed due to a wet display box.',
      },
    ],
  },

  // ei-06 (NEW): store-05 (direct franchise) — in Patricia's queue, approved
  {
    id: 'ei-06', deliveryId: 'del-14', storeId: 'store-05', date: '2026-03-10',
    crateImageUrls: ['/uploads/inventory/ei-06-crate1.jpg'],
    unsoldItems: [
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 5, aiEstimate: 5, confidence: 'high' },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    aiResults: [
      { id: 'air-34', type: 'crate_estimate', skuId: 'sku-02', skuName: 'Chocolate Ring', estimatedValue: 5, confidence: 'high' },
      { id: 'air-35', type: 'crate_estimate', skuId: 'sku-09', skuName: 'Cinnamon Sugar', estimatedValue: 2, confidence: 'high' },
    ],
    status: 'approved',
    submittedAt: '2026-03-10T19:00:00Z',
    originalUnsoldItems: [
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 5, aiEstimate: 5, confidence: 'high' },
      { skuId: 'sku-09', skuName: 'Cinnamon Sugar', quantity: 2, aiEstimate: 2, confidence: 'high' },
    ],
    revisions: [
      {
        id: 'eir-06-01', action: 'submitted', performedBy: 'user-08',
        performedAt: '2026-03-10T19:00:00Z',
      },
      {
        id: 'eir-06-02', action: 'approved', performedBy: 'user-09',
        performedAt: '2026-03-10T22:00:00Z',
        comment: 'Reviewed crate photos; counts match submitted figures. Approved.',
      },
    ],
    reviewedBy: 'user-09',
    reviewedAt: '2026-03-10T22:00:00Z',
  },
];

// ─── Special Orders ─────────────────────────────────────────

export const specialOrders: SpecialOrder[] = [
  {
    id: 'so-01',
    storeId: 'store-01',
    date: '2026-03-10',
    items: [
      { skuId: 'sku-14', skuName: 'Red Velvet', quantity: 100, drPrice: 16, srpPrice: 30 },
      { skuId: 'sku-15', skuName: 'Caramel Macchiato', quantity: 50, drPrice: 17, srpPrice: 32 },
    ],
    totalDR: 2450,
    totalSRP: 4600,
    status: 'sold',
    notes: 'Birthday party bulk order',
    createdAt: '2026-03-08T10:00:00Z',
  },
  {
    id: 'so-02',
    storeId: 'store-09',
    date: '2026-03-15',
    items: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 200, drPrice: 12, srpPrice: 20 },
      { skuId: 'sku-05', skuName: 'Strawberry Sprinkle', quantity: 100, drPrice: 15, srpPrice: 28 },
      { skuId: 'sku-07', skuName: 'Matcha Glazed', quantity: 80, drPrice: 16, srpPrice: 30 },
    ],
    totalDR: 5180,
    totalSRP: 9200,
    status: 'sold',
    notes: 'Corporate event catering - ABC Corp',
    createdAt: '2026-03-12T14:00:00Z',
  },
  {
    id: 'so-03',
    storeId: 'store-12',
    date: '2026-03-18',
    items: [
      { skuId: 'sku-06', skuName: 'Cookies & Cream', quantity: 150, drPrice: 15, srpPrice: 28 },
      { skuId: 'sku-08', skuName: 'Salted Caramel', quantity: 150, drPrice: 16, srpPrice: 30 },
    ],
    totalDR: 4650,
    totalSRP: 8700,
    status: 'sold',
    notes: 'School foundation day order',
    createdAt: '2026-03-15T09:30:00Z',
  },
  {
    id: 'so-04',
    storeId: 'store-18',
    date: '2026-03-20',
    items: [
      { skuId: 'sku-03', skuName: 'Bavarian Cream', quantity: 60, drPrice: 14, srpPrice: 25 },
      { skuId: 'sku-04', skuName: 'Ube Cheese', quantity: 60, drPrice: 14, srpPrice: 25 },
      { skuId: 'sku-11', skuName: 'Mango Graham', quantity: 40, drPrice: 16, srpPrice: 30 },
    ],
    totalDR: 2320,
    totalSRP: 4200,
    status: 'sold',
    notes: 'Office snack subscription delivery',
    createdAt: '2026-03-17T11:00:00Z',
  },
  {
    id: 'so-05',
    storeId: 'store-06',
    date: '2026-03-22',
    items: [
      { skuId: 'sku-01', skuName: 'Classic Glazed', quantity: 300, drPrice: 12, srpPrice: 20 },
      { skuId: 'sku-02', skuName: 'Chocolate Ring', quantity: 200, drPrice: 12, srpPrice: 20 },
    ],
    totalDR: 6000,
    totalSRP: 10000,
    status: 'sold',
    notes: 'Fiesta town celebration bulk order',
    createdAt: '2026-03-19T08:00:00Z',
  },
];

// ─── Real-catalog normalization pass ────────────────────────
//
// Rewrite every legacy sku-XX reference embedded in the demo data to the
// real 9-product catalog (see LEGACY_SKU_REMAP / deepRemapSkus above).
// Deliveries already resolve through realSku() in buildDeliveryItems, but
// they're included here too for idempotent safety. Forecast items, BI/EI
// inventory items, AI results, EI revisions/corrections, and special-order
// line items are all normalized in place so no view ever shows an old
// mock product name.
deepRemapSkus(deliveries);
deepRemapSkus(beginningInventories);
deepRemapSkus(endingInventories);
deepRemapSkus(specialOrders);
deepRemapSkus(forecasts);

// Special-order header totals were authored from the old mock prices;
// recompute from the now-real line-item prices so the headers reconcile.
for (const so of specialOrders) {
  so.totalDR = so.items.reduce((sum, it) => sum + it.quantity * it.drPrice, 0);
  so.totalSRP = so.items.reduce((sum, it) => sum + it.quantity * it.srpPrice, 0);
}

// ─── Coverage pass: ensure every ACTIVE store has demo data ──
//
// Several role-scoped views (Deliveries, the Beginning/Ending Inventory
// "Select Delivery" dropdowns, and Forecasting) render EMPTY when the
// signed-in user's store/plant has no underlying rows. The hand-authored
// del-01..22 / fc-01..08 above only cover a subset of stores, so a
// franchisee or plant_manager on an uncovered store saw a blank page.
//
// This additive pass generates ONE 'delivered' delivery + ONE forecast
// for every ACTIVE store that doesn't already have each — using the real
// 9-product catalog and deterministic values (NO Math.random, so seeds
// stay reproducible). It never mutates or removes the existing rows, so
// all the existing demo flows are unchanged.

const PLANT_CODE_FOR_COVERAGE: Record<string, string> = {
  'plant-01': 'DRG',
  'plant-02': 'MNL',
  'plant-03': 'CEB',
};

// Deterministic forecast line items over a rotating window of the real
// catalog (different stores → different product mixes, stable per seed).
function buildCoverageForecastItems(seedIdx: number): ForecastItem[] {
  const pressures = ['hot', 'normal', 'weak'] as const;
  return skus.slice(0, 6).map((sku, i) => {
    const avg14 = 18 + ((seedIdx * 7 + i * 5) % 40);
    const unsold = -(((seedIdx + i) % 5) + 1);
    const dow = ((seedIdx + i) % 9) - 2;
    const pressure = pressures[(seedIdx + i) % 3];
    const modifier = pressure === 'hot' ? 1.15 : pressure === 'weak' ? 0.88 : 1.0;
    const finalForecast = Math.max(0, Math.round((avg14 + unsold + dow) * modifier));
    return {
      skuId: sku.id,
      skuName: sku.name,
      avg14Day: avg14,
      unsoldAdjustment: unsold,
      dayOfWeekAdjustment: dow,
      demandPressure: pressure,
      pressureModifier: modifier,
      finalForecast,
      actualSold: i % 2 === 0 ? Math.max(0, finalForecast - ((seedIdx + i) % 4)) : undefined,
    };
  });
}

{
  const activeStoresForCoverage = stores.filter((s) => s.status === 'active');

  // 1) Deliveries — one 'delivered' delivery per active store lacking one.
  const storesWithDelivered = new Set(
    deliveries.filter((d) => d.status === 'delivered').map((d) => d.storeId),
  );
  let covIdx = 0;
  for (const store of activeStoresForCoverage) {
    if (storesWithDelivered.has(store.id)) continue;
    covIdx += 1;
    const start = covIdx % (skus.length - 3); // 0..5 → always yields 4 SKUs
    const skuIds = skus.slice(start, start + 4).map((s) => s.id);
    const quantities = skuIds.map((_, i) => 30 + ((covIdx * 5 + i * 7) % 40));
    const built = buildDeliveryItems(skuIds, quantities);
    const code = PLANT_CODE_FOR_COVERAGE[store.plantId] ?? 'DRG';
    const seq = String(covIdx).padStart(3, '0');
    deliveries.push({
      id: `del-cov-${seq}`,
      storeId: store.id,
      plantId: store.plantId,
      date: '2026-03-25',
      status: 'delivered',
      drNumber: `DR-${code}-20260325-${seq}`,
      ...built,
    });
  }

  // 2) Forecasts — one forecast per active store lacking one.
  const storesWithForecast = new Set(forecasts.map((f) => f.storeId));
  let fcIdx = 0;
  for (const store of activeStoresForCoverage) {
    if (storesWithForecast.has(store.id)) continue;
    fcIdx += 1;
    const seq = String(fcIdx).padStart(3, '0');
    forecasts.push({
      id: `fc-cov-${seq}`,
      storeId: store.id,
      date: '2026-03-25',
      items: buildCoverageForecastItems(fcIdx),
      createdBy: 'user-03',
      status: 'approved',
    });
  }
}

// ─── Aliases (used by store & api) ──────────────────────────

export const demoUsers = users;
export const packagingCatalog = packagingItems;
