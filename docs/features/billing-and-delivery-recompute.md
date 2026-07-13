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

### Special Orders are priced at DISCOUNTED (SRP − 15%), not DR
Per boss, a special order is billed at the **discounted price** (SRP − 15% =
`srp * 0.85`), because that's what the customer buys from us; the regular DR price
only applies to normal deliveries (what the distributor pays billing).
`SpecialOrdersPage.tsx` stores `item.drPrice` **and** `totalDR` as the discounted
amount (`discPrice()` helper, `DISC_RATE = 0.85`), and the UI shows "Disc." not
"DR". `computeBillingsFromState` uses `so.totalDR` for `drSold`/`drTotal`/
`totalPayable`, so those now carry the discounted special-order amount. `totalSRP`
(→ `grossSales` → franchisee profit / remit) is unchanged.

## Franchisee billing view (BillingPage.tsx)
When `currentUser.role` is `franchisee_*`, `BillingPage` renders a simplified,
sales-focused table (`franchiseeColumns`) instead of the full distributor columns:
**DR Number · Date · Total Sales · Profit (15%) · Remit to Distributor (85%) ·
Status · Issued · Due · Pay Now**. The DR-based formula banner + DR/packaging KPI
stats are hidden. DR number + date are resolved per billing via `getBillingBreakdown`
→ contributing deliveries (`billingMeta` map; a billing aggregates a store's cutoff
deliveries so DR numbers are joined, date = earliest delivery). **Pay Now** is a
stub toast — NextPay integration is not wired yet ("coconnect natin kay NextPay").

## Billing-user statement view (BillingPage.tsx)
When `currentUser.role` is `billing_user`, `BillingPage` renders the **per-DR
UBERDELI billing-summary** columns (`billingUserColumns`) instead of the
aggregated per-billing-record table — matching the printable
`BillingStatementPage` line-item format one-to-one:
**Delivery Date · PO Number · DR Number · Shop Code · Shop Name · DR Amount (Vat
Inc.) · Returns (Credit) · Delivery Adjustment (Credit) · Merch. Allowance · Net
Amount (Vat Inc.)**. Rows come from `billingUserRows`, built **straight from the
`deliveries` slice** (billing_user reads all, migration 008) — one row per
delivery/DR, NOT per billing record. PO Number is the literal `ZAPP`; Shop Code =
`store.shopCode` (`—` when unassigned); DR Amount / Net = `delivery.totalDRCost`
(3-decimal, no peso sign — matches the reference); Returns / Delivery Adjustment /
Merch. Allowance are `0.000` (not tracked yet, same placeholders as the printable
statement). The list filters that map to a DR line (distributor, store search,
cutoff via `getCutoffRangeForDate`, date range) apply to these rows too; Status
filter and the row-click detail drawer are omitted (no billing-record behind a DR
row). **The billing user is DR-only:** the formula banner is hidden and the KPI
row shows just **DR Total Payable · Total Paid · Overdue · Total Records** (the
SRP Remittance / Total SRP Sales cards are dropped — per boss, "price ng DR lang
ang kailangan nila makita"). Other roles are untouched — the DR + SRP banners and
the full 6-card stat set still render for owner/ops, and the aggregated
`columns` / `franchiseeColumns` tables still render for them.

**Per-DR photo verification:** each billing-user DR row has an explicit **View**
button (trailing "Photos" column; the whole row is also clickable) → opens
`src/pages/billing/DrPhotosDrawer.tsx`, a view-only drawer that shows the store's
captured evidence for that delivery — **Beginning DR slip** (`beginningInventory.
drImageUrl`), **Beginning crate photos** + **Ending crate photos** (`crateImageUrls`,
matched by `deliveryId`) — so billing can double-check the store's reported
inventory per DR. Same signed-URL rendering as DeliveryDetailDrawer's "Delivery
Photos" section (`useStorageUrl`); empty state when the store hasn't uploaded yet.

## Billing list filters by PD / SPD (BillingPage.tsx)
Two role-scoped filters let a PD chain be read top-down:
- **Distributor (PD) filter** — shown to `owner` / `operations_manager` /
  `billing_user` (the roles that see every distributor). Narrows the list to one
  PD's store billings. The **Billing Statement** button then carries the choice
  through as `/billing/statement?dist=<id>` so the consolidated **one-statement-
  per-PD** export opens with that PD preselected (see below).
- **PD payer filter (cascade)** — shown to `partner_distributor` only. Replaces
  the plain SPD dropdown with the same payer cascade as Payments: **Plant →
  Sub-Partner (SPD) / Franchisee (Direct) → dependent entity → Cutoff**, and the
  From/To date range is **kept** (boss: needed to review past transactions).
  `payerType` derives from the billing's store links (`subPartnerDistributorId`
  → SPD; none → direct franchisee under the PD); the entity list
  (`payerEntityOptions`) shows only the SPDs / direct stores that actually have
  billings, optionally within the chosen plant. Status + store-search are dropped
  for the PD. Selecting an SPD/franchisee scopes the list to that payer's full
  store billings — i.e. "how much to bill each SPD / franchisee".

The KPI stat cards are computed from the **filtered** set (not just the plant
filter as before), so the totals double as a running "total under this PD / SPD".

> **Seed-data note:** billings are computed only from **approved EIs** (+ special /
> packaging orders). In the current seed only `store-01` has an approved EI, and it
> is *not* an SPD store, so the PD's SPD filter renders **0 rows** until an SPD store
> (e.g. `store-02` Daraga, `store-04` Tabaco under `spd-01`) gets a billing input.
> The DR-based **statement** (built from *deliveries*, not billings) already shows
> those SPD shops. Real production data fills the list view naturally.

## Toolbar "Export Excel" (WYSIWYG table export)
The Billing page toolbar **Export Excel** button exports the table the current
user is actually looking at, honoring the active filters, as a real `.xlsx` via
`src/lib/tableExcel.ts` (`exportTableXlsx` / pure `buildTableWorkbook`; exceljs,
dynamically imported → shares the lazy chunk with the statement export). Two
shapes: **billing user** → the per-DR statement rows (`billingUserRows`, the same
10 columns shown on screen, amounts as real numbers with `#,##0.000`); **everyone
else** → the aggregated billing records (`filtered`, invoice/store/distributor/
period/DR totals/…, `#,##0.00`). This **replaced the old `billingService.exportToExcel`
CSV stub**, which pulled from the now-empty mock `billingRecords` and produced a
near-blank file that never matched the printable statement (boss: "ibang excel
pala nalabas dito"). Distinct from the **printable Billing Statement** export
below (that one is the grouped per-PD-per-cutoff carbon copy with letterhead).

## Delivery-status auto-rule
`Store.deliveryStatus` is auto-derived: 0 overdue billings = `active`,
1 = `warning`, 2+ = `hold`. Manual `requestStopDelivery` / `resumeDelivery`
persist to `stores.delivery_status` but the next recompute may override.

## Printable Billing Statement (carbon copy)
`src/pages/billing/BillingStatementPage.tsx` (route `/billing/statement`, standalone
— outside the dashboard Layout — for a clean Print → PDF; gated to `billing_user` /
`owner` / `operations_manager`; entry button on `BillingPage`). Replicates the
UBERDELI CORP. "BILLING SUMMARY" (see `docs/references/billing-statement-format/`):
**one statement per DISTRIBUTOR (payer) per cutoff period**, rows = that
distributor's shops' deliveries in the period, grouped by shop with subtotals +
GRAND TOTAL. Uses `getCutoffEndDate` / `getCutoffRangeForDate` for the period math.
Placeholders where data is missing: Shop Code (MD codes not captured yet),
Payer Code = distributor id, Tin/Address = "—", Returns / Delivery Adjustment /
Merch. Allowance = 0.000 (Net = DR Amount).

**Export to Excel (.xlsx):** the statement toolbar has an "Export to Excel" button →
`src/lib/billingStatementExcel.ts` (`exportBillingStatementXlsx`) builds a formatted
**exceljs** workbook that mirrors the on-screen layout — merged letterhead + embedded
ZAPP logo, customer block, bordered account-summary box, the per-shop line-item table
with subtotals, GRAND TOTAL, END OF STATEMENT; amounts are real numbers with a
`#,##0.000` format. `buildStatementWorkbook` is pure (node-testable); exceljs is
**dynamically imported** so it code-splits out of the main bundle.

## billing_user reads ALL (company-wide billing)
The billing user invoices every distributor/store, so it must **read all**
billing-relevant tables — it is NOT plant-scoped. 003 had scoped it to its plant
via `app_store_scope()`, but the seeded billing user has no plant → it saw ZERO
stores/deliveries/EIs (Billing page + statement were empty). Fixed on two layers:
- **Client:** `getStoresForCurrentUser` / `getDeliveriesForCurrentUser` /
  `getBillingForCurrentUser` now return all for `billing_user` (like owner/ops).
- **RLS:** `008_billing_user_read_all.sql` adds `OR app_role() = 'billing_user'` to
  the SELECT policies of stores / deliveries / beginning_inventories /
  ending_inventories / packaging_orders / special_orders (read-only widening; write
  scope untouched — mirrors how forecaster already reads all forecasts). **Run 008
  in Supabase**, else billing_user still reads nothing from the DB.

## Billing detail drawer — no fabricated AI logs
`BillingDetailDrawer.tsx` used to render a hardcoded **"AI Processing Logs"**
panel (`generateAILogs` — DR OCR Scan / **Crate Count Estimation** / Discrepancy
Check / Billing Calculation with invented confidence scores). AI crate counting
was removed post-approval (manual counting only), so that panel referenced a
feature that no longer exists and showed made-up numbers on real billings — it
was **deleted entirely** (function, `ConfidenceBadge` helper, `Bot` icon). The
drawer still shows the real **Source Breakdown** (contributing approved EIs /
special / packaging orders). Do not re-add simulated AI logs.

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
