// ============================================================
// ZAPP Donuts ERP - Fake API Service Layer
// ============================================================
// Simulated async services with 300-800ms latency and
// occasional error simulation for realistic front-end dev.

import type {
  User,
  Application,
  Store,
  BeginningInventory,
  EndingInventory,
  AIResult,
  BillingRecord,
  Payment,
  PackagingItem,
  PackagingOrder,
  Forecast,
  ForecastItem,
  ReferralCode,
  Distributor,
  AreaSupervisor,
  Plant,
} from '@/types';

import {
  demoUsers,
  plants,
  skus,
  stores,
  applications,
  distributors,
  areaSupervisors,
  billingRecords,
  payments,
  packagingCatalog,
  packagingOrders,
  forecasts,
  referralCodes,
  salesMetrics,
} from '@/data/mockData';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate network latency (300-800 ms). */
const delay = (ms?: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms ?? 300 + Math.random() * 500));

/** Generate a simple pseudo-unique ID. */
const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Randomly throw to simulate a transient server error (~8 % chance). */
const maybeError = (label: string): void => {
  if (Math.random() < 0.08) {
    throw new Error(`[API] ${label}: simulated server error \u2013 please retry`);
  }
};

// ── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
  login: async (
    email: string,
    _password: string,
  ): Promise<{ success: boolean; user?: User }> => {
    await delay();
    maybeError('auth.login');
    const user = demoUsers.find((u) => u.email === email);
    if (!user) return { success: false };
    return { success: true, user };
  },

  logout: async (): Promise<void> => {
    await delay(200);
  },
};

// ── Application Service ──────────────────────────────────────────────────────

export const applicationService = {
  submit: async (
    _data: Partial<Application>,
  ): Promise<{ success: boolean; applicationId: string }> => {
    await delay();
    maybeError('application.submit');
    const id = uid('APP');
    return { success: true, applicationId: id };
  },

  getAll: async (filters?: {
    status?: string;
    plantId?: string;
  }): Promise<Application[]> => {
    await delay();
    maybeError('application.getAll');
    let result = [...applications];
    if (filters?.status) {
      result = result.filter((a) => a.status === filters.status);
    }
    if (filters?.plantId) {
      result = result.filter((a) => a.assignedPlantId === filters.plantId);
    }
    return result;
  },

  getById: async (id: string): Promise<Application | null> => {
    await delay();
    return applications.find((a) => a.id === id) ?? null;
  },

  review: async (
    id: string,
    action: 'approved' | 'declined',
    reviewerId: string,
  ): Promise<void> => {
    await delay();
    maybeError('application.review');
    const app = applications.find((a) => a.id === id);
    if (!app) throw new Error(`[API] Application ${id} not found`);
    // Mutate mock in-memory for session realism
    app.status = action;
    app.reviewedBy = reviewerId;
    app.reviewedAt = new Date().toISOString();
    app.auditLog.push({
      id: uid('AUD'),
      action,
      performedBy: reviewerId,
      performedAt: new Date().toISOString(),
      details: `Application ${action} by reviewer`,
    });
  },
};

// ── Referral Service ─────────────────────────────────────────────────────────

export const referralService = {
  validate: async (
    code: string,
  ): Promise<{
    valid: boolean;
    referral?: ReferralCode;
    distributor?: Distributor;
    areaSupervisor?: AreaSupervisor;
    plant?: Plant;
  }> => {
    await delay();
    const ref = referralCodes.find(
      (r) => r.code === code && r.status === 'active',
    );
    if (!ref) return { valid: false };
    const distributor = distributors.find((d) => d.id === ref.distributorId);
    const areaSupervisor = areaSupervisors.find((a) => a.id === ref.areaSupervisorId);
    const plant = plants.find((p) => p.id === ref.plantId);
    return { valid: true, referral: ref, distributor, areaSupervisor, plant };
  },

  generate: async (
    type: 'distributor' | 'zapp_internal',
    distributorId?: string,
  ): Promise<ReferralCode> => {
    await delay();
    maybeError('referral.generate');
    const codeStr =
      type === 'distributor'
        ? `DIST-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${new Date().getFullYear()}`
        : `ZAPP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${new Date().getFullYear()}`;
    const refCode: ReferralCode = {
      id: uid('REF'),
      code: codeStr,
      type,
      distributorId,
      plantId: distributorId
        ? (distributors.find((d) => d.id === distributorId)?.plantId ?? 'PLT-001')
        : 'PLT-001',
      status: 'active',
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    return refCode;
  },
};

// ── Store Service ────────────────────────────────────────────────────────────

export const storeService = {
  getAll: async (filters?: {
    plantId?: string;
    status?: string;
    distributorId?: string;
  }): Promise<Store[]> => {
    await delay();
    maybeError('store.getAll');
    let result = [...stores];
    if (filters?.plantId)
      result = result.filter((s) => s.plantId === filters.plantId);
    if (filters?.status)
      result = result.filter((s) => s.status === filters.status);
    if (filters?.distributorId)
      result = result.filter((s) => s.distributorId === filters.distributorId);
    return result;
  },

  getById: async (id: string): Promise<Store | null> => {
    await delay();
    return stores.find((s) => s.id === id) ?? null;
  },

  /** Public-facing directory: active stores only. */
  getDirectory: async (): Promise<Store[]> => {
    await delay();
    return stores.filter((s) => s.status === 'active');
  },
};

// ── Inventory Service ────────────────────────────────────────────────────────

export const inventoryService = {
  submitBeginning: async (
    data: Partial<BeginningInventory>,
  ): Promise<BeginningInventory> => {
    await delay();
    maybeError('inventory.submitBeginning');
    const record: BeginningInventory = {
      id: uid('BI'),
      deliveryId: data.deliveryId ?? '',
      storeId: data.storeId ?? '',
      date: data.date ?? new Date().toISOString().slice(0, 10),
      drImageUrl: data.drImageUrl ?? '',
      crateImageUrls: data.crateImageUrls ?? [],
      aiResults: data.aiResults ?? [],
      confirmedItems: data.confirmedItems ?? [],
      status: 'pending_ai',
      notes: data.notes,
    };
    return record;
  },

  submitEnding: async (
    data: Partial<EndingInventory>,
  ): Promise<EndingInventory> => {
    await delay();
    maybeError('inventory.submitEnding');
    const record: EndingInventory = {
      id: uid('EI'),
      deliveryId: data.deliveryId ?? '',
      storeId: data.storeId ?? '',
      date: data.date ?? new Date().toISOString().slice(0, 10),
      crateImageUrls: data.crateImageUrls ?? [],
      unsoldItems: data.unsoldItems ?? [],
      aiResults: data.aiResults ?? [],
      status: 'pending',
      notes: data.notes,
    };
    return record;
  },

  /** Simulate AI processing for DR / crate images. */
  processAI: async (
    type: 'beginning' | 'ending',
    _images: string[],
  ): Promise<AIResult[]> => {
    // Longer delay to simulate AI inference
    await delay(1200 + Math.random() * 800);
    maybeError('inventory.processAI');

    const subset = skus.slice(0, 5 + Math.floor(Math.random() * 4));
    return subset.map((sku, idx) => {
      const confidence: AIResult['confidence'] =
        idx < 2 ? 'high' : idx < 4 ? 'medium' : 'low';
      const baseQty = 20 + Math.floor(Math.random() * 40);
      const variance =
        confidence === 'high'
          ? 0
          : confidence === 'medium'
            ? Math.floor(Math.random() * 3) - 1
            : Math.floor(Math.random() * 5) - 2;
      const warnings: (string | undefined)[] = [
        undefined,
        'Uncertain SKU parse \u2014 verify manually',
        'Possible missing item in crate',
        'Quantity mismatch between DR and physical count',
        'Partial label obscured',
        'Duplicate entry suspected',
      ];
      const warning =
        confidence === 'high'
          ? undefined
          : warnings[Math.floor(Math.random() * warnings.length)];
      return {
        id: uid('AI'),
        type: (type === 'beginning' ? 'ocr_dr' : 'crate_estimate') as AIResult['type'],
        skuId: sku.id,
        skuName: sku.name,
        extractedValue: type === 'beginning' ? baseQty : undefined,
        estimatedValue: type === 'ending' ? baseQty + variance : undefined,
        confidence,
        warning,
      };
    });
  },
};

// ── AI Simulation Service ────────────────────────────────────────────────────
// Generates realistic mock AI outputs for the inventory workflow.

export const aiService = {
  /**
   * Simulate OCR on a DR image.
   * Returns SKU extractions with varying confidence levels.
   */
  processOCR: async (_imageUrl: string): Promise<AIResult[]> => {
    await delay(1000 + Math.random() * 600);
    maybeError('ai.processOCR');

    const ocrWarnings: (string | undefined)[] = [
      undefined,
      'Uncertain SKU parse \u2014 handwriting unclear',
      'Possible missing item \u2014 faint ink detected',
      'Quantity mismatch \u2014 digit partially cut off',
      'Multiple items on same line \u2014 split uncertain',
      'SKU code smudged \u2014 matched by product name',
    ];

    return skus.map((sku) => {
      const roll = Math.random();
      const confidence: AIResult['confidence'] =
        roll < 0.55 ? 'high' : roll < 0.85 ? 'medium' : 'low';
      const baseQty = 15 + Math.floor(Math.random() * 50);
      const warning =
        confidence === 'high'
          ? undefined
          : ocrWarnings[Math.floor(Math.random() * ocrWarnings.length)];
      return {
        id: uid('AI'),
        type: 'ocr_dr' as const,
        skuId: sku.id,
        skuName: sku.name,
        extractedValue: baseQty,
        confidence,
        warning,
      };
    });
  },
};

// ── Billing Service ──────────────────────────────────────────────────────────

export const billingService = {
  getAll: async (plantId?: string): Promise<BillingRecord[]> => {
    await delay();
    maybeError('billing.getAll');
    if (plantId) return billingRecords.filter((b) => b.plantId === plantId);
    return [...billingRecords];
  },

  getById: async (id: string): Promise<BillingRecord | null> => {
    await delay();
    return billingRecords.find((b) => b.id === id) ?? null;
  },

  uploadFile: async (id: string, _file: File): Promise<void> => {
    await delay(600 + Math.random() * 400);
    maybeError('billing.uploadFile');
    const record = billingRecords.find((b) => b.id === id);
    if (record) {
      record.invoiceFileUrl = `/mock/invoice-${id}.pdf`;
    }
  },

  /** Simulate Excel export \u2014 returns a small Blob with CSV data. */
  exportToExcel: async (plantId: string): Promise<Blob> => {
    await delay(800 + Math.random() * 400);
    maybeError('billing.exportToExcel');
    const relevant = billingRecords.filter((b) => b.plantId === plantId);
    const csv = [
      'ID,Store,Period,DR Total,Unsold Deduction,Packaging,Total Payable,Status',
      ...relevant.map(
        (b) =>
          `${b.id},${b.storeId},${b.period},${b.drTotal},${b.unsoldDeduction},${b.packagingTotal},${b.totalPayable},${b.status}`,
      ),
    ].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  },
};

// ── Payment Service ──────────────────────────────────────────────────────────

export const paymentService = {
  submit: async (data: Partial<Payment>): Promise<Payment> => {
    await delay();
    maybeError('payment.submit');
    const payment: Payment = {
      id: uid('PAY'),
      billingId: data.billingId ?? '',
      storeId: data.storeId ?? '',
      amount: data.amount ?? 0,
      method: data.method ?? 'gateway',
      referenceNumber: data.referenceNumber ?? uid('REF'),
      datePaid: data.datePaid ?? new Date().toISOString().slice(0, 10),
      proofUrl: data.proofUrl,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    return payment;
  },

  verify: async (
    id: string,
    action: 'verified' | 'rejected',
    verifiedBy: string,
    reason?: string,
  ): Promise<void> => {
    await delay();
    maybeError('payment.verify');
    const payment = payments.find((p) => p.id === id);
    if (!payment) throw new Error(`[API] Payment ${id} not found`);
    payment.status = action;
    payment.verifiedBy = verifiedBy;
    if (action === 'rejected' && reason) {
      payment.rejectedReason = reason;
    }
  },

  getHistory: async (storeId?: string): Promise<Payment[]> => {
    await delay();
    if (storeId) return payments.filter((p) => p.storeId === storeId);
    return [...payments];
  },
};

// ── Packaging Service ────────────────────────────────────────────────────────

export const packagingService = {
  getCatalog: async (): Promise<PackagingItem[]> => {
    await delay();
    return [...packagingCatalog];
  },

  submitOrder: async (
    data: Partial<PackagingOrder>,
  ): Promise<PackagingOrder> => {
    await delay();
    maybeError('packaging.submitOrder');
    const order: PackagingOrder = {
      id: uid('PO'),
      storeId: data.storeId ?? '',
      items: data.items ?? [],
      totalAmount: data.totalAmount ?? 0,
      status: 'pending',
      orderedAt: new Date().toISOString(),
    };
    return order;
  },

  getOrders: async (storeId?: string): Promise<PackagingOrder[]> => {
    await delay();
    if (storeId) return packagingOrders.filter((o) => o.storeId === storeId);
    return [...packagingOrders];
  },
};

// ── Forecasting Service ──────────────────────────────────────────────────────

export const forecastService = {
  getForStore: async (storeId: string): Promise<Forecast | null> => {
    await delay();
    return forecasts.find((f) => f.storeId === storeId) ?? null;
  },

  save: async (forecast: Forecast): Promise<void> => {
    await delay();
    maybeError('forecast.save');
    const idx = forecasts.findIndex((f) => f.id === forecast.id);
    if (idx >= 0) {
      forecasts[idx] = forecast;
    }
  },

  /** Generate AI-powered forecast recommendations for a store. */
  generateRecommendation: async (storeId: string): Promise<ForecastItem[]> => {
    await delay(1000 + Math.random() * 600);
    maybeError('forecast.generateRecommendation');

    const store = stores.find((s) => s.id === storeId);
    if (!store) throw new Error(`[API] Store ${storeId} not found`);

    const pressures: Array<'hot' | 'normal' | 'weak'> = [
      'hot',
      'normal',
      'weak',
    ];
    return skus.slice(0, 7).map((sku) => {
      const avg14 = 20 + Math.floor(Math.random() * 35);
      const unsold = -(Math.floor(Math.random() * 5));
      const dow = Math.floor(Math.random() * 8) - 2;
      const pressure = pressures[Math.floor(Math.random() * 3)];
      const modifier =
        pressure === 'hot'
          ? 1.1 + Math.random() * 0.1
          : pressure === 'weak'
            ? 0.85 + Math.random() * 0.1
            : 1.0;
      const finalVal = Math.round((avg14 + unsold + dow) * modifier);
      return {
        skuId: sku.id,
        skuName: sku.name,
        avg14Day: avg14,
        unsoldAdjustment: unsold,
        dayOfWeekAdjustment: dow,
        demandPressure: pressure,
        pressureModifier: Math.round(modifier * 100) / 100,
        finalForecast: Math.max(finalVal, 0),
      };
    });
  },
};

// ── Analytics Service ────────────────────────────────────────────────────────

export const analyticsService = {
  getSalesOverview: async (filters?: {
    period?: string;
    plantId?: string;
  }): Promise<{
    totalRevenue: number;
    totalDRSales: number;
    activeStores: number;
    avgRevenuePerStore: number;
    revenueByMonth: { month: string; revenue: number }[];
    topProducts: { skuName: string; quantity: number; revenue: number }[];
  }> => {
    await delay();
    let metrics = [...salesMetrics];
    if (filters?.period)
      metrics = metrics.filter((m) => m.period === filters.period);
    if (filters?.plantId)
      metrics = metrics.filter((m) => m.plantId === filters.plantId);

    const totalRevenue = metrics.reduce((s, m) => s + m.srpSales, 0);
    const totalDRSales = metrics.reduce((s, m) => s + m.drSales, 0);
    const activeStoreCount = stores.filter((s) => s.status === 'active').length;

    return {
      totalRevenue,
      totalDRSales,
      activeStores: activeStoreCount,
      avgRevenuePerStore: activeStoreCount
        ? Math.round(totalRevenue / activeStoreCount)
        : 0,
      revenueByMonth: [
        { month: '2026-01', revenue: 180000 },
        {
          month: '2026-02',
          revenue: totalRevenue > 0 ? totalRevenue : 240000,
        },
        { month: '2026-03', revenue: Math.round(totalRevenue * 0.7) },
      ],
      topProducts: [
        { skuName: 'Classic Glazed', quantity: 1250, revenue: 31250 },
        { skuName: 'Chocolate Ring', quantity: 980, revenue: 27440 },
        { skuName: 'Ube Cheese', quantity: 720, revenue: 25200 },
        { skuName: 'Bavarian Cream', quantity: 650, revenue: 19500 },
        { skuName: 'ZAPP Iced Coffee (16oz)', quantity: 580, revenue: 26100 },
      ],
    };
  },

  getDistributorLeaderboard: async (filters?: {
    period?: string;
  }): Promise<
    {
      distributorId: string;
      distributorName: string;
      storeCount: number;
      totalRevenue: number;
      rank: number;
    }[]
  > => {
    await delay();
    let metrics = [...salesMetrics];
    if (filters?.period)
      metrics = metrics.filter((m) => m.period === filters.period);

    const byDist = new Map<string, number>();
    for (const m of metrics) {
      if (m.distributorId) {
        byDist.set(
          m.distributorId,
          (byDist.get(m.distributorId) ?? 0) + m.srpSales,
        );
      }
    }

    return distributors
      .filter((d) => byDist.has(d.id))
      .map((d) => ({
        distributorId: d.id,
        distributorName: d.name,
        storeCount: stores.filter((s) => s.distributorId === d.id).length,
        totalRevenue: byDist.get(d.id) ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  },

  getAreaSales: async (): Promise<
    {
      areaSupervisorId: string;
      areaSupervisorName: string;
      areas: string[];
      totalRevenue: number;
      storeCount: number;
    }[]
  > => {
    await delay();
    return areaSupervisors.map((am) => {
      const amStores = stores.filter((s) => s.areaSupervisorId === am.id);
      const storeIds = new Set(amStores.map((s) => s.id));
      const revenue = salesMetrics
        .filter((m) => storeIds.has(m.storeId))
        .reduce((s, m) => s + m.srpSales, 0);
      return {
        areaSupervisorId: am.id,
        areaSupervisorName: am.name,
        areas: am.assignedAreas,
        totalRevenue: revenue,
        storeCount: amStores.length,
      };
    });
  },

  getProvinceSales: async (): Promise<
    {
      province: string;
      totalRevenue: number;
      storeCount: number;
      growth: number;
    }[]
  > => {
    await delay();
    const byProvince = new Map<
      string,
      { revenue: number; count: number }
    >();
    for (const m of salesMetrics) {
      const entry = byProvince.get(m.province) ?? { revenue: 0, count: 0 };
      entry.revenue += m.srpSales;
      byProvince.set(m.province, entry);
    }
    for (const s of stores) {
      const entry = byProvince.get(s.province);
      if (entry) entry.count++;
    }

    return Array.from(byProvince.entries()).map(([province, data]) => ({
      province,
      totalRevenue: data.revenue,
      storeCount: data.count,
      growth: Math.round((Math.random() * 30 - 5) * 10) / 10, // -5% to +25%
    }));
  },

  getStoreRankings: async (): Promise<
    {
      storeId: string;
      storeName: string;
      province: string;
      totalRevenue: number;
      rank: number;
      trend: 'up' | 'down' | 'stable';
    }[]
  > => {
    await delay();
    const byStore = new Map<string, number>();
    for (const m of salesMetrics) {
      byStore.set(m.storeId, (byStore.get(m.storeId) ?? 0) + m.srpSales);
    }

    const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable'];
    return stores
      .filter((s) => byStore.has(s.id))
      .map((s) => ({
        storeId: s.id,
        storeName: s.name,
        province: s.province,
        totalRevenue: byStore.get(s.id) ?? 0,
        rank: 0,
        trend: trends[Math.floor(Math.random() * 3)],
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  },
};
