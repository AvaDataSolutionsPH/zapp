# Feature: Billing & Delivery-Status Recompute Cascade

**Status:** live
**Owner roles:** owner, operations_manager, billing_user, plant_manager, PD/SPD, franchisees (view scoped)

## Entry points
- Billing page: `src/pages/billing/BillingPage.tsx` (+ `BillingDetailDrawer.tsx`)
- Deliveries page enforcement section: `src/pages/deliveries/DeliveriesPage.tsx`
- No user "create billing" action — **billings are computed, never stored.**

## The core idea
There is **no `billing_records` DB table.** Billings are derived at runtime from
upstream entities. `mockData.billingRecords` is an empty placeholder.

## Files
| File | Role |
|---|---|
| `src/lib/billingComputations.ts` → `computeBillingsFromState`, `getBillingBreakdown` | pure: per-store-per-cutoff aggregation |
| `src/lib/deliveryEnforcement.ts` → `computeStoreDeliveryStatus` | pure: overdue count → active/warning/hold |
| `src/lib/inventoryComputations.ts` | pure: per-EI financial formulas (Gross/15%/85%/10% PD/packaging) |
| `src/store/useStore.ts` → `recomputeBillings` (internal helper) | the cascade orchestrator |
| `src/store/useStore.ts` → `updateBillingRecord` | in-memory only (no DB write) |

## Data flow (the cascade)
A mutation touches a billing **input** → `recomputeBillings()` runs:

```
approve EI  ┐
add Special Order ┤→ recomputeBillings() → computeBillingsFromState({EIs, specialOrders,
add Packaging Order ┤        packagingOrders, payments}) → new billings slice
verify Payment ┘                 └→ recomputeDeliveryStatuses() → computeStoreDeliveryStatus
                                       (overdue billing count per store → delivery_status)
```

`recomputeBillings` runs:
1. once at store init (from mock data),
2. after `hydrateFromDB` (against fresh DB rows),
3. after every relevant mutation,
4. **again on rollback** — so billings + delivery status revert in lockstep
   with the source entity if a DB write fails.

## Billing inputs (what feeds a billing)
- **Ending Inventories** in status `approved` (or legacy `confirmed`) — ONLY these.
- **Special Orders** (always "sold").
- **Packaging Orders**.
- **Payments** decide paid/issued/overdue status per billing.

Deterministic billing id: `bill-{storeId}-{yearMonth}-{cutoffRange}`.

## Delivery-status auto-rule
`Store.deliveryStatus` is auto-derived: 0 overdue billings = `active`,
1 = `warning`, 2+ = `hold`. Manual `requestStopDelivery` / `resumeDelivery`
persist to `stores.delivery_status` but the next recompute may override.

## Gotchas
- **`updateBillingRecord` is in-memory only** — no DB table, so it's recomputed
  away on the next cascade. (This is why the "Upload Billing File" button is a
  dead stub — see CLAUDE.md backlog.)
- **Today's demo date is past the March 2026 mock cutoffs**, so most stores boot
  into WARNING/HOLD — that's the auto-rule on stale data, not a bug.
- `payments.billing_id` is plain TEXT (no FK) — computed billing ids won't match
  the old seeded `bill-XX` payment refs; UI handles missing refs gracefully.
- Only `approved` EIs feed billings — a `pending_review` EI shows nothing yet.

## Related
[[ending-inventory-review]] · CLAUDE.md "Architecture" + "Gotchas" ·
memory `phase3-rls`
