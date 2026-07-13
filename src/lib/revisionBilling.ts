// ============================================================
// Phase C — "Additional Amount Due after Revision"
// ============================================================
// When a Partner Distributor files a BillingRevision (corrected beginning /
// ending donut counts for a DR), the store's SOLD quantity changes. The store
// is billed on a DR / consignment basis (Zapp Billing = DR Sold Value = Σ sold×
// drPrice — only sold goods bill the store; unsold is returned). So a revision
// that raises sold raises what the store owes.
//
// The POSITIVE delta becomes a SEPARATE "additional" billing; the original
// billing row is never mutated (audit trail — boss-confirmed). This module is
// the pure derivation, React/store-free so it's node-testable and reusable by
// both the PD drawer and the franchisee billing view.
//
// sold is derived the SAME way the PD reviews it (begin − end, matching
// drReviewComputations and the revision form), NOT delivered − unsold, so the
// delta is apples-to-apples with the numbers the PD actually edited.

import type { Delivery, BeginningInventory, EndingInventory, BillingRevision } from '@/types';

export interface RevisionBilling {
  originalSold: number;
  revisedSold: number;
  originalDrSold: number;   // Σ originalSold × drPrice — original DR-based billing
  revisedDrSold: number;    // Σ revisedSold  × drPrice — revised DR-based billing
  additionalAmount: number; // max(0, revisedDrSold − originalDrSold) — the extra due
  originalGross: number;    // Σ originalSold × srpPrice (context / SRP flow)
  revisedGross: number;
}

// Accepts anything carrying the corrected arrays so it can run at file time
// (before an id exists) and on a persisted BillingRevision alike.
type CorrectedCounts = Pick<BillingRevision, 'correctedBeginning' | 'correctedEnding'>;

export function computeRevisionBilling(
  delivery: Delivery,
  beginningInv: BeginningInventory | undefined,
  endingInv: EndingInventory | undefined,
  revision: CorrectedCounts,
): RevisionBilling {
  const price = new Map<string, { dr: number; srp: number }>();
  for (const it of delivery.items) price.set(it.skuId, { dr: it.drPrice, srp: it.srpPrice });

  // Original beginning: confirmed beginning count, else the delivered DR qty.
  const origBegin = new Map<string, number>();
  if (beginningInv) {
    for (const it of beginningInv.confirmedItems) {
      origBegin.set(it.skuId, (origBegin.get(it.skuId) ?? 0) + it.quantity);
    }
  } else {
    for (const it of delivery.items) {
      origBegin.set(it.skuId, (origBegin.get(it.skuId) ?? 0) + it.quantity);
    }
  }
  const origEnd = new Map<string, number>();
  for (const it of endingInv?.unsoldItems ?? []) {
    origEnd.set(it.skuId, (origEnd.get(it.skuId) ?? 0) + it.quantity);
  }

  const revBegin = new Map(revision.correctedBeginning.map((i) => [i.skuId, i.quantity]));
  const revEnd = new Map(revision.correctedEnding.map((i) => [i.skuId, i.quantity]));

  const skuIds = new Set<string>([
    ...price.keys(),
    ...origBegin.keys(),
    ...origEnd.keys(),
    ...revBegin.keys(),
    ...revEnd.keys(),
  ]);

  let originalSold = 0;
  let revisedSold = 0;
  let originalDrSold = 0;
  let revisedDrSold = 0;
  let originalGross = 0;
  let revisedGross = 0;

  for (const sku of skuIds) {
    const p = price.get(sku) ?? { dr: 0, srp: 0 };
    const oSold = Math.max(0, (origBegin.get(sku) ?? 0) - (origEnd.get(sku) ?? 0));
    const rSold = Math.max(0, (revBegin.get(sku) ?? 0) - (revEnd.get(sku) ?? 0));
    originalSold += oSold;
    revisedSold += rSold;
    originalDrSold += oSold * p.dr;
    revisedDrSold += rSold * p.dr;
    originalGross += oSold * p.srp;
    revisedGross += rSold * p.srp;
  }

  return {
    originalSold,
    revisedSold,
    originalDrSold,
    revisedDrSold,
    additionalAmount: Math.max(0, revisedDrSold - originalDrSold),
    originalGross,
    revisedGross,
  };
}
