# Reference — Billing User Statement Format

**Purpose:** These images are the **target format** for what the **billing user**
should see / be able to generate in the ERP. Boss (via Randy) forwarded a real
billing statement as the format to replicate ("ganito yung dapat makita ni
billing user. ganyang format").

## Ilagay dito ang mga reference image

Drop the forwarded billing-statement images **into this folder** (`docs/references/billing-statement-format/`).

Suggested file names (para madaling ma-refer, in reading order):

```
billing-format-01.png
billing-format-02.png
billing-format-03.png
...
```

- Any image type is fine (`.png` / `.jpg`). Keep them in page order.
- Kung marami (multi-page statement), sunod-sunod lang ang numero.
- No processing needed — ilagay lang as-is.

## Paano ito gagamitin

When we build/redesign the **billing-user billing view / statement export** to
match this format, this folder is the single source of truth for the layout —
Claude will read these images here instead of asking for them to be re-sent each
session.

## Notes — BUILT

- Sino ang gumagamit: **billing user** (e.g. `ivan@zappdonuts.ph`) + owner / ops.
- **Implemented:** `src/pages/billing/BillingStatementPage.tsx`, route
  `/billing/statement` (standalone, outside the dashboard Layout for a clean
  Print → PDF), gated to `billing_user` / `owner` / `operations_manager`.
  Entry: "Billing Statement" button on `BillingPage`.
- **Format (carbon copy):** ZAPP logo (`public/zapp-logo.png`) + "UBERDELI CORP."
  letterhead + "BILLING SUMMARY"; Customer block (Name / Payer Code / Tin / Address);
  Account Summary box (Page x of y · Statement Date · Payment Due Date · Current
  [period] + amount · Ref. Doc No. · Total Statement); line-item table (Delivery
  Date · PO Number · DR Number · Shop Code · Shop Name · DR Amount · Returns ·
  Delivery Adjustment · Merch. Allowance · Net Amount) grouped **per shop** with
  subtotals + GRAND TOTAL + "***END OF STATEMENT***".
- **One statement per DISTRIBUTOR (payer) per cutoff period.** Rows = that
  distributor's shops' deliveries in the period.
- **Placeholders (no data yet):** Shop Code (MD supplies later), Payer Code =
  distributor id, Tin/Address = "—", Returns/Delivery Adjustment/Merch. Allowance
  = 0.000 (Net = DR Amount). Wire to real returns/unsold later.
- Related: `src/lib/billingComputations.ts` (`getCutoffEndDate`, `CutoffRange`),
  `docs/features/billing-and-delivery-recompute.md`.
