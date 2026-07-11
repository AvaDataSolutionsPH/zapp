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
import { computeStoreDeliveryStatus } from '@/lib/deliveryEnforcement';
import { supabase } from '@/lib/supabase';
import { hydrateAll } from '@/services/db';
import {
  insertStore,
  insertApplication,
  updateApplication,
  insertDelivery,
  // Aliased because the Zustand action is also named updateDelivery —
  // keeps both call sites readable without renaming the public action.
  updateDelivery as updateDeliveryDB,
  insertBeginningInventory,
  updateBeginningInventory,
  insertEndingInventory,
  updateEndingInventory,
  insertPayment,
  updatePayment,
  updateStore as updateStoreDB,
  insertPackagingOrder,
  upsertForecast,
  insertReferralCode,
  insertSpecialOrder,
  insertNotification,
  updateNotification,
} from '@/services/dbWrite';

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

// Apply auto-derived delivery status to each store based on initial billings.
// Overrides any hard-coded deliveryStatus in the mock data — the auto rule
// (0/1/2+ overdue → active/warning/hold) is the source of truth.
const initialStores = mockStores.map((s) => ({
  ...s,
  deliveryStatus: computeStoreDeliveryStatus(s.id, initialBillings, mockPayments),
}));

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
  /** True while restoring an existing Supabase session at app boot. */
  authLoading: boolean;
  /** Where the entity slices currently come from: mock seed or Supabase DB. */
  dataSource: 'mock' | 'db';
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  /** Re-hydrate currentUser from Supabase session; call once at app mount. */
  restoreSession: () => Promise<void>;
  /** Fetch all entity tables from Supabase; falls back to mock on error. */
  hydrateFromDB: () => Promise<void>;

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
  ) => Promise<void>;

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
  updateDelivery: (id: string, updates: Partial<Delivery>) => Promise<void>;

  // Beginning Inventory
  beginningInventories: BeginningInventory[];
  addBeginningInventory: (inv: BeginningInventory) => void;
  confirmBeginningInventory: (id: string, items: InventoryItem[]) => Promise<void>;

  // Ending Inventory
  endingInventories: EndingInventory[];
  addEndingInventory: (inv: EndingInventory) => void;
  confirmEndingInventory: (id: string, items: InventoryItem[]) => Promise<void>;

  // Ending Inventory Review (state machine)
  approveEndingInventory: (id: string, reviewerId: string, comment?: string) => Promise<void>;
  markEndingInventoryNeedsReview: (
    id: string,
    reviewerId: string,
    comment: string,
  ) => Promise<void>;
  requestEndingInventoryCorrection: (
    id: string,
    reviewerId: string,
    corrections: EndingInventoryCorrectionItem[],
    reason: string,
  ) => Promise<void>;
  resubmitEndingInventory: (
    id: string,
    items: InventoryItem[],
    submitterId: string,
    comment?: string,
  ) => Promise<void>;

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
  ) => Promise<void>;

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
  // Packaging Order, verify Payment). Cascades into recomputeDeliveryStatuses
  // because every billing change can shift the overdue count and therefore
  // the auto-derived delivery status.
  const recomputeBillings = (): void => {
    const s = get();
    const nextBillings = computeBillingsFromState({
      endingInventories: s.endingInventories,
      specialOrders: s.specialOrders,
      packagingOrders: s.packagingOrders,
      deliveries: s.deliveries,
      stores: s.stores,
      payments: s.payments,
    });
    const nextStores = s.stores.map((st) => ({
      ...st,
      deliveryStatus: computeStoreDeliveryStatus(st.id, nextBillings, s.payments),
    }));
    set({ billingRecords: nextBillings, stores: nextStores });
  };

  // Match a Supabase-authenticated email to the local demo user profile.
  // Phase 1 keeps user profile data (role, distributorId, etc.) in mockData;
  // Supabase only verifies credentials. Phase 2 will migrate profiles to a
  // Postgres "users" table and replace this lookup.
  const findProfileByEmail = (email: string | undefined | null): User | null => {
    if (!email) return null;
    return (
      get().demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ??
      null
    );
  };

  return {
  // ─── Auth ───────────────────────────────────────────────────────

  // Boot with no session; restoreSession() re-hydrates from Supabase on mount.
  currentUser: null,
  isAuthenticated: false,
  authLoading: true,
  dataSource: 'mock',

  login: async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      return false;
    }
    const profile = findProfileByEmail(data.user?.email);
    if (!profile) {
      // Supabase auth succeeded but no matching local profile — sign out
      // to keep the two layers in sync. Phase 2 removes this branch.
      await supabase.auth.signOut();
      return false;
    }
    set({ currentUser: profile, isAuthenticated: true, authLoading: false });
    // Fire-and-forget DB hydration. If the schema isn't migrated yet (or
    // network fails) the store keeps the mock data and stays usable.
    void get().hydrateFromDB();
    return true;
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
    set({ currentUser: null, isAuthenticated: false, authLoading: false });
  },

  switchRole: (role: UserRole) => {
    // Dev-only helper: does NOT change the Supabase session, only the local
    // profile. Useful for previewing role dashboards without re-logging in.
    const user = get().demoUsers.find((u) => u.role === role);
    if (user) {
      set({ currentUser: user, isAuthenticated: true, authLoading: false });
    }
  },

  restoreSession: async (): Promise<void> => {
    const { data } = await supabase.auth.getSession();
    const sessionEmail = data.session?.user?.email;
    const profile = findProfileByEmail(sessionEmail);
    if (profile) {
      set({ currentUser: profile, isAuthenticated: true, authLoading: false });
      // Hydrate from DB after restoring an existing session, so a reload
      // doesn't drop the user back to mock data.
      void get().hydrateFromDB();
    } else {
      set({ currentUser: null, isAuthenticated: false, authLoading: false });
    }
  },

  hydrateFromDB: async (): Promise<void> => {
    try {
      const data = await hydrateAll();
      // Replace the entity slices with DB data, then recompute the derived
      // billing + delivery status slices the same way they were computed
      // from mock data at module load.
      const nextBillings = computeBillingsFromState({
        endingInventories: data.endingInventories,
        specialOrders: data.specialOrders,
        packagingOrders: data.packagingOrders,
        deliveries: data.deliveries,
        stores: data.stores,
        payments: data.payments,
      });
      const nextStores = data.stores.map((st) => ({
        ...st,
        deliveryStatus: computeStoreDeliveryStatus(st.id, nextBillings, data.payments),
      }));
      set({
        plants: data.plants,
        skus: data.skus,
        packagingCatalog: data.packagingCatalog,
        distributors: data.distributors,
        subPartnerDistributors: data.subPartnerDistributors,
        areaSupervisors: data.areaSupervisors,
        demoUsers: data.users,
        stores: nextStores,
        applications: data.applications,
        deliveries: data.deliveries,
        beginningInventories: data.beginningInventories,
        endingInventories: data.endingInventories,
        payments: data.payments,
        packagingOrders: data.packagingOrders,
        forecasts: data.forecasts,
        referralCodes: data.referralCodes,
        salesMetrics: data.salesMetrics,
        notifications: data.notifications,
        specialOrders: data.specialOrders,
        billingRecords: nextBillings,
        dataSource: 'db',
      });
    } catch (err) {
      // Schema not migrated yet, network failed, or permissive RLS not
      // applied. Leave the store on the mock slices so the app still works.
      console.warn('[useStore] hydrateFromDB failed — staying on mock data:', err);
    }
  },

  // ─── Plants ─────────────────────────────────────────────────────

  plants: mockPlants,

  // ─── SKUs ───────────────────────────────────────────────────────

  skus: mockSkus,

  // ─── Stores ─────────────────────────────────────────────────────

  stores: initialStores,

  addStore: (store: Store) => {
    // Optimistic in-memory insert. Background-persist when DB is the
    // current source of truth; roll the row out on failure so the UI
    // stays consistent with what's actually in Supabase.
    set((s) => ({ stores: [...s.stores, store] }));
    if (get().dataSource !== 'db') return;
    void insertStore(store).catch((err) => {
      console.error('[useStore] addStore DB write failed, rolling back:', err);
      set((s) => ({ stores: s.stores.filter((st) => st.id !== store.id) }));
    });
  },

  updateStore: (id: string, updates: Partial<Store>) => {
    const prev = get().stores.find((st) => st.id === id);
    if (!prev) return;
    const updated: Store = { ...prev, ...updates };
    // Optimistic in-memory update…
    set((s) => ({
      stores: s.stores.map((st) => (st.id === id ? updated : st)),
    }));
    // …then persist (background) and roll back on failure. Previously this
    // action was in-memory ONLY, so edits (e.g. the New Franchisee shop code)
    // silently vanished on the next hydrate from Supabase.
    if (get().dataSource !== 'db') return;
    void updateStoreDB(updated).catch((err) => {
      console.error('[useStore] updateStore DB write failed, rolling back:', err);
      set((s) => ({
        stores: s.stores.map((st) => (st.id === id ? prev : st)),
      }));
    });
  },

  // ─── Delivery Enforcement ─────────────────────────────────────

  requestStopDelivery: (storeId: string) => {
    const prev = get().stores.find((st) => st.id === storeId);
    if (!prev) return;
    const updated: Store = { ...prev, deliveryStatus: 'hold' };
    set((s) => ({
      stores: s.stores.map((st) => (st.id === storeId ? updated : st)),
    }));
    if (get().dataSource !== 'db') return;
    void updateStoreDB(updated).catch((err) => {
      console.error('[useStore] requestStopDelivery DB write failed, rolling back:', err);
      set((s) => ({
        stores: s.stores.map((st) => (st.id === storeId ? prev : st)),
      }));
    });
  },

  resumeDelivery: (storeId: string) => {
    const prev = get().stores.find((st) => st.id === storeId);
    if (!prev) return;
    const updated: Store = { ...prev, deliveryStatus: 'active' };
    set((s) => ({
      stores: s.stores.map((st) => (st.id === storeId ? updated : st)),
    }));
    if (get().dataSource !== 'db') return;
    void updateStoreDB(updated).catch((err) => {
      console.error('[useStore] resumeDelivery DB write failed, rolling back:', err);
      set((s) => ({
        stores: s.stores.map((st) => (st.id === storeId ? prev : st)),
      }));
    });
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
    // Optimistic in-memory insert so the UI updates immediately.
    set((s) => ({ applications: [...s.applications, newApp] }));

    // ALWAYS persist — unlike the other mutations, this one is only ever
    // called from the PUBLIC /apply form, whose users are anonymous and
    // therefore never hydrate (dataSource stays 'mock'). Gating on
    // dataSource here would silently drop every real applicant's
    // submission (it would show "Submitted!" but never reach the DB /
    // reviewer queue). The insert runs under the anon role, so the
    // `applications` table needs an anon INSERT RLS policy
    // (apps_insert_public — see supabase/migrations/006). Caller awaits
    // this Promise, so we roll back the optimistic row and re-throw on
    // failure and let the form surface the error to the user.
    try {
      await insertApplication(newApp);
    } catch (err) {
      console.error('[useStore] submitApplication DB write failed, rolling back:', err);
      set((s) => ({
        applications: s.applications.filter((a) => a.id !== newApp.id),
      }));
      throw err;
    }
  },

  reviewApplication: async (
    id: string,
    action: 'approved' | 'declined',
    reviewerId: string,
    notes?: string,
  ) => {
    const state = get();
    const targetApp = state.applications.find((a) => a.id === id);
    if (!targetApp) return;

    // Snapshot for rollback if either DB write fails.
    const prevApplications = state.applications;
    const prevStores = state.stores;

    const now = new Date().toISOString();
    const auditEntry: AuditEntry = {
      id: `al-${uid()}`,
      action,
      performedBy: reviewerId,
      performedAt: now,
      details: notes ?? `Application ${action}`,
    };

    const updatedApp: Application = {
      ...targetApp,
      status: action as Application['status'],
      reviewedBy: reviewerId,
      reviewedAt: now,
      notes: notes ?? targetApp.notes,
      auditLog: [...targetApp.auditLog, auditEntry],
    };
    const updatedApps = state.applications.map((a) => (a.id === id ? updatedApp : a));

    // Compute the new Store outside the set callback so the background
    // writer can reference it.
    let newStore: Store | null = null;
    let updatedStores = state.stores;
    if (action === 'approved') {
      // The DB requires a non-null area_supervisor_id with an FK to
      // area_supervisors.id. If the application didn't capture an area
      // supervisor (e.g. distributor referral with no AS auto-assign),
      // fall back to the first AS in the same plant — keeps the new
      // store routable. A future enhancement adds an explicit "assign
      // area supervisor" step before approval.
      let resolvedAreaSupId = updatedApp.assignedAreaSupervisorId ?? '';
      if (!resolvedAreaSupId) {
        const fallbackAS =
          state.areaSupervisors.find((as) => as.plantId === updatedApp.assignedPlantId) ??
          state.areaSupervisors[0];
        resolvedAreaSupId = fallbackAS?.id ?? '';
      }

      newStore = {
        id: `store-${uid()}`,
        name: updatedApp.storeName,
        businessName: updatedApp.storeName,
        ownerName: updatedApp.fullName,
        address: updatedApp.address,
        lat: updatedApp.lat,
        lng: updatedApp.lng,
        // Onboarding fields carried over from the application (undefined for the
        // public /apply flow, which doesn't collect them).
        shopCode: updatedApp.shopCode,
        plantId: updatedApp.assignedPlantId,
        distributorId: updatedApp.assignedDistributorId,
        subPartnerDistributorId: updatedApp.assignedSubPartnerDistributorId,
        areaSupervisorId: resolvedAreaSupId,
        // Distributor AND sub-partner channels are distributor-type stores (they
        // sit under a PD); only zapp_internal (direct) is a direct franchise.
        franchiseType:
          updatedApp.referralType === 'distributor' ||
          updatedApp.referralType === 'sub_partner_distributor'
            ? 'distributor'
            : 'direct',
        status: 'pending',
        province: '',
        area: '',
        phone: updatedApp.mobile,
        email: updatedApp.email,
        createdAt: now,
        deliveryStatus: 'active',
        deliverySchedule: updatedApp.deliverySchedule,
        openingDate: updatedApp.openingDate,
      };
      updatedStores = [...state.stores, newStore];
    }

    // Optimistic UI update.
    set({ applications: updatedApps, stores: updatedStores });

    if (get().dataSource !== 'db') return;

    // Background writes. UPDATE the application first, then INSERT the
    // store on approval. If the store insert fails AFTER the app update
    // succeeded, we run a compensating rollback (re-update the app back
    // to its previous shape) so the DB doesn't end up with an approved
    // application that has no matching store. The compensating write
    // is best-effort — if it also fails, we log loudly so it can be
    // fixed manually. Future revision: wrap both writes in a Postgres
    // function (RPC) for true atomicity.
    try {
      await updateApplication(updatedApp);
    } catch (err) {
      console.error('[useStore] reviewApplication: app UPDATE failed, rolling back:', err);
      set({ applications: prevApplications, stores: prevStores });
      throw err;
    }

    if (newStore) {
      try {
        await insertStore(newStore);
      } catch (storeErr) {
        console.error(
          '[useStore] reviewApplication: store INSERT failed, compensating app UPDATE:',
          storeErr,
        );
        try {
          await updateApplication(targetApp);
        } catch (compErr) {
          console.error(
            '[useStore] reviewApplication: COMPENSATING rollback ALSO failed — application is now orphaned in DB (approved without matching store). Manual fix required.',
            compErr,
          );
        }
        set({ applications: prevApplications, stores: prevStores });
        throw storeErr;
      }
    }
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
    // Optimistic in-memory insert. Background-persist when DB is the
    // current source of truth; roll the row out on failure so the UI
    // stays consistent with what's actually in Supabase.
    set((s) => ({ deliveries: [...s.deliveries, delivery] }));
    if (get().dataSource !== 'db') return;
    void insertDelivery(delivery).catch((err) => {
      console.error('[useStore] addDelivery DB write failed, rolling back:', err);
      set((s) => ({
        deliveries: s.deliveries.filter((d) => d.id !== delivery.id),
      }));
    });
  },

  updateDelivery: async (id: string, updates: Partial<Delivery>) => {
    const prev = get().deliveries.find((d) => d.id === id);
    if (!prev) return;
    const merged: Delivery = { ...prev, ...updates };

    // Optimistic UI update. Background write replaces the full row
    // using the merged shape so JSONB items / numeric totals stay in
    // sync with the in-memory copy. On failure we restore the snapshot
    // and re-throw so the caller can surface an error toast.
    set((s) => ({
      deliveries: s.deliveries.map((d) => (d.id === id ? merged : d)),
    }));
    if (get().dataSource !== 'db') return;
    try {
      await updateDeliveryDB(merged);
    } catch (err) {
      console.error('[useStore] updateDelivery DB write failed, rolling back:', err);
      set((s) => ({
        deliveries: s.deliveries.map((d) => (d.id === id ? prev : d)),
      }));
      throw err;
    }
  },

  // ─── Beginning Inventory ───────────────────────────────────────

  beginningInventories: mockBeginningInventories,

  addBeginningInventory: (inv: BeginningInventory) => {
    // Optimistic in-memory insert. Background-persist when DB is the
    // source of truth; rollback on failure.
    set((s) => ({
      beginningInventories: [...s.beginningInventories, inv],
    }));
    if (get().dataSource !== 'db') return;
    void insertBeginningInventory(inv).catch((err) => {
      console.error('[useStore] addBeginningInventory DB write failed, rolling back:', err);
      set((s) => ({
        beginningInventories: s.beginningInventories.filter((b) => b.id !== inv.id),
      }));
    });
  },

  confirmBeginningInventory: async (id: string, items: InventoryItem[]) => {
    const prev = get().beginningInventories.find((b) => b.id === id);
    if (!prev) return;
    const updated: BeginningInventory = {
      ...prev,
      confirmedItems: items,
      status: 'confirmed',
    };
    set((s) => ({
      beginningInventories: s.beginningInventories.map((bi) =>
        bi.id === id ? updated : bi,
      ),
    }));
    if (get().dataSource !== 'db') return;
    try {
      await updateBeginningInventory(updated);
    } catch (err) {
      console.error('[useStore] confirmBeginningInventory DB write failed, rolling back:', err);
      set((s) => ({
        beginningInventories: s.beginningInventories.map((bi) =>
          bi.id === id ? prev : bi,
        ),
      }));
      throw err;
    }
  },

  // ─── Ending Inventory ─────────────────────────────────────────

  endingInventories: mockEndingInventories,

  addEndingInventory: (inv: EndingInventory) => {
    // Optimistic in-memory insert. Background-persist when DB is the
    // source of truth; rollback on failure.
    set((s) => ({
      endingInventories: [...s.endingInventories, inv],
    }));
    if (get().dataSource !== 'db') return;
    void insertEndingInventory(inv).catch((err) => {
      console.error('[useStore] addEndingInventory DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.filter((e) => e.id !== inv.id),
      }));
    });
  },

  confirmEndingInventory: async (id: string, items: InventoryItem[]) => {
    const prev = get().endingInventories.find((e) => e.id === id);
    if (!prev) return;
    const updated: EndingInventory = {
      ...prev,
      unsoldItems: items,
      status: 'confirmed',
    };
    set((s) => ({
      endingInventories: s.endingInventories.map((ei) =>
        ei.id === id ? updated : ei,
      ),
    }));
    if (get().dataSource !== 'db') return;
    try {
      await updateEndingInventory(updated);
    } catch (err) {
      console.error('[useStore] confirmEndingInventory DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.map((ei) =>
          ei.id === id ? prev : ei,
        ),
      }));
      throw err;
    }
  },

  // ─── Ending Inventory Review (state machine) ──────────────────

  approveEndingInventory: async (id, reviewerId, comment) => {
    const prevEI = get().endingInventories.find((e) => e.id === id);
    if (!prevEI || prevEI.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'approved',
      performedBy: reviewerId,
      performedAt: now,
      comment,
    };
    const updatedEI: EndingInventory = {
      ...prevEI,
      status: 'approved',
      revisions: [...(prevEI.revisions ?? []), review],
      reviewedBy: reviewerId,
      reviewedAt: now,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id ? updatedEI : e,
      ),
    }));

    // Notification side effect — still in-memory; Chunk 5 wires
    // notifications to Supabase. Approved EIs feed the billing layer,
    // so we recompute synchronously before the DB write — keeps the UI
    // and billing slice consistent during the optimistic window.
    get().addNotification({
      title: 'Ending Inventory Approved',
      message: `Your ending inventory dated ${prevEI.date} has been approved.`,
      type: 'inventory_review',
      targetStoreId: prevEI.storeId,
    });
    recomputeBillings();

    if (get().dataSource !== 'db') return;
    try {
      await updateEndingInventory(updatedEI);
    } catch (err) {
      console.error('[useStore] approveEndingInventory DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.map((e) =>
          e.id === id ? prevEI : e,
        ),
      }));
      // Re-run the billing cascade against the restored EI state so
      // billing rows + delivery statuses revert in lockstep.
      recomputeBillings();
      throw err;
    }
  },

  markEndingInventoryNeedsReview: async (id, reviewerId, comment) => {
    const prevEI = get().endingInventories.find((e) => e.id === id);
    if (!prevEI || prevEI.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'needs_review',
      performedBy: reviewerId,
      performedAt: now,
      comment,
    };
    const updatedEI: EndingInventory = {
      ...prevEI,
      status: 'needs_review',
      revisions: [...(prevEI.revisions ?? []), review],
      reviewedBy: reviewerId,
      reviewedAt: now,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id ? updatedEI : e,
      ),
    }));

    get().addNotification({
      title: 'Ending Inventory Needs Review',
      message: `Reviewer asked for clarification on your ending inventory dated ${prevEI.date}: ${comment}`,
      type: 'inventory_review',
      targetStoreId: prevEI.storeId,
    });

    if (get().dataSource !== 'db') return;
    try {
      await updateEndingInventory(updatedEI);
    } catch (err) {
      console.error('[useStore] markEndingInventoryNeedsReview DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.map((e) =>
          e.id === id ? prevEI : e,
        ),
      }));
      throw err;
    }
  },

  requestEndingInventoryCorrection: async (id, reviewerId, corrections, reason) => {
    const prevEI = get().endingInventories.find((e) => e.id === id);
    if (!prevEI || prevEI.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'correction_requested',
      performedBy: reviewerId,
      performedAt: now,
      reason,
      corrections,
    };
    const updatedEI: EndingInventory = {
      ...prevEI,
      status: 'correction_required',
      revisions: [...(prevEI.revisions ?? []), review],
      reviewedBy: reviewerId,
      reviewedAt: now,
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id ? updatedEI : e,
      ),
    }));

    get().addNotification({
      title: 'Ending Inventory Needs Correction',
      message: `Reviewer requested specific corrections for your ending inventory dated ${prevEI.date}. Please review and resubmit.`,
      type: 'inventory_review',
      targetStoreId: prevEI.storeId,
    });

    if (get().dataSource !== 'db') return;
    try {
      await updateEndingInventory(updatedEI);
    } catch (err) {
      console.error('[useStore] requestEndingInventoryCorrection DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.map((e) =>
          e.id === id ? prevEI : e,
        ),
      }));
      throw err;
    }
  },

  resubmitEndingInventory: async (id, items, submitterId, comment) => {
    const prevEI = get().endingInventories.find((e) => e.id === id);
    if (!prevEI || prevEI.status === 'approved') return;

    const now = new Date().toISOString();
    const review: EndingInventoryReview = {
      id: `eir-${uid()}`,
      action: 'resubmitted',
      performedBy: submitterId,
      performedAt: now,
      comment,
    };
    const updatedEI: EndingInventory = {
      ...prevEI,
      unsoldItems: items,
      status: 'pending_review',
      revisions: [...(prevEI.revisions ?? []), review],
    };

    set((s) => ({
      endingInventories: s.endingInventories.map((e) =>
        e.id === id ? updatedEI : e,
      ),
    }));

    if (get().dataSource !== 'db') return;
    try {
      await updateEndingInventory(updatedEI);
    } catch (err) {
      console.error('[useStore] resubmitEndingInventory DB write failed, rolling back:', err);
      set((s) => ({
        endingInventories: s.endingInventories.map((e) =>
          e.id === id ? prevEI : e,
        ),
      }));
      throw err;
    }
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
    // Optimistic in-memory insert. Background-persist when DB is the
    // source of truth; rollback on failure.
    set((s) => ({ payments: [...s.payments, newPayment] }));
    if (get().dataSource !== 'db') return;
    void insertPayment(newPayment).catch((err) => {
      console.error('[useStore] submitPayment DB write failed, rolling back:', err);
      set((s) => ({ payments: s.payments.filter((p) => p.id !== newPayment.id) }));
    });
  },

  verifyPayment: async (
    id: string,
    action: 'verified' | 'rejected',
    verifiedBy: string,
    reason?: string,
  ) => {
    const prevPayment = get().payments.find((p) => p.id === id);
    if (!prevPayment) return;
    const updatedPayment: Payment = {
      ...prevPayment,
      status: action as Payment['status'],
      verifiedBy,
      rejectedReason: action === 'rejected' ? reason : prevPayment.rejectedReason,
    };

    set((s) => ({
      payments: s.payments.map((p) => (p.id === id ? updatedPayment : p)),
    }));

    // Payment status affects billing.status (paid / issued / overdue),
    // so we recompute synchronously before the DB write to keep the UI
    // consistent during the optimistic window.
    recomputeBillings();

    if (get().dataSource !== 'db') return;
    try {
      await updatePayment(updatedPayment);
    } catch (err) {
      console.error('[useStore] verifyPayment DB write failed, rolling back:', err);
      set((s) => ({
        payments: s.payments.map((p) => (p.id === id ? prevPayment : p)),
      }));
      // Restore the prior billing state in lockstep with the payment.
      recomputeBillings();
      throw err;
    }
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

    if (get().dataSource !== 'db') return;
    void insertPackagingOrder(newOrder).catch((err) => {
      console.error('[useStore] submitPackagingOrder DB write failed, rolling back:', err);
      set((s) => ({
        packagingOrders: s.packagingOrders.filter((p) => p.id !== newOrder.id),
      }));
      recomputeBillings();
    });
  },

  // ─── Forecasts ────────────────────────────────────────────────

  forecasts: mockForecasts,

  saveForecast: (forecast: Forecast) => {
    const prev = get().forecasts.find((f) => f.id === forecast.id);
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

    if (get().dataSource !== 'db') return;
    // upsert handles both create and update in a single DB call.
    void upsertForecast(forecast).catch((err) => {
      console.error('[useStore] saveForecast DB write failed, rolling back:', err);
      if (prev) {
        // Was an update — restore previous shape.
        set((s) => ({
          forecasts: s.forecasts.map((f) => (f.id === forecast.id ? prev : f)),
        }));
      } else {
        // Was an insert — drop the new row.
        set((s) => ({
          forecasts: s.forecasts.filter((f) => f.id !== forecast.id),
        }));
      }
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

    if (get().dataSource !== 'db') return;
    void insertReferralCode(newCode).catch((err) => {
      console.error('[useStore] addReferralCode DB write failed, rolling back:', err);
      set((s) => ({
        referralCodes: s.referralCodes.filter((r) => r.id !== newCode.id),
      }));
    });
  },

  // ─── Sales / Analytics ────────────────────────────────────────

  salesMetrics: mockSalesMetrics,

  // ─── Notifications ────────────────────────────────────────────

  notifications: mockNotifications,

  markNotificationRead: (id: string) => {
    const prev = get().notifications.find((n) => n.id === id);
    if (!prev || prev.read) return;
    const updated: Notification = { ...prev, read: true };
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? updated : n)),
    }));
    if (get().dataSource !== 'db') return;
    void updateNotification(updated).catch((err) => {
      console.error('[useStore] markNotificationRead DB write failed, rolling back:', err);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? prev : n)),
      }));
    });
  },

  addNotification: (notif) => {
    const newNotif: Notification = {
      ...notif,
      id: `notif-${uid()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ notifications: [newNotif, ...s.notifications] }));
    if (get().dataSource !== 'db') return;
    void insertNotification(newNotif).catch((err) => {
      console.error('[useStore] addNotification DB write failed, rolling back:', err);
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== newNotif.id),
      }));
    });
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

    if (get().dataSource !== 'db') return;
    void insertSpecialOrder(newOrder).catch((err) => {
      console.error('[useStore] addSpecialOrder DB write failed, rolling back:', err);
      set((s) => ({
        specialOrders: s.specialOrders.filter((so) => so.id !== newOrder.id),
      }));
      recomputeBillings();
    });
  },

  // ─── Filtered Data Helpers ────────────────────────────────────

  getStoresForCurrentUser: (): Store[] => {
    const { currentUser, stores } = get();
    if (!currentUser) return [];

    // Billing is a company-wide back-office function (it invoices every
    // distributor/store), so billing_user reads all stores — not plant-scoped.
    switch (currentUser.role) {
      case 'owner':
      case 'operations_manager':
      case 'billing_user':
        return stores;

      case 'plant_manager':
      case 'forecaster':
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
      case 'billing_user': // company-wide billing — see all deliveries
        return deliveries;

      case 'plant_manager':
      case 'forecaster':
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
      case 'billing_user': // company-wide billing — see all billings
        return billingRecords;

      case 'plant_manager':
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
