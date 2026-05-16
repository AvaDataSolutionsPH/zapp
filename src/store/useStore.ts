// ============================================================
// ZAPP Donuts ERP - Zustand Store
// ============================================================

import { create } from 'zustand';
import type {
  User,
  UserRole,
  Plant,
  SKU,
  Store,
  Application,
  Distributor,
  SubPartnerDistributor,
  AreaSupervisor,
  Delivery,
  BeginningInventory,
  EndingInventory,
  InventoryItem,
  BillingRecord,
  Payment,
  PackagingItem,
  PackagingOrder,
  Forecast,
  ReferralCode,
  SalesMetric,
  Notification,
  AuditEntry,
  SpecialOrder,
  EndingInventoryReview,
  EndingInventoryCorrectionItem,
} from '@/types';
import {
  demoUsers,
  plants as mockPlants,
  skus as mockSkus,
  stores as mockStores,
  applications as mockApplications,
  distributors as mockDistributors,
  subPartnerDistributors as mockSubPartnerDistributors,
  areaSupervisors as mockAreaSupervisors,
  deliveries as mockDeliveries,
  beginningInventories as mockBeginningInventories,
  endingInventories as mockEndingInventories,
  payments as mockPayments,
  packagingCatalog as mockPackagingCatalog,
  packagingOrders as mockPackagingOrders,
  forecasts as mockForecasts,
  referralCodes as mockReferralCodes,
  salesMetrics as mockSalesMetrics,
  notifications as mockNotifications,
  specialOrders as mockSpecialOrders,
} from '@/data/mockData';
import { computeBillingsFromState } from '@/lib/billingComputations';

// Compute the initial billing list from the seeded mock entities. This replaces
// the previously hard-coded mockBillingRecords — billings are now derived from
// approved EIs + Special Orders + Packaging Orders, not stored as primary data.
const initialBillings = computeBillingsFromState({
  endingInventories: mockEndingInventories,
  specialOrders: mockSpecialOrders,
  packagingOrders: mockPackagingOrders,
  deliveries: mockDeliveries,
  stores: mockStores,
  payments: mockPayments,
});

// ── Helpers ─────────────────────────────────────────────────────────

const delay = (ms = 400): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ── Store Interface ─────────────────────────────────────────────────

interface AppStore {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;

  // Plants
  plants: Plant[];

  // SKUs
  skus: SKU[];

  // Stores
  stores: Store[];
  addStore: (store: Store) => void;
  updateStore: (id: string, updates: Partial<Store>) => void;

  // Applications
  applications: Application[];
  submitApplication: (
    app: Omit<Application, 'id' | 'status' | 'submittedAt' | 'auditLog'>,
  ) => Promise<void>;
  reviewApplication: (
    id: string,
    action: 'approved' | 'declined',
    reviewerId: string,
    notes?: string,
  ) => void;

  // Distributors
  distributors: Distributor[];

  // Sub-Partner Distributors
  subPartnerDistributors: SubPartnerDistributor[];

  // Area Supervisors
  areaSupervisors: AreaSupervisor[];

  // Delivery enforcement
  requestStopDelivery: (storeId: string) => void;
  resumeDelivery: (storeId: string) => void;

  // Deliveries
  deliveries: Delivery[];
  addDelivery: (delivery: Delivery) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;

  // Beginning Inventory
  beginningInventories: BeginningInventory[];
  addBeginningInventory: (inv: BeginningInventory) => void;
  confirmBeginningInventory: (id: string, items: InventoryItem[]) => void;

  // Ending Inventory
  endingInventories: EndingInventory[];
  addEndingInventory: (inv: EndingInventory) => void;
  confirmEndingInventory: (id: string, items: InventoryItem[]) => void;

  // Ending Inventory Review (state machine)
  approveEndingInventory: (id: string, reviewerId: string, comment?: string) => void;
  markEndingInventoryNeedsReview: (id: string, reviewerId: string, comment: string) => void;
  requestEndingInventoryCorrection: (
    id: string,
    reviewerId: string,
    corrections: EndingInventoryCorrectionItem[],
    reason: string,
  ) => void;
  resubmitEndingInventory: (
    id: string,
    items: InventoryItem[],
    submitterId: string,
    comment?: string,
  ) => void;

  // Billing
  billingRecords: BillingRecord[];
  updateBillingRecord: (id: string, updates: Partial<BillingRecord>) => void;

  // Payments
  payments: Payment[];
  submitPayment: (payment: Omit<Payment, 'id' | 'status' | 'submittedAt'>) => void;
  verifyPayment: (
    id: string,
    action: 'verified' | 'rejected',
    verifiedBy: string,
    reason?: string,
  ) => void;

  // Packaging
  packagingCatalog: PackagingItem[];
  packagingOrders: PackagingOrder[];
  submitPackagingOrder: (
    order: Omit<PackagingOrder, 'id' | 'status' | 'orderedAt'>,
  ) => void;

  // Forecasts
  forecasts: Forecast[];
  saveForecast: (forecast: Forecast) => void;

  // Referral Codes
  referralCodes: ReferralCode[];
  validateReferralCode: (code: string) => ReferralCode | null;
  addReferralCode: (
    code: Omit<ReferralCode, 'id' | 'createdAt' | 'usageCount'>,
  ) => void;

  // Sales / Analytics
  salesMetrics: SalesMetric[];

  // Notifications
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  addNotification: (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Demo users list
  demoUsers: User[];

  // Special Orders
  specialOrders: SpecialOrder[];
  addSpecialOrder: (order: Omit<SpecialOrder, 'id'>) => void;

  // Filtered data helpers
  getStoresForCurrentUser: () => Store[];
  getDeliveriesForCurrentUser: () => Delivery[];
  getBillingForCurrentUser: () => BillingRecord[];
  getEndingInventoriesForReview: () => EndingInventory[];
}

// ── Store Creation ──────────────────────────────────────────────────

export const useStore = create<AppStore>((set, get) => {
  // Recompute the billing slice from current state. Called after any mutation
  // that affects the billing inputs (approve EI, add Special Order, add
  // Packaging Order, verify Payment).
  const recomputeBillings = (): void => {
    const s = get();
    set({
      billingRecords: computeBillingsFromState({
        endingInventories: s.endingInventories,
        specialOrders: s.specialOrders,
        packagingOrders: s.packagingOrders,
        deliveries: s.deliveries,
        stores: s.stores,
        payments: s.payments,
      }),
    });
  };

  return {
  // ─── Auth ───────────────────────────────────────────────────────

  currentUser: demoUsers.find((u) => u.role === 'owner') ?? null,
  isAuthenticated: true, // auto-login as Owner for demo

  login: async (email: string, _password: string): Promise<boolean> => {
    await delay(600);
    const user = get().demoUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (user) {
      set({ currentUser: user, isAuthenticated: true });
      return true;
    }
    return false;
  },

  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
  },

  switchRole: (role: UserRole) => {
    const user = get().demoUsers.find((u) => u.role === role);
    if (user) {
      set({ currentUser: user, isAuthenticated: true });
    }
  },

  // ─── Plants ─────────────────────────────────────────────────────

  plants: mockPlants,

  // ─── SKUs ───────────────────────────────────────────────────────

  skus: mockSkus,

  // ─── Stores ─────────────────────────────────────────────────────

  stores: mockStores,

  addStore: (store: Store) => {
    set((s) => ({ stores: [...s.stores, store] }));
  },

  updateStore: (id: string, updates: Partial<Store>) => {
    set((s) => ({
      stores: s.stores.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    }));
  },

  // ─── Delivery Enforcement ─────────────────────────────────────

  requestStopDelivery: (storeId: string) => {
    set((s) => ({
      stores: s.stores.map((st) =>
        st.id === storeId ? { ...st, deliveryStatus: 'hold' as const } : st,
      ),
    }));
  },

  resumeDelivery: (storeId: string) => {
    set((s) => ({
      stores: s.stores.map((st) =>
        st.id === storeId ? { ...st, deliveryStatus: 'active' as const } : st,
      ),
    }));
  },

  // ─── Applications ──────────────────────────────────────────────

  applications: mockApplications,

  submitApplication: async (
    app: Omit<Application, 'id' | 'status' | 'submittedAt' | 'auditLog'>,
  ) => {
    await delay(500);
    const now = new Date().toISOString();
    const newApp: Application = {
      ...app,
      id: `app-${uid()}`,
      status: 'pending',
      submittedAt: now,
      auditLog: [
        {
          id: `al-${uid()}`,
          action: 'submitted',
          performedBy: 'system',
          performedAt: now,
          details: 'Application submitted',
        },
      ],
    };
    set((s) => ({ applications: [...s.applications, newApp] }));
  },

  reviewApplication: (
    id: string,
    action: 'approved' | 'declined',
    reviewerId: string,
    notes?: string,
  ) => {
    const now = new Date().toISOString();
    const auditEntry: AuditEntry = {
      id: `al-${uid()}`,
      action,
      performedBy: reviewerId,
      performedAt: now,
      details: notes ?? `Application ${action}`,
    };

    set((s) => {
      const updatedApps = s.applications.map((app) => {
        if (app.id !== id) return app;
        return {
          ...app,
          status: action as Application['status'],
          reviewedBy: reviewerId,
          reviewedAt: now,
          notes: notes ?? app.notes,
          auditLog: [...app.auditLog, auditEntry],
        };
      });

      // When approved, create a new Store from the application
      let updatedStores = s.stores;
      if (action === 'approved') {
        const approvedApp = updatedApps.find((a) => a.id === id);
        if (approvedApp) {
          const newStore: Store = {
            id: `store-${uid()}`,
            name: approvedApp.storeName,
            businessName: approvedApp.storeName,
            ownerName: approvedApp.fullName,
            address: approvedApp.address,
            lat: approvedApp.lat,
            lng: approvedApp.lng,
            plantId: approvedApp.assignedPlantId,
            distributorId: approvedApp.assignedDistributorId,
            areaSupervisorId: approvedApp.assignedAreaSupervisorId ?? '',
            franchiseType: approvedApp.referralType === 'distributor' ? 'distributor' : 'direct',
            status: 'pending',
            province: '',
            area: '',
            phone: approvedApp.mobile,
            email: approvedApp.email,
            createdAt: now,
            deliveryStatus: 'active',
          };
          updatedStores = [...s.stores, newStore];
        }
      }

      return { applications: updatedApps, stores: updatedStores };
    });
  },

  // ─── Distributors ──────────────────────────────────────────────

  distributors: mockDistributors,

  // ─── Sub-Partner Distributors ─────────────────────────────────

  subPartnerDistributors: mockSubPartnerDistributors,

  // ─── Area Supervisors ─────────────────────────────────────────────

  areaSupervisors: mockAreaSupervisors,

  // ─── Deliveries ────────────────────────────────────────────────

  deliveries: mockDeliveries,

  addDelivery: (delivery: Delivery) => {
    set((s) => ({ deliveries: [...s.deliveries, delivery] }));
  },

  updateDelivery: (id: string, updates: Partial<Delivery>) => {
    set((s) => ({
      deliveries: s.deliveries.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      ),
    }));
  },

  // ─── Beginning Inventory ───────────────────────────────────────

  beginningInventories: mockBeginningInventories,

  addBeginningInventory: (inv: BeginningInventory) => {
    set((s) => ({
      beginningInventories: [...s.beginningInventories, inv],
    }));
  },

  confirmBeginningInventory: (id: string, items: InventoryItem[]) => {
    set((s) => ({
      beginningInventories: s.beginningInventories.map((bi) =>
        bi.id === id
          ? { ...bi, confirmedItems: items, status: 'confirmed' as const }
          : bi,
      ),
    }));
  },

  // ─── Ending Inventory ─────────────────────────────────────────

  endingInventories: mockEndingInventories,

  addEndingInventory: (inv: EndingInventory) => {
    set((s) => ({
      endingInventories: [...s.endingInventories, inv],
    }));
  },

  confirmEndingInventory: (id: string, items: InventoryItem[]) => {
    set((s) => ({
      endingInventories: s.endingInventories.map((ei) =>
        ei.id === id
          ? { ...ei, unsoldItems: items, status: 'confirmed' as const }
          : ei,
      ),
    }));
  },

  // ─── Ending Inventory Review (state machine) ──────────────────

  approveEndingInventory: (id, reviewerId, comment) => {
    const ei = get().endingInventories.find((e) => e.id === id);
    if (!ei || ei.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'approved',
      performedBy: reviewerId,
      performedAt: now,
      comment,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'approved' as const,
              revisions: [...(e.revisions ?? []), review],
              reviewedBy: reviewerId,
              reviewedAt: now,
            }
          : e,
      ),
    }));

    get().addNotification({
      title: 'Ending Inventory Approved',
      message: `Your ending inventory dated ${ei.date} has been approved.`,
      type: 'inventory_review',
      targetStoreId: ei.storeId,
    });

    // Approved EIs feed the billing layer — recompute so billings reflect.
    recomputeBillings();
  },

  markEndingInventoryNeedsReview: (id, reviewerId, comment) => {
    const ei = get().endingInventories.find((e) => e.id === id);
    if (!ei || ei.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'needs_review',
      performedBy: reviewerId,
      performedAt: now,
      comment,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'needs_review' as const,
              revisions: [...(e.revisions ?? []), review],
              reviewedBy: reviewerId,
              reviewedAt: now,
            }
          : e,
      ),
    }));

    get().addNotification({
      title: 'Ending Inventory Needs Review',
      message: `Reviewer asked for clarification on your ending inventory dated ${ei.date}: ${comment}`,
      type: 'inventory_review',
      targetStoreId: ei.storeId,
    });
  },

  requestEndingInventoryCorrection: (id, reviewerId, corrections, reason) => {
    const ei = get().endingInventories.find((e) => e.id === id);
    if (!ei || ei.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'correction_requested',
      performedBy: reviewerId,
      performedAt: now,
      reason,
      corrections,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'correction_required' as const,
              revisions: [...(e.revisions ?? []), review],
              reviewedBy: reviewerId,
              reviewedAt: now,
            }
          : e,
      ),
    }));

    get().addNotification({
      title: 'Ending Inventory Needs Correction',
      message: `Reviewer requested specific corrections for your ending inventory dated ${ei.date}. Please review and resubmit.`,
      type: 'inventory_review',
      targetStoreId: ei.storeId,
    });
  },

  resubmitEndingInventory: (id, items, submitterId, comment) => {
    const ei = get().endingInventories.find((e) => e.id === id);
    if (!ei || ei.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'resubmitted',
      performedBy: submitterId,
      performedAt: now,
      comment,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id
          ? {
              ...e,
              unsoldItems: items,
              status: 'pending_review' as const,
              revisions: [...(e.revisions ?? []), review],
            }
          : e,
      ),
    }));
  },

  // ─── Billing ──────────────────────────────────────────────────

  billingRecords: initialBillings,

  updateBillingRecord: (id: string, updates: Partial<BillingRecord>) => {
    set((s) => ({
      billingRecords: s.billingRecords.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    }));
  },

  // ─── Payments ─────────────────────────────────────────────────

  payments: mockPayments,

  submitPayment: (payment: Omit<Payment, 'id' | 'status' | 'submittedAt'>) => {
    const newPayment: Payment = {
      ...payment,
      id: `pay-${uid()}`,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    set((s) => ({ payments: [...s.payments, newPayment] }));
  },

  verifyPayment: (
    id: string,
    action: 'verified' | 'rejected',
    verifiedBy: string,
    reason?: string,
  ) => {
    set((s) => ({
      payments: s.payments.map((p) =>
        p.id === id
          ? {
              ...p,
              status: action as Payment['status'],
              verifiedBy,
              rejectedReason: action === 'rejected' ? reason : p.rejectedReason,
            }
          : p,
      ),
    }));

    // Payment status affects billing.status (paid / issued / overdue).
    recomputeBillings();
  },

  // ─── Packaging ────────────────────────────────────────────────

  packagingCatalog: mockPackagingCatalog,
  packagingOrders: mockPackagingOrders,

  submitPackagingOrder: (
    order: Omit<PackagingOrder, 'id' | 'status' | 'orderedAt'>,
  ) => {
    const newOrder: PackagingOrder = {
      ...order,
      id: `pko-${uid()}`,
      status: 'pending',
      orderedAt: new Date().toISOString(),
    };
    set((s) => ({
      packagingOrders: [...s.packagingOrders, newOrder],
    }));

    // Packaging totals flow into Zapp Billing for the matching cutoff.
    recomputeBillings();
  },

  // ─── Forecasts ────────────────────────────────────────────────

  forecasts: mockForecasts,

  saveForecast: (forecast: Forecast) => {
    set((s) => {
      const exists = s.forecasts.some((f) => f.id === forecast.id);
      if (exists) {
        return {
          forecasts: s.forecasts.map((f) =>
            f.id === forecast.id ? forecast : f,
          ),
        };
      }
      return { forecasts: [...s.forecasts, forecast] };
    });
  },

  // ─── Referral Codes ───────────────────────────────────────────

  referralCodes: mockReferralCodes,

  validateReferralCode: (code: string): ReferralCode | null => {
    const found = get().referralCodes.find(
      (rc) => rc.code.toLowerCase() === code.toLowerCase() && rc.status === 'active',
    );
    return found ?? null;
  },

  addReferralCode: (
    code: Omit<ReferralCode, 'id' | 'createdAt' | 'usageCount'>,
  ) => {
    const newCode: ReferralCode = {
      ...code,
      id: `ref-${uid()}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    set((s) => ({ referralCodes: [...s.referralCodes, newCode] }));
  },

  // ─── Sales / Analytics ────────────────────────────────────────

  salesMetrics: mockSalesMetrics,

  // ─── Notifications ────────────────────────────────────────────

  notifications: mockNotifications,

  markNotificationRead: (id: string) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  addNotification: (notif) => {
    const newNotif: Notification = {
      ...notif,
      id: `notif-${uid()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ notifications: [newNotif, ...s.notifications] }));
  },

  // ─── UI State ─────────────────────────────────────────────────

  sidebarOpen: true,

  toggleSidebar: () => {
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },

  // ─── Demo Users ───────────────────────────────────────────────

  demoUsers,

  // ─── Special Orders ───────────────────────────────────────────

  specialOrders: mockSpecialOrders,

  addSpecialOrder: (order: Omit<SpecialOrder, 'id'>) => {
    const newOrder: SpecialOrder = {
      ...order,
      id: `so-${uid()}`,
    };
    set((s) => ({ specialOrders: [...s.specialOrders, newOrder] }));

    // Special Orders are always sold and flow directly into billing totals.
    recomputeBillings();
  },

  // ─── Filtered Data Helpers ────────────────────────────────────

  getStoresForCurrentUser: (): Store[] => {
    const { currentUser, stores } = get();
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'owner':
      case 'operations_manager':
        return stores;

      case 'plant_manager':
      case 'forecaster':
      case 'billing_user':
        return stores.filter((s) => s.plantId === currentUser.plantId);

      case 'partner_distributor':
      case 'franchisee_distributor':
        return stores.filter((s) => s.distributorId === currentUser.distributorId);

      case 'sub_partner_distributor':
        return stores.filter(
          (s) => s.subPartnerDistributorId === currentUser.subPartnerDistributorId,
        );

      case 'area_manager':
        return stores.filter(
          (s) =>
            currentUser.assignedStoreIds?.includes(s.id) ||
            currentUser.areaIds?.includes(s.areaSupervisorId),
        );

      case 'franchisee_direct':
        return stores.filter(
          (s) => currentUser.assignedStoreIds?.includes(s.id),
        );

      default:
        return [];
    }
  },

  getDeliveriesForCurrentUser: (): Delivery[] => {
    const { currentUser, deliveries } = get();
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'owner':
      case 'operations_manager':
        return deliveries;

      case 'plant_manager':
      case 'forecaster':
      case 'billing_user':
        return deliveries.filter((d) => d.plantId === currentUser.plantId);

      case 'partner_distributor':
      case 'franchisee_distributor':
      case 'sub_partner_distributor': {
        const storeIds = get()
          .getStoresForCurrentUser()
          .map((s) => s.id);
        return deliveries.filter((d) => storeIds.includes(d.storeId));
      }

      case 'area_manager': {
        const storeIds = currentUser.assignedStoreIds ?? [];
        return deliveries.filter((d) => storeIds.includes(d.storeId));
      }

      case 'franchisee_direct': {
        const storeIds = currentUser.assignedStoreIds ?? [];
        return deliveries.filter((d) => storeIds.includes(d.storeId));
      }

      default:
        return [];
    }
  },

  getBillingForCurrentUser: (): BillingRecord[] => {
    const { currentUser, billingRecords } = get();
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'owner':
      case 'operations_manager':
        return billingRecords;

      case 'plant_manager':
      case 'billing_user':
        return billingRecords.filter((b) => b.plantId === currentUser.plantId);

      case 'partner_distributor':
      case 'franchisee_distributor':
        return billingRecords.filter(
          (b) => b.distributorId === currentUser.distributorId,
        );

      case 'sub_partner_distributor': {
        const storeIds = new Set(get().getStoresForCurrentUser().map((s) => s.id));
        return billingRecords.filter((b) => storeIds.has(b.storeId));
      }

      case 'area_manager': {
        const storeIds = currentUser.assignedStoreIds ?? [];
        return billingRecords.filter((b) => storeIds.includes(b.storeId));
      }

      case 'franchisee_direct': {
        const storeIds = currentUser.assignedStoreIds ?? [];
        return billingRecords.filter((b) => storeIds.includes(b.storeId));
      }

      case 'forecaster':
        return billingRecords.filter((b) => b.plantId === currentUser.plantId);

      default:
        return [];
    }
  },

  getEndingInventoriesForReview: (): EndingInventory[] => {
    const { currentUser, endingInventories, stores } = get();
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'owner':
      case 'operations_manager':
        return endingInventories;

      case 'partner_distributor': {
        const scopedStoreIds = new Set(
          stores
            .filter((s) => s.distributorId === currentUser.distributorId)
            .map((s) => s.id),
        );
        return endingInventories.filter((ei) => scopedStoreIds.has(ei.storeId));
      }

      case 'area_manager': {
        const scopedStoreIds = new Set(
          stores
            .filter(
              (s) =>
                s.franchiseType === 'direct' &&
                (currentUser.assignedStoreIds?.includes(s.id) ||
                  currentUser.areaIds?.includes(s.areaSupervisorId)),
            )
            .map((s) => s.id),
        );
        return endingInventories.filter((ei) => scopedStoreIds.has(ei.storeId));
      }

      default:
        return [];
    }
  },
  };
});
