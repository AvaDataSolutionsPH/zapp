// ============================================================
// Pure financial aggregation for the Billing layer.
//
// Source of truth for billings: aggregates approved Ending Inventory
// reconciliations + Special Orders + Packaging Orders into per-store,
// per-cutoff BillingRecord rows. Replaces hard-coded mock billings.
//
// Cutoff periods (per spec): 1-7, 8-14, 15-21, 22-EOM of each month.
// Aggregation key: (storeId, YYYY-MM, cutoffRange) — three EIs in the
// same cutoff for the same store roll into one billing.
//
// Approval gate (per design decision): only EIs with status 'approved'
// or legacy 'confirmed' feed billings. Pending / needs_review /
// correction_required are excluded — they wait for reviewer approval
// before crediting downstream.
//
// Packaging treatment (per design decision): ALL packaging orders flow
// into zappBilling (matches spec "Packaging Allocation is included in
// Zapp Billing"). PA-vs-actual reconciliation lives in the UI as an
// informational overlay, not in the billed total.
// ============================================================

import type {
  BillingRecord,
  BillingStatus,
  Delivery,
  EndingInventory,
  PackagingOrder,
  Payment,
  SpecialOrder,
  Store,
} from '@/types';
import { computeEndingInventory } from './inventoryComputations';

// ── Cutoff math ──────────────────────────────────────────────

export type CutoffRange = '1-7' | '8-14' | '15-21' | '22-EOM';

export const CUTOFF_RANGES: CutoffRange[] = ['1-7', '8-14', '15-21', '22-EOM'];

export function getCutoffRangeForDay(day: number): CutoffRange {
  if (day <= 7) return '1-7';
  if (day <= 14) return '8-14';
  if (day <= 21) return '15-21';
  return '22-EOM';
}

export function getCutoffRangeForDate(isoDate: string): CutoffRange {
  // Accepts 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ssZ'
  const day = parseInt(isoDate.slice(8, 10), 10);
  return getCutoffRangeForDay(day);
}

/** Last day of a cutoff range in the given month (used for issuedAt). */
export function getCutoffEndDate(
  year: number,
  monthZeroBased: number,
  range: CutoffRange,
): string {
  let day: number;
  if (range === '1-7') day = 7;
  else if (range === '8-14') day = 14;
  else if (range === '15-21') day = 21;
  else day = new Date(year, monthZeroBased + 1, 0).getDate();

  const m = (monthZeroBased + 1).toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Aggregation ──────────────────────────────────────────────

export interface BillingAggregationContext {
  endingInventories: EndingInventory[];
  specialOrders: SpecialOrder[];
  packagingOrders: PackagingOrder[];
  deliveries: Delivery[];
  stores: Store[];
  payments: Payment[];
}

interface Bucket {
  storeId: string;
  yearMonth: string;
  cutoffRange: CutoffRange;
  eis: EndingInventory[];
  specialOrders: SpecialOrder[];
  packagingOrders: PackagingOrder[];
}

function bucketKey(storeId: string, yearMonth: string, range: CutoffRange): string {
  return `${storeId}|${yearMonth}|${range}`;
}

function computeBillingId(
  storeId: string,
  yearMonth: string,
  range: CutoffRange,
): string {
  // Deterministic so the same conceptual billing has a stable id across
  // recomputes — lets payments link to it reliably.
  return `bill-${storeId}-${yearMonth}-${range}`;
}

function determineStatus(
  billingId: string,
  issuedIso: string,
  dueIso: string,
  payments: Payment[],
  now: number = Date.now(),
): BillingStatus {
  const verified = payments.find(
    (p) => p.billingId === billingId && p.status === 'verified',
  );
  if (verified) return 'paid';

  const issuedMs = new Date(issuedIso).getTime();
  const dueMs = new Date(dueIso).getTime();
  if (issuedMs > now) return 'pending';
  if (dueMs < now) return 'overdue';
  return 'issued';
}

/**
 * Compute the full billing list from current state. Pure function —
 * given the same inputs returns the same output. Caller invokes this
 * whenever the upstream slices change (approve EI, add SO, add packaging
 * order, verify payment).
 */
export function computeBillingsFromState(
  ctx: BillingAggregationContext,
  now: number = Date.now(),
): BillingRecord[] {
  const {
    endingInventories,
    specialOrders,
    packagingOrders,
    deliveries,
    stores,
    payments,
  } = ctx;

  const approvedEIs = endingInventories.filter(
    (ei) => ei.status === 'approved' || ei.status === 'confirmed',
  );

  const buckets = new Map<string, Bucket>();

  const ensureBucket = (storeId: string, isoDate: string): Bucket => {
    const yearMonth = isoDate.slice(0, 7);
    const range = getCutoffRangeForDate(isoDate);
    const key = bucketKey(storeId, yearMonth, range);
    let b = buckets.get(key);
    if (!b) {
      b = {
        storeId,
        yearMonth,
        cutoffRange: range,
        eis: [],
        specialOrders: [],
        packagingOrders: [],
      };
      buckets.set(key, b);
    }
    return b;
  };

  for (const ei of approvedEIs) {
    ensureBucket(ei.storeId, ei.date).eis.push(ei);
  }
  for (const so of specialOrders) {
    ensureBucket(so.storeId, so.date).specialOrders.push(so);
  }
  for (const po of packagingOrders) {
    const date = po.orderedAt.slice(0, 10);
    ensureBucket(po.storeId, date).packagingOrders.push(po);
  }

  const records: BillingRecord[] = [];

  for (const b of buckets.values()) {
    const store = stores.find((s) => s.id === b.storeId);
    if (!store) continue;

    let plantId = store.plantId;
    let grossSales = 0;
    let drSold = 0;
    let drUnsold = 0;
    let drDelivered = 0;
    let soldQty = 0;

    for (const ei of b.eis) {
      const delivery = deliveries.find((d) => d.id === ei.deliveryId);
      if (!delivery) continue;
      const comp = computeEndingInventory(
        delivery.items,
        ei.unsoldItems,
        store.franchiseType,
      );
      grossSales += comp.totals.grossSales;
      drSold += comp.totals.drSold;
      drUnsold += comp.totals.drUnsold;
      drDelivered += comp.totals.drTotal;
      soldQty += comp.totals.soldQty;
      plantId = delivery.plantId;
    }

    for (const so of b.specialOrders) {
      grossSales += so.totalSRP;
      drSold += so.totalDR;
      drDelivered += so.totalDR; // Special Orders are always sold; no unsold component
      soldQty += so.items.reduce((s, i) => s + i.quantity, 0);
    }

    const packagingTotal = b.packagingOrders.reduce(
      (sum, po) => sum + po.totalAmount,
      0,
    );

    // Skip buckets with zero activity (defensive; shouldn't normally arise).
    if (grossSales === 0 && packagingTotal === 0 && soldQty === 0) continue;

    const isDirect = store.franchiseType === 'direct';
    const franchiseeProfit = isDirect ? grossSales - drSold : grossSales * 0.15;
    const remitToPD = isDirect ? 0 : grossSales * 0.85;
    const zappBilling = drSold + packagingTotal;

    const [yearStr, monthStr] = b.yearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthZeroBased = parseInt(monthStr, 10) - 1;

    const issuedDate = getCutoffEndDate(year, monthZeroBased, b.cutoffRange);
    const dueDate = addDaysIso(issuedDate, 7);
    const issuedAt = `${issuedDate}T00:00:00Z`;
    const dueAt = `${dueDate}T23:59:59Z`;

    const id = computeBillingId(b.storeId, b.yearMonth, b.cutoffRange);
    const status = determineStatus(id, issuedAt, dueAt, payments, now);

    records.push({
      id,
      plantId,
      storeId: b.storeId,
      distributorId: store.distributorId,
      period: `${b.yearMonth} (${b.cutoffRange})`,
      drTotal: drDelivered,
      unsoldDeduction: drUnsold,
      packagingTotal,
      totalPayable: zappBilling,
      status,
      issuedAt,
      dueAt,
      srpTotal: grossSales,
      soldQty,
      franchiseeProfit,
      remitToPD,
      cutoffPeriod: b.cutoffRange,
    });
  }

  // Stable sort: most recent (latest yearMonth + latest cutoff) first
  records.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  return records;
}

// ── Drill-down helper (for the detail drawer) ────────────────

export interface BillingBreakdown {
  billingId: string;
  storeId: string;
  yearMonth: string;
  cutoffRange: CutoffRange;
  contributingEis: EndingInventory[];
  contributingSpecialOrders: SpecialOrder[];
  contributingPackagingOrders: PackagingOrder[];
}

/**
 * For a given billing id, return the underlying records that fed it.
 * Used by the billing detail drawer to show what was aggregated.
 */
export function getBillingBreakdown(
  billingId: string,
  ctx: BillingAggregationContext,
): BillingBreakdown | null {
  // Parse the deterministic id back to its parts
  // Format: bill-{storeId}-{yearMonth}-{cutoffRange}
  // storeId itself may contain '-' (e.g. 'store-01'), so split from the right
  const prefix = 'bill-';
  if (!billingId.startsWith(prefix)) return null;
  const remainder = billingId.slice(prefix.length);
  const lastDash = remainder.lastIndexOf('-');
  if (lastDash < 0) return null;
  // cutoffRange may itself be '1-7' / '8-14' / '15-21' / '22-EOM'
  // The yearMonth is 7 chars 'YYYY-MM', preceded by storeId and followed by '-{range}'
  // We need to locate where yearMonth starts. Easiest: pattern match all valid ranges.
  let matchedRange: CutoffRange | null = null;
  for (const r of CUTOFF_RANGES) {
    if (remainder.endsWith(`-${r}`)) {
      matchedRange = r;
      break;
    }
  }
  if (!matchedRange) return null;
  const withoutRange = remainder.slice(0, remainder.length - matchedRange.length - 1);
  // withoutRange = '{storeId}-{YYYY-MM}'
  // yearMonth is the last 7 chars ('YYYY-MM')
  if (withoutRange.length < 8) return null;
  const yearMonth = withoutRange.slice(withoutRange.length - 7);
  const storeId = withoutRange.slice(0, withoutRange.length - 8); // strip '-YYYY-MM'

  const approvedEIs = ctx.endingInventories.filter(
    (ei) =>
      (ei.status === 'approved' || ei.status === 'confirmed') &&
      ei.storeId === storeId &&
      ei.date.slice(0, 7) === yearMonth &&
      getCutoffRangeForDate(ei.date) === matchedRange,
  );
  const sos = ctx.specialOrders.filter(
    (so) =>
      so.storeId === storeId &&
      so.date.slice(0, 7) === yearMonth &&
      getCutoffRangeForDate(so.date) === matchedRange,
  );
  const pos = ctx.packagingOrders.filter(
    (po) =>
      po.storeId === storeId &&
      po.orderedAt.slice(0, 7) === yearMonth &&
      getCutoffRangeForDate(po.orderedAt.slice(0, 10)) === matchedRange,
  );

  return {
    billingId,
    storeId,
    yearMonth,
    cutoffRange: matchedRange,
    contributingEis: approvedEIs,
    contributingSpecialOrders: sos,
    contributingPackagingOrders: pos,
  };
}
