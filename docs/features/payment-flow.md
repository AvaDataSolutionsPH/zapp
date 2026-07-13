# Feature: Payment Flow (franchisee → PD/SPD → billing)

**Status:** live
**Roles:** franchisee submits · partner_distributor / sub_partner_distributor
collect · billing_user / owner / operations_manager verify.

## What changed
Payments used to go **store → billing directly** (franchisee submits, billing
verifies). Boss's model: *"Payment flow dapat franchisee to PD/SPD lang. Ang
bayad kay billing ay si PD/SPD lang din to billing."* — a PD/SPD **collection**
step now sits between submission and verification.

## State machine
`submitted` → `collected` → `verified` (with `rejected` reachable from either
the collection or the verification stage).

- **submitted** — franchisee remitted; awaiting the store's PD/SPD.
- **collected** *(new)* — the PD/SPD collected the remittance and forwarded it to
  billing. Set by `collectPayment(id, 'collected', collectedBy)`. Records
  `collectedBy` + `collectedAt`. **Does NOT mark the billing paid.**
- **verified** — billing confirmed the forwarded collection. This is the ONLY
  status `billingComputations` keys on to flip a billing record to *paid*, so
  collection alone never marks a bill paid.
- **rejected** — bounced back with a reason, at collection (PD/SPD) or
  verification (billing).

## Direct franchisees have no PD
`franchisee_direct` stores carry no `distributorId`/`subPartnerDistributorId`
(e.g. store-03, store-05), so nobody can collect for them. Their `submitted`
payments therefore skip collection and are treated as **awaiting verification**
directly — otherwise they'd get stuck. This is computed, not stored: see
`storeHasPd` / `paymentStage` in `PaymentsPage`.

## Derived stage vs raw status
The UI groups by a derived **stage** (`paymentStage` in `PaymentsPage`), not the
raw enum, so the "no-PD direct store" case routes correctly:
- `awaiting_collection` = `submitted` AND the store has a PD/SPD
- `awaiting_verification` = `collected` OR (`submitted` AND no PD)
- `verified` / `rejected` = raw status

Tabs: All · **Pending Collection** · **Pending Verification** · Verified ·
Rejected. Stats mirror the two pending stages.

## Entry points / files
- `src/pages/payments/PaymentsPage.tsx` — role gates (`canSubmitPayment`,
  `canCollectPayment` *(new)*, `canVerifyPayment`), PD/SPD scoping of
  `userPayments` (via `getStoresForCurrentUser`), stage tabs, action routing
  (`openDetail`), Collect/Verify action buttons.
- `src/pages/payments/PaymentSubmitModal.tsx` — franchisee submit (unchanged
  except copy).
- `src/pages/payments/PaymentCollectModal.tsx` *(new)* — PD/SPD "Mark Collected"
  / "Reject". Mirrors the verify modal (proof viewer, amount-match check).
- `src/pages/payments/PaymentVerifyModal.tsx` — billing verify/reject (unchanged).
- `src/store/useStore.ts` — `collectPayment` action (optimistic + background DB
  write + rollback; no billing recompute since collection doesn't touch the
  verified count). `verifyPayment` unchanged.
- `src/types/index.ts` — `PaymentStatus += 'collected'`; `Payment` +
  `collectedBy?`, `collectedAt?`.
- `src/services/dbWrite.ts` / `scripts/seed-from-mock.ts` — map the two new
  columns.
- `src/components/ui/StatusBadge.tsx` — `collected` badge (info).
- `src/components/layout/Sidebar.tsx` — Payments now visible to
  `sub_partner_distributor` + `operations_manager`.

## Billing-user payer filters (PaymentsPage.tsx)
The billing user gets a **payer-oriented filter set** instead of the generic
search / status / date-range (a distributor's remittance is one payment per
cutoff per plant covering all its stores — boss). Gated on `isBillingUser`, the
filter card shows four cascading `Select`s:
1. **Plant** — `store.plantId`.
2. **Payer type** — Distributor (PD) / Sub-Partner (SPD) / Franchisee (Direct),
   derived from the store's links: `distributorId && !subPartnerDistributorId`
   → PD; `subPartnerDistributorId` → SPD; neither → direct franchisee.
3. **Entity** (dependent on #2) — only the payers of that type that actually have
   payments, optionally within the chosen plant (`payerEntityOptions` memo).
   Distributor → `distributorId`; SPD → `subPartnerDistributorId`; Franchisee →
   the store id.
4. **Cutoff** — `getCutoffRangeForDate(payment.datePaid)` (1-7 / 8-14 / 15-21 /
   22-EOM); a single selector replaces the From/To date range.
All other roles keep the original search + status + date filters. Proof of
payment is viewed via the existing "View Details" → verify modal (unchanged).

## RLS / scope (migration 012)
- Widens `payments.status` CHECK to allow `'collected'` (drop + re-add).
- Adds `payments.collected_by` / `collected_at`.
- `payments_spd_update` — a **scoped exception** letting
  `sub_partner_distributor` UPDATE payments for stores in its scope
  (`app_store_scope()`). SPD is `app_is_viewonly()` everywhere else, so the base
  `payments_update` policy blocks it; Postgres ORs policies, so PD / billing /
  admin are unchanged.
- PD already had scoped UPDATE (not view-only) — no new policy needed for PD.
- **Run 012 BEFORE deploying the client** so `'collected'` writes don't violate
  the old CHECK.

## Gotchas
- Collection is intentionally NOT a billing-paid trigger. If a bill looks unpaid
  after a PD collects, that's correct — it flips to paid only on billing verify.
- The verify modal is reused as the read-only detail view for non-actors; it
  still renders action buttons, so keep row-click routing (`openDetail`) role-
  aware (pre-existing pattern; not tightened here).
- Direct-store payments show under **Pending Verification** even at `submitted`
  status — by design (no collector exists).

## Related
[[billing-and-delivery-recompute]] (only `verified` payments mark a bill paid) ·
[[account-creation]] (PD/SPD logins that do the collecting) ·
CLAUDE.md "NEXT TASK (boss) — Payment flow".
