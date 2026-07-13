// ============================================================
// Per-DR review metrics for the Partner Distributor billing view
// ============================================================
// A PD reviews each delivery (DR) against the store's reported Beginning /
// Ending donut counts. This derives the per-DR numbers boss's PD billing table
// needs, purely from the delivery + the store's Beginning (`confirmedItems`) and
// Ending (`unsoldItems`) inventories. No React / store deps → node-testable.
//
// Definitions (confirmed with boss):
//   delivered[sku] = delivery line qty
//   begin[sku]     = Beginning Inventory confirmed count (defaults to delivered
//                    when the store hasn't submitted a separate beginning count)
//   end[sku]       = Ending Inventory unsold count
//   sold[sku]      = max(0, begin − end)
//
//   DR Total       = Σ delivered            (donut COUNT, not peso)
//   Total Sold     = Σ sold
//   Total Unsold   = Σ end
//   Lacking Total  = Σ max(0, delivered − begin)   (short at beginning count)
//   Overage Total  = Σ max(0, begin − delivered)   (counted more than delivered)
//   Gross Sales    = Σ sold × srpPrice      (₱)
//   Franchisee Profit = 15% × Gross
//   Remit to PD       = 85% × Gross
//   DR Sold value  = Σ sold × drPrice
//   PD Profit      = DR Sold value − Remit to PD   (boss's literal formula; can
//                    be negative — flagged, kept as specified)

import type { Delivery, BeginningInventory, EndingInventory } from '@/types';

const STORE_PROFIT_RATE = 0.15;
const REMIT_TO_PD_RATE = 0.85;

export interface DrReview {
  drTotalQty: number;
  totalSold: number;
  totalUnsold: number;
  lackingTotal: number;
  overageTotal: number;
  grossSales: number;
  franchiseeProfit: number;
  remitToPD: number;
  drSoldValue: number;
  pdProfit: number;
  hasBeginning: boolean;
  hasEnding: boolean;
}

export function computeDrReview(
  delivery: Delivery,
  beginningInv?: BeginningInventory,
  endingInv?: EndingInventory,
): DrReview {
  const price = new Map<string, { dr: number; srp: number }>();
  const delivered = new Map<string, number>();
  for (const it of delivery.items) {
    delivered.set(it.skuId, (delivered.get(it.skuId) ?? 0) + it.quantity);
    price.set(it.skuId, { dr: it.drPrice, srp: it.srpPrice });
  }

  // Beginning count defaults to the delivered qty (scanned DR) until the store
  // submits its own beginning count.
  const begin = new Map<string, number>(delivered);
  if (beginningInv) {
    begin.clear();
    for (const it of beginningInv.confirmedItems) {
      begin.set(it.skuId, (begin.get(it.skuId) ?? 0) + it.quantity);
    }
  }

  const end = new Map<string, number>();
  if (endingInv) {
    for (const it of endingInv.unsoldItems) {
      end.set(it.skuId, (end.get(it.skuId) ?? 0) + it.quantity);
    }
  }

  const hasBeginning = !!beginningInv;
  const hasEnding = !!endingInv;

  const skuIds = new Set<string>([...delivered.keys(), ...begin.keys(), ...end.keys()]);
  let drTotalQty = 0;
  let totalSold = 0;
  let totalUnsold = 0;
  let lackingTotal = 0;
  let overageTotal = 0;
  let grossSales = 0;
  let drSoldValue = 0;

  for (const sku of skuIds) {
    const d = delivered.get(sku) ?? 0;
    const b = begin.get(sku) ?? 0;
    const e = end.get(sku) ?? 0;
    const p = price.get(sku) ?? { dr: 0, srp: 0 };

    drTotalQty += d;
    lackingTotal += Math.max(0, d - b);
    overageTotal += Math.max(0, b - d);

    // Sold is only known once the store submits its Ending count. Until then
    // the sold-derived numbers stay 0 (row shows as "awaiting report").
    if (hasEnding) {
      const sold = Math.max(0, b - e);
      totalSold += sold;
      totalUnsold += e;
      grossSales += sold * p.srp;
      drSoldValue += sold * p.dr;
    }
  }

  const franchiseeProfit = grossSales * STORE_PROFIT_RATE;
  const remitToPD = grossSales * REMIT_TO_PD_RATE;
  const pdProfit = drSoldValue - remitToPD;

  return {
    drTotalQty,
    totalSold,
    totalUnsold,
    lackingTotal,
    overageTotal,
    grossSales,
    franchiseeProfit,
    remitToPD,
    drSoldValue,
    pdProfit,
    hasBeginning,
    hasEnding,
  };
}
