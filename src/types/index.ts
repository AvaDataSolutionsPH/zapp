// ============================================================
// ZAPP Donuts ERP - TypeScript Type Definitions
// ============================================================

// --- Enums & Literal Types ---

export type UserRole =
  | 'owner'
  | 'operations_manager'
  | 'forecaster'
  | 'plant_manager'
  | 'billing_user'
  | 'partner_distributor'
  | 'sub_partner_distributor'
  | 'franchisee_distributor'
  | 'franchisee_direct'
  | 'area_manager';

export type FranchiseType = 'distributor' | 'direct';

export type StoreStatus = 'active' | 'inactive' | 'pending' | 'blocked';

export type ApplicationStatus = 'pending' | 'approved' | 'declined';

export type ReferralType = 'distributor' | 'zapp_internal';

export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'reconciled';

export type BeginningInventoryStatus = 'pending_ai' | 'ai_processed' | 'confirmed';

export type EndingInventoryStatus =
  | 'pending_review'
  | 'needs_review'
  | 'correction_required'
  | 'approved'
  | 'pending'
  | 'confirmed';

export type EndingInventoryReviewAction =
  | 'submitted'
  | 'approved'
  | 'needs_review'
  | 'correction_requested'
  | 'resubmitted';

export type AIResultType = 'ocr_dr' | 'crate_estimate' | 'discrepancy';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type BillingStatus = 'pending' | 'issued' | 'paid' | 'overdue';

export type StoreDeliveryStatus = 'active' | 'warning' | 'hold';

export type PaymentMethod = 'gateway' | 'manual';

export type PaymentStatus = 'submitted' | 'verified' | 'rejected';

export type PackagingOrderStatus = 'pending' | 'included_in_delivery' | 'billed';

export type ForecastStatus = 'draft' | 'submitted' | 'approved';

export type DemandPressure = 'hot' | 'normal' | 'weak';

export type ReferralCodeStatus = 'active' | 'inactive';

export type DistributorStatus = 'active' | 'inactive' | 'suspended';

// --- Core Entities ---

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  plantId?: string;
  distributorId?: string;
  subPartnerDistributorId?: string;
  areaIds?: string[];
  assignedStoreIds?: string[];
}

export interface Plant {
  id: string;
  name: string;
  location: string;
  region: string;
  code: string;
}

export interface Distributor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  plantId: string;
  referralCode: string;
  assignedAreaIds: string[];
  status: DistributorStatus;
}

export interface SubPartnerDistributor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  parentDistributorId: string;
  plantId: string;
  assignedStoreIds: string[];
  status: DistributorStatus;
}

export interface AreaSupervisor {
  id: string;
  name: string;
  email: string;
  phone: string;
  assignedAreas: string[];
  plantId: string;
  assignedStoreIds: string[];
}

export interface Store {
  id: string;
  name: string;
  businessName: string;
  ownerName: string;
  address: string;
  lat: number;
  lng: number;
  // Mister Donut shop code (assigned by MD per store). Optional for
  // back-compat with pre-existing seeded stores that predate the field.
  shopCode?: string;
  plantId: string;
  distributorId?: string;
  subPartnerDistributorId?: string;
  areaSupervisorId: string;
  franchiseType: FranchiseType;
  status: StoreStatus;
  province: string;
  area: string;
  phone: string;
  email: string;
  createdAt: string;
  deliveryStatus: StoreDeliveryStatus;
}

// --- Applications ---

export interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: string;
}

export interface Application {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  storeName: string;
  // Mister Donut shop code captured at application time. Optional for
  // back-compat with applications submitted before the field existed.
  shopCode?: string;
  address: string;
  lat: number;
  lng: number;
  storePhotoUrl: string;
  govIdUrl: string;
  proofOfBillingUrl: string;
  referralCode: string;
  referralType: ReferralType;
  assignedDistributorId?: string;
  assignedAreaSupervisorId?: string;
  assignedPlantId: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  auditLog: AuditEntry[];
}

// --- Delivery & Inventory ---

export interface DeliveryItem {
  skuId: string;
  skuName: string;
  quantity: number;
  drPrice: number;
  srpPrice: number;
}

export interface Delivery {
  id: string;
  storeId: string;
  plantId: string;
  date: string;
  status: DeliveryStatus;
  drNumber: string;
  items: DeliveryItem[];
  totalDRCost: number;
  totalSRP: number;
}

export interface SKU {
  id: string;
  name: string;
  category: string;
  drPrice: number;
  srpPrice: number;
  unit: string;
}

export interface InventoryItem {
  skuId: string;
  skuName: string;
  quantity: number;
  aiEstimate?: number;
  confidence?: ConfidenceLevel;
  discrepancy?: number;
  manualOverride?: boolean;
}

export interface AIResult {
  id: string;
  type: AIResultType;
  skuId?: string;
  skuName?: string;
  extractedValue?: number;
  estimatedValue?: number;
  confidence: ConfidenceLevel;
  warning?: string;
  imageRef?: string;
}

export interface BeginningInventory {
  id: string;
  deliveryId: string;
  storeId: string;
  date: string;
  drImageUrl: string;
  crateImageUrls: string[];
  aiResults: AIResult[];
  confirmedItems: InventoryItem[];
  status: BeginningInventoryStatus;
  notes?: string;
}

export interface EndingInventoryCorrectionItem {
  skuId: string;
  skuName: string;
  submittedQty: number;
  correctedQty: number;
}

export interface EndingInventoryReview {
  id: string;
  action: EndingInventoryReviewAction;
  performedBy: string;
  performedAt: string;
  comment?: string;
  reason?: string;
  corrections?: EndingInventoryCorrectionItem[];
}

export interface EndingInventory {
  id: string;
  deliveryId: string;
  storeId: string;
  date: string;
  crateImageUrls: string[];
  unsoldItems: InventoryItem[];
  aiResults: AIResult[];
  status: EndingInventoryStatus;
  notes?: string;
  submittedAt?: string;
  originalUnsoldItems?: InventoryItem[];
  revisions?: EndingInventoryReview[];
  reviewedBy?: string;
  reviewedAt?: string;
}

// --- Billing & Payments ---

export interface BillingRecord {
  id: string;
  plantId: string;
  storeId: string;
  distributorId?: string;
  period: string;
  drTotal: number;
  unsoldDeduction: number;
  packagingTotal: number;
  totalPayable: number;
  status: BillingStatus;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  paymentProofUrl?: string;
  verifiedBy?: string;
  invoiceFileUrl?: string;
  srpTotal: number;
  soldQty: number;
  franchiseeProfit: number;
  remitToPD: number;
  cutoffPeriod: string;
  pdProfit?: number;
  spdProfit?: number;
  subPartnerDistributorId?: string;
}

export interface Payment {
  id: string;
  billingId: string;
  storeId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  datePaid: string;
  proofUrl?: string;
  status: PaymentStatus;
  verifiedBy?: string;
  rejectedReason?: string;
  submittedAt: string;
}

// --- Packaging ---

export interface PackagingItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
}

export interface PackagingOrder {
  id: string;
  storeId: string;
  items: {
    packagingItemId: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: PackagingOrderStatus;
  orderedAt: string;
  deliveryId?: string;
}

// --- Forecasting ---

export interface ForecastItem {
  skuId: string;
  skuName: string;
  avg14Day: number;
  unsoldAdjustment: number;
  dayOfWeekAdjustment: number;
  demandPressure: DemandPressure;
  pressureModifier: number;
  finalForecast: number;
  actualSold?: number;
}

export interface Forecast {
  id: string;
  storeId: string;
  date: string;
  items: ForecastItem[];
  createdBy: string;
  status: ForecastStatus;
}

// --- Referral Codes ---

export interface ReferralCode {
  id: string;
  code: string;
  type: ReferralType;
  distributorId?: string;
  areaSupervisorId?: string;
  plantId: string;
  status: ReferralCodeStatus;
  createdAt: string;
  usageCount: number;
}

// --- Analytics ---

export interface SalesMetric {
  storeId: string;
  storeName: string;
  area: string;
  province: string;
  plantId: string;
  distributorId?: string;
  drSales: number;
  srpSales: number;
  period: string;
  date: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  targetRole?: UserRole;
  targetStoreId?: string;
}

// --- Special Orders ---

export type SpecialOrderStatus = 'sold';

export interface SpecialOrderItem {
  skuId: string;
  skuName: string;
  quantity: number;
  drPrice: number;
  srpPrice: number;
}

export interface SpecialOrder {
  id: string;
  storeId: string;
  date: string;
  items: SpecialOrderItem[];
  totalDR: number;
  totalSRP: number;
  status: SpecialOrderStatus;
  notes?: string;
  createdAt: string;
}

// --- Geo helpers ---

export interface Province {
  id: string;
  name: string;
  region: string;
}

export interface Area {
  id: string;
  name: string;
  provinceId: string;
}
