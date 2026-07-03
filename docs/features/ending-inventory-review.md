# Feature: Ending Inventory Review (Reviewer State Machine)

**Status:** live
**Owner roles:** reviewers = owner, operations_manager, area_manager, partner_distributor;
franchisees submit/resubmit.

## Entry points
- Reviewer queue: `src/pages/inventory/InventoryReviewsPage.tsx` (4 status tabs)
- Detail drawer + actions: `src/pages/inventory/InventoryReviewDetailDrawer.tsx`
- Per-SKU correction modal: `src/pages/inventory/CorrectionRequestForm.tsx`
- Franchisee submit/resubmit: `src/pages/inventory/EndingInventoryPage.tsx`

## State machine
```
pending_review ──approve──────────────→ approved  (TERMINAL — feeds billing, cannot revert)
      │
      ├──mark needs review──→ needs_review ──(store resubmits)──→ pending_review
      │
      └──request correction─→ correction_required ──(store resubmits)──→ pending_review
```
Legacy `pending` / `confirmed` values remain in the union for back-compat.

## Files / store actions
| File / symbol | Role |
|---|---|
| `src/store/useStore.ts` → `approveEndingInventory` | → `approved`; recomputes billings |
| `src/store/useStore.ts` → `markEndingInventoryNeedsReview` | → `needs_review` + notify store |
| `src/store/useStore.ts` → `requestEndingInventoryCorrection` | → `correction_required` + per-SKU corrections + notify |
| `src/store/useStore.ts` → `resubmitEndingInventory` | store resubmits → back to `pending_review` |
| `src/services/dbWrite.ts` → `updateEndingInventory` | persists status + revisions JSONB |
| `src/types/index.ts` → `EndingInventory`, `EndingInventoryReview`, `EndingInventoryStatus` | shapes |

## Data flow
reviewer action → store action (optimistic status change + push a review entry
into `revisions[]`) → **if approve: `recomputeBillings()` synchronously** (approved
EIs feed billing) → DB write (`updateEndingInventory`) → on failure: rollback
state + recompute again.

Each action appends an `EndingInventoryReview` to `ei.revisions[]` (audit trail)
and fires a `notification` (persisted since Chunk 5).

## RLS / scope
`ei_select` / `ei_write` in `003_role_scoped_rls.sql`: `store_id = ANY(app_store_scope())`.
Reviewers see EIs for stores in their scope (PD = distributor stores, area_manager
= assigned areas, owner/ops = all). SPD is view-only (blocked from writes).

## Gotchas
- **`approved` is terminal** — cannot be reverted; it's what feeds the billing
  layer. Only `approved` (or legacy `confirmed`) EIs produce billings.
- Approve triggers a **synchronous** `recomputeBillings` before the DB write so
  the billing slice stays consistent during the optimistic window; rollback
  recomputes again.
- Corrections are per-SKU (`EndingInventoryCorrectionItem`), stored in the
  notification + on resubmit merged back into `unsoldItems`.
- `originalUnsoldItems` preserves the store's first submission across corrections.

## Related
[[billing-and-delivery-recompute]] · CLAUDE.md "Gotchas" (EI state machine) ·
memory `phase3-rls`
