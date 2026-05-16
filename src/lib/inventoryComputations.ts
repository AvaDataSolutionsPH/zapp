// ============================================================
// Pure financial computations for Ending Inventory reconciliation.
//
// Spec formulas (per franchise type):
//   Gross Sales       = Σ (soldQty × srpPrice)  per SKU
//   Distributor flow:
//     Store Profit          = 15% × Gross
//     Remit to PD           = 85% × Gross
//     PD Profit             = 10% × Gross
//     Packaging Allocation  = 75% × Gross − DR Sold Value
//   Direct franchise flow:
//     Store Profit          = Gross − DR Sold Value
//   Common:
//     Zapp Billing          = DR Sold Value + Packaging
//
// "DR Sold Value" = Σ (soldQty × drPrice). Consignment convention:
// only sold goods bill the store; unsold goods are returned (no charge).
// ============================================================

import type { DeliveryItem, FranchiseType, InventoryItem } from '@/types';

// ── Constants ────────────────────────────────────────────────

export const STORE_PROFIT_RATE = 0.15;
export const REMIT_TO_PD_RATE = 0.85;
export const PD_PROFIT_RATE = 0.10;

// ── Types ────────────────────────────────────────────────────

export interface PerSkuRow {
  skuId: string;
  skuName: string;
  deliveredQty: number;
  unsoldQty: number;
  soldQty: number;
  drPrice: number;
  srpPrice: number;
  grossSales: number;
  drValueDelivered: number;
  drValueSold: number;
  drValueUnsold: number;
}

export interface DistributorSplit {
  storeProfit: number;
  remitToPD: number;
  pdProfit: number;
}

export interface EndingInventoryTotals {
  deliveredQty: number;
  unsoldQty: number;
  soldQty: number;
  grossSales: number;
  drTotal: number;
  drSold: number;
  drUnsold: number;
}

export interface EndingInventoryComputation {
  perSku: PerSkuRow[];
  totals: EndingInventoryTotals;
  franchiseType: FranchiseType;
  storeProfit: number;
  remitToPD: number;
  pdProfit: number;
  packagingAllocation: number;
  zappBilling: number;
}

// ── Lower-level pure functions ───────────────────────────────

export function computeGrossSales(
  rows: Pick<PerSkuRow, 'soldQty' | 'srpPrice'>[],
): number {
  return rows.reduce((sum, r) => sum + r.soldQty * r.srpPrice, 0);
}

export function computeDrValue(
  rows: Array<{ quantity: number; drPrice: number }>,
): number {
  return rows.reduce((sum, r) => sum + r.quantity * r.drPrice, 0);
}

export function computeDistributorSplit(grossSales: number): DistributorSplit {
  return {
    storeProfit: grossSales * STORE_PROFIT_RATE,
    remitToPD: grossSales * REMIT_TO_PD_RATE,
    pdProfit: grossSales * PD_PROFIT_RATE,
  };
}

export function computePackagingAllocation(
  grossSales: number,
  drSold: number,
): number {
  return (REMIT_TO_PD_RATE - PD_PROFIT_RATE) * grossSales - drSold;
}

export function computeZappBilling(
  drSold: number,
  packagingTotal: number,
): number {
  return drSold + packagingTotal;
}

export function computeDirectProfit(
  grossSales: number,
  drSold: number,
): number {
  return grossSales - drSold;
}

// ── Top-level: full per-EI computation ───────────────────────

export function computeEndingInventory(
  deliveryItems: DeliveryItem[],
  unsoldItems: InventoryItem[],
  franchiseType: FranchiseType,
  packagingTotal: number = 0,
): EndingInventoryComputation {
  const unsoldBySku = new Map<string, number>(
    unsoldItems.map((u) => [u.skuId, u.quantity]),
  );

  const perSku: PerSkuRow[] = deliveryItems.map((d) => {
    // Clamp defensively: a corrupt unsoldItems record cannot exceed delivered.
    const unsoldQty = Math.max(
      0,
      Math.min(unsoldBySku.get(d.skuId) ?? 0, d.quantity),
    );
    const soldQty = d.quantity - unsoldQty;
    return {
      skuId: d.skuId,
      skuName: d.skuName,
      deliveredQty: d.quantity,
      unsoldQty,
      soldQty,
      drPrice: d.drPrice,
      srpPrice: d.srpPrice,
      grossSales: soldQty * d.srpPrice,
      drValueDelivered: d.quantity * d.drPrice,
      drValueSold: soldQty * d.drPrice,
      drValueUnsold: unsoldQty * d.drPrice,
    };
  });

  const totals: EndingInventoryTotals = perSku.reduce(
    (acc, r) => ({
      deliveredQty: acc.deliveredQty + r.deliveredQty,
      unsoldQty: acc.unsoldQty + r.unsoldQty,
      soldQty: acc.soldQty + r.soldQty,
      grossSales: acc.grossSales + r.grossSales,
      drTotal: acc.drTotal + r.drValueDelivered,
      drSold: acc.drSold + r.drValueSold,
      drUnsold: acc.drUnsold + r.drValueUnsold,
    }),
    {
      deliveredQty: 0,
      unsoldQty: 0,
      soldQty: 0,
      grossSales: 0,
      drTotal: 0,
      drSold: 0,
      drUnsold: 0,
    },
  );

  const zappBilling = computeZappBilling(totals.drSold, packagingTotal);

  if (franchiseType === 'direct') {
    return {
      perSku,
      totals,
      franchiseType,
      storeProfit: computeDirectProfit(totals.grossSales, totals.drSold),
      remitToPD: 0,
      pdProfit: 0,
      packagingAllocation: 0,
      zappBilling,
    };
  }

  const split = computeDistributorSplit(totals.grossSales);
  return {
    perSku,
    totals,
    franchiseType,
    storeProfit: split.storeProfit,
    remitToPD: split.remitToPD,
    pdProfit: split.pdProfit,
    packagingAllocation: computePackagingAllocation(
      totals.grossSales,
      totals.drSold,
    ),
    zappBilling,
  };
}
