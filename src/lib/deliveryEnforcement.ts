// ============================================================
// Pure delivery-status enforcement logic.
//
// Spec rule: "If store misses payment for 2 delivery cycles → HOLD"
// Interpretation: count billings past their due date that haven't been
// paid. The thresholds:
//   0 overdue  → ACTIVE
//   1 overdue  → WARNING
//  2+ overdue  → HOLD
//
// A billing is considered "paid" when there is a verified Payment
// linked to it via billingId. An "overdue billing" is one whose dueAt
// is before `now` AND has no verified payment.
//
// Manual Area-Supervisor Stop/Resume actions still mutate Store.deliveryStatus
// directly; this module only computes the auto-derived status. Callers that
// integrate the two (e.g. recomputeDeliveryStatuses) decide precedence.
// ============================================================

import type { BillingRecord, Payment, StoreDeliveryStatus } from '@/types';

export const HOLD_THRESHOLD = 2;
export const WARNING_THRESHOLD = 1;

/**
 * Return the billings (filtered to one store) that are past due and not paid.
 */
export function getOverdueBillingsForStore(
  storeId: string,
  billings: BillingRecord[],
  payments: Payment[],
  now: number = Date.now(),
): BillingRecord[] {
  const paidBillingIds = new Set(
    payments.filter((p) => p.status === 'verified').map((p) => p.billingId),
  );

  return billings.filter((b) => {
    if (b.storeId !== storeId) return false;
    if (paidBillingIds.has(b.id)) return false;
    const dueMs = new Date(b.dueAt).getTime();
    return dueMs < now;
  });
}

/**
 * Compute the auto-derived delivery status for a single store. Pure.
 */
export function computeStoreDeliveryStatus(
  storeId: string,
  billings: BillingRecord[],
  payments: Payment[],
  now: number = Date.now(),
): StoreDeliveryStatus {
  const overdue = getOverdueBillingsForStore(storeId, billings, payments, now);
  if (overdue.length >= HOLD_THRESHOLD) return 'hold';
  if (overdue.length >= WARNING_THRESHOLD) return 'warning';
  return 'active';
}

/**
 * Human-readable explanation for why a store is in a particular state.
 * Used by Stores list / store detail UI to surface "why".
 */
export function getOverdueReasonForStore(
  storeId: string,
  billings: BillingRecord[],
  payments: Payment[],
  now: number = Date.now(),
): { status: StoreDeliveryStatus; count: number; label: string } {
  const overdue = getOverdueBillingsForStore(storeId, billings, payments, now);
  const status = computeStoreDeliveryStatus(storeId, billings, payments, now);
  let label: string;
  if (status === 'hold') {
    label = `${overdue.length} overdue billings — HOLD enforced`;
  } else if (status === 'warning') {
    label = '1 overdue billing — warning';
  } else {
    label = 'No overdue billings';
  }
  return { status, count: overdue.length, label };
}
