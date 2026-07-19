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

// 'needs_more_info' = Admin requested additional information during onboarding
// verification (Partner Onboarding Phase 4). Applicant sees it on the awaiting
// screen; not terminal.
export type ApplicationStatus = 'pending' | 'approved' | 'declined' | 'needs_more_info';

// --- New Application Monitoring (module vocabulary) ---
// The module labels `declined` as "Disapproved"; the stored value stays
// `declined` for back-compat with every existing row and consumer.

/**
 * Legacy single-select Market Source union. Market Source became a MULTI-SELECT
 * checklist of location characteristics (boss request) — `marketSource` is now
 * `string[]` of option keys from MARKET_SOURCE_OPTIONS in applicationMonitoring,
 * plus `marketSourceOther` for the free text when "other" is ticked. Kept
 * exported for back-compat.
 */
export type MarketSource = 'facebook' | 'referral' | 'walk_in' | 'website' | 'others';

/**
 * Legacy Yes/No union. Comparable and ADS were briefly Yes/No dropdowns; the
 * boss asked for free-text boxes instead (ops/area supervisors type the value —
 * e.g. a peso Average Daily Sales figure), so both are now plain `string`. Kept
 * exported for back-compat with any stored 'yes'/'no' rows and VALUE_LABELS.
 */
export type YesNo = 'yes' | 'no';

/** RTC runs its own approval track, separate from the application Status. */
export type RtcStatus = 'pending' | 'approved' | 'disapproved';

export type ReferralType = 'distributor' | 'zapp_internal' | 'sub_partner_distributor';

// Franchisee delivery cadence. `daily` ships every day; `odd`/`even` ship only
// on odd- or even-numbered days of the month. Set at onboarding and editable
// afterwards by the PD / AS / OS on the application.
// ⚠️ `daily` needs migration 034 — 010's CHECK constraint allowed only odd|even.
export type DeliverySchedule = 'daily' | 'odd' | 'even';

/** Display text for each cadence. */
export const DELIVERY_SCHEDULE_LABELS: Record<DeliverySchedule, string> = {
  daily: 'Daily delivery',
  odd: 'Odd (1, 3, 5…)',
  even: 'Even (2, 4, 6…)',
};

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

// submitted → collected → verified (with rejected reachable from either stage).
// 'collected' = the store's remittance has been collected by its PD/SPD and
// forwarded to Billing; billing marks it 'verified' (which is what actually
// flips the billing record to paid — see billingComputations).
export type PaymentStatus = 'submitted' | 'collected' | 'verified' | 'rejected';

export type PackagingOrderStatus = 'pending' | 'included_in_delivery' | 'billed';

export type ForecastStatus = 'draft' | 'submitted' | 'approved';

export type DemandPressure = 'hot' | 'normal' | 'weak';

export type ReferralCodeStatus = 'active' | 'inactive';

export type DistributorStatus = 'active' | 'inactive' | 'suspended';

// --- Core Entities ---

/**
 * Franchisee first-time activation (migration 024).
 * `not_activated` → `pending_verification` (docs submitted) → `active` (verified).
 * Only an `active` account may reach the ERP.
 */
export type AccountStatus = 'not_activated' | 'pending_verification' | 'active';

/**
 * Per-document verification state (migration 026).
 * `not_uploaded` / `uploaded` are DERIVED from whether the document's URL is
 * set — only `verified` / `rejected` are ever stored.
 */
export type DocumentStatus = 'not_uploaded' | 'uploaded' | 'verified' | 'rejected';

/** The four documents the Documents section tracks. */
export type ApplicationDocumentKey = 'storePhoto' | 'govId' | 'proofOfBilling' | 'selfie';

export interface DocumentReview {
  status: 'verified' | 'rejected';
  /** Required by the spec when rejecting — the reason shown to the franchisee. */
  remarks?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  plantId?: string;
  /**
   * Plants a Billing User covers — they are per-plant but may hold SEVERAL
   * (boss). **Empty/undefined means ALL plants, not none**, so the seeded
   * billing user (no plants) keeps seeing company-wide instead of going blank.
   * Operations Manager covers every plant by definition and leaves this empty.
   */
  plantIds?: string[];
  distributorId?: string;
  subPartnerDistributorId?: string;
  areaIds?: string[];
  assignedStoreIds?: string[];
  /**
   * Activation gate. **undefined = not applicable** — every staff account and
   * every franchisee created before migration 024 has no status and is never
   * locked, so no backfill is needed.
   */
  accountStatus?: AccountStatus;
  /**
   * undefined = still on the system-generated temporary password. Drives the
   * "Password Updated" display; the password itself is never stored (Supabase
   * hashes it, and it is revealed exactly once at creation).
   */
  passwordChangedAt?: string;
  /**
   * Stamped on every successful sign-in (migration 027). undefined = has not
   * signed in since that shipped. A full login history is deliberately NOT
   * here — see the migration for why.
   */
  lastLoginAt?: string;
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
  // Channel code that routes an onboarding application to this SPD.
  referralCode?: string;
}

export interface AreaSupervisor {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Free-text CITY names — display only. Not the province master list. */
  assignedAreas: string[];
  plantId: string;
  assignedStoreIds: string[];
  /**
   * Provinces this AS covers (New Application Monitoring, migration 023).
   * Admin-managed on the Area Supervisors page; drives the automatic AS
   * assignment on submit and scopes what an AS sees. Optional/empty = no
   * coverage yet, in which case assignment falls back to the referral code.
   */
  assignedProvinces?: string[];
}

export interface Store {
  id: string;
  name: string;
  businessName: string;
  ownerName: string;
  address: string;
  lat: number;
  lng: number;
  // Mister Donut shop code — assigned AFTER approval via the "New Franchisee"
  // admin form (not captured on the public /apply). Optional for back-compat.
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
  // Onboarding fields carried over from the approved application (optional for
  // back-compat with existing seeded stores).
  deliverySchedule?: DeliverySchedule;
  openingDate?: string;
}

// --- Applications ---

export interface AuditEntry {
  id: string;
  action: string;
  /** User id (or 'system' for the submission entry). */
  performedBy: string;
  performedAt: string;
  details: string;
  // --- Transaction History (New Application Monitoring, Phase 4) ---
  // All optional: entries written before this existed stay valid, and the
  // detail view falls back to `details` / `performedBy` when they're absent.
  // No migration — audit_log is JSONB and passes through verbatim.
  /** Resolved at write time — `performedBy` alone is an opaque id. */
  performedByName?: string;
  /** Department that made the change (PD / SD / AS / OS / Admin). */
  role?: UserRole;
  /** Human label of the changed field, e.g. "Google Maps Link". */
  fieldModified?: string;
  previousValue?: string;
  newValue?: string;
}

export interface Application {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  storeName: string;
  address: string;
  lat: number;
  lng: number;
  storePhotoUrl: string;
  govIdUrl: string;
  proofOfBillingUrl: string;
  referralCode: string;
  referralType: ReferralType;
  assignedDistributorId?: string;
  assignedSubPartnerDistributorId?: string;
  assignedAreaSupervisorId?: string;
  assignedPlantId: string;
  // Onboarding fields (internal "New Franchisee" application form). Optional so
  // the public /apply flow — which does not collect them — stays valid.
  shopCode?: string;
  deliverySchedule?: DeliverySchedule;
  openingDate?: string;
  termsAcceptedAt?: string;
  // Self-service Partner Onboarding (/onboarding) fields — all optional so the
  // legacy /apply and internal onboarding forms stay valid. See
  // docs/superpowers/specs/2026-07-12-partner-onboarding-workflow-design.md.
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  residentialAddress?: string;
  facebookLink?: string;
  operatingHours?: string;
  selfieUrl?: string;
  // --- New Application Monitoring (migration 021) ---
  // Auto-filled from the application form. `province` is collected by the
  // /apply PSGC cascade but was previously only flattened into `address`; it is
  // stored on its own because the Area filter + automatic Area-Supervisor
  // assignment key off it. `location` is the coarse region grouping derived
  // from it (Bicol Region, Metro Manila, ...) — derivation lands in Phase 5.
  province?: string;
  location?: string;
  operatingDays?: string;
  // Filled by PD/SD during evaluation.
  googleMapsPictureUrl?: string;
  googleMapsLink?: string;
  // Multi-select checklist of location characteristics (keys from
  // MARKET_SOURCE_OPTIONS). marketSourceOther holds the custom text when the
  // "other" key is included.
  marketSource?: string[];
  marketSourceOther?: string;
  remarksPdSd?: string;
  // Filled by AS/OS during evaluation.
  // Free text — staff type these (boss: "box lang"). ADS = Average Daily Sales.
  comparable?: string;
  ads?: string;
  rtc?: RtcStatus;
  remarksAs?: string;
  remarksOs?: string;
  // Per-document electronic acceptance timestamps (Step 6, four confirmations).
  acceptedConsignmentAt?: string;
  acceptedPrivacyAt?: string;
  acceptedTermsAt?: string;
  certifiedAt?: string;
  agreementVersion?: string;
  /**
   * Searchable reference, assigned by the DB from 10001 up (migration 036).
   * EVERY application has one.
   *
   * ⚠️ This used to double as the "is this an onboarding application?" flag —
   * see `applicationSource`. Never reintroduce that: numbering everything would
   * make the system treat every applicant as a self-service partner and stop
   * minting franchisee logins entirely.
   */
  applicationNumber?: string;
  /**
   * Which intake produced this application — the explicit discriminator that
   * replaced the `!!applicationNumber` heuristic. Read it through
   * `isOnboardingApplication()`, which still falls back to the old rule for
   * rows written by an older bundle.
   */
  applicationSource?: 'apply' | 'onboarding';
  // Phase 3 — best-effort ID OCR autofill (prefilled at capture, editable by the
  // applicant; the reviewer cross-checks against the uploaded ID image).
  idScannedName?: string;
  idNumber?: string;
  // Phase 2 — submission provenance (best-effort; may be absent if the applicant
  // denied permission or the lookup timed out) + a system-generated PDF copy.
  submittedIp?: string;
  userAgent?: string;
  deviceInfo?: string;
  gpsLat?: number;
  gpsLng?: number;
  pdfUrl?: string;
  /**
   * The login this application generated on approval (migration 024). Needed
   * because the generated username email (<shopcode>@shop.zappdonuts.com) never
   * matches the applicant's own email, so the Login Credentials card cannot
   * find the user any other way.
   */
  accountUserId?: string;
  /** Staff verification per document (migration 026). Absent = nothing reviewed yet. */
  documentReviews?: Partial<Record<ApplicationDocumentKey, DocumentReview>>;
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

// --- Billing Revision (PD report correction — Phase B) ---
// A Partner Distributor corrects a store's reported Beginning / Ending donut
// counts for a specific DR (delivery) when the report looks wrong. Stored
// SEPARATELY from the EI reviewer queue (this is a billing-level concern, not
// the ending-inventory review workflow). The positive delta becomes a separate
// "additional" billing (Phase C); the franchisee can view the corrected counts
// and dispute them (Phase D). All additive — no existing consumer changes.
export type BillingRevisionStatus = 'requested' | 'disputed' | 'resolved';

export interface BillingRevisionItem {
  skuId: string;
  skuName: string;
  quantity: number;
}

export interface BillingRevision {
  id: string;
  deliveryId: string;
  storeId: string;
  requestedBy: string;      // PD user id
  requestedAt: string;
  reason: string;
  correctedBeginning: BillingRevisionItem[];  // PD's corrected beginning counts
  correctedEnding: BillingRevisionItem[];      // PD's corrected ending/unsold counts
  status: BillingRevisionStatus;
  // Phase C — positive DR-Sold-Value delta the store additionally owes after the
  // correction (0 when the revision doesn't raise sold). Audit snapshot at file
  // time; the UI also derives it live from the delivery + inventories.
  additionalAmount?: number;
  // Phase D — franchisee dispute of the revision (status → 'disputed').
  disputeNote?: string;
  disputedAt?: string;
}

// 'billing' = a normal consignment/billing payment (default when absent, for
// back-compat). 'security_deposit' = the one-time ₱2,000 onboarding deposit
// (Partner Onboarding Phase 5) — not tied to a billing record.
export type PaymentType = 'billing' | 'security_deposit';

export interface Payment {
  id: string;
  billingId: string;
  storeId: string;
  amount: number;
  method: PaymentMethod;
  type?: PaymentType;
  referenceNumber: string;
  datePaid: string;
  proofUrl?: string;
  status: PaymentStatus;
  // PD/SPD collection step (franchisee → PD/SPD → billing). Set when the
  // partner distributor collects the store's remittance before forwarding
  // it to billing for verification. Absent for direct-franchisee payments
  // that go straight to billing (those stores have no PD).
  collectedBy?: string;
  collectedAt?: string;
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
  subPartnerDistributorId?: string;
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
