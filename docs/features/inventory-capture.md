# Feature: Inventory Capture (Beginning & Ending Inventory)

**Status:** live
**Owner roles:** franchisees submit; PD / area_manager / ops / owner review downstream.

The two front-line data-entry flows that feed the [[ending-inventory-review]]
state machine and, once approved, the [[billing-and-delivery-recompute]] cascade.

## Entry points
- Beginning Inventory (BI): `src/pages/inventory/BeginningInventoryPage.tsx`
  — a 5-step wizard (Upload DR → Upload Crate Photos → **Scan DR** → Confirm/Edit → Submit).
  **No separate "select delivery" gate** — the page lands straight in the flow,
  auto-selecting the first delivered delivery (scoped to the user via
  `getDeliveriesForCurrentUser()`); an inline `Select` in the header switches
  between deliveries when the user has more than one.
- Ending Inventory (EI): `src/pages/inventory/EndingInventoryPage.tsx`
  — single-form: pick delivery → enter unsold qty per SKU → upload crate photos → save.
  The "Select Delivery" dropdown lists only deliveries **not yet ended** (any
  delivery with an existing EI drops out; resubmits happen from the history table,
  now titled **"Ending Inventory History"**).

## Camera capture
`src/components/ui/FileUpload.tsx` takes an opt-in `camera` prop. When set it
renders a **"Use Camera"** button backed by a hidden
`<input capture="environment">` — on phones this opens the rear camera directly
so franchisees can shoot the DR / crate photo in-app; desktop falls back to the
file picker. Enabled on BI (DR + crate) and EI (crate) uploads.

## Manual-only counting (Gemini removed)
**There is NO automated crate counting.** It was removed post-approval — the
manual flow was already faster than the old messenger process and AI crate
counting added cost/complexity for little value. What this means concretely:

- Crate photos are captured as **evidence only** (uploaded to `zapp-private`),
  never fed to any counter.
- Quantities are **entered/confirmed manually**: BI defaults each row to the DR
  OCR quantity and the user edits; EI is typed in directly per SKU.
- `src/services/aiService.ts` (the Gemini wrapper) was **deleted**. The
  `@google/genai` dependency and the `window.aiService` dev-console hook in
  `src/main.tsx` were removed. `aiService.estimateCrates` /
  `detectDiscrepancies` were removed from `src/services/api.ts`.

## "Scan Delivery Receipt" — reads the uploaded DR image (KEPT, local, no API)
BI Step 3 is user-labelled **"Scan Delivery Receipt" / "Scan DR"** (no more
"OCR" jargon). `processAI` runs local Tesseract.js on the **uploaded DR image**
(`tesseractService.ts` → `tesseractAnalyzeDR`), zero cost, no network. The result
is exactly the donuts written on THAT slip and nothing else — because it reads
the image, not any system record. On OCR failure it falls back to
`aiService.processOCR` sample items so the flow never blocks.

> ⚠️ **Do NOT reconcile the scan against `delivery.items`.** A previous attempt
> did this ("show only the delivery record's line items") and it broke real use:
> the selected delivery is often a different/mock record than the physical DR the
> franchisee uploaded, so the scan silently dropped most items (e.g. a 9-line DR
> showed only the 4 lines that happened to match the mock delivery). The scan
> must reflect the **image**. Corrections happen in Step 4, not by filtering.

## Confirm / Edit (Step 4) — fully editable
Each scanned line is editable and the reviewer reconciles physical vs DR here:
- **DR Qty is an editable input** (fix a mis-scanned quantity).
- **Confirmed Qty** input → auto-computes Lack / Overage from `confirmed − DR`.
- **+ Add Item** appends a manual row with a **SKU dropdown** (`availableSkuOptions`,
  excludes already-listed SKUs) for a donut the scan missed.
- **Trash icon** removes a wrongly-picked-up line.
Rows carry a stable `rowId` (scanned `scan-<skuId>` / manual `manual-<n>` via a
`useRef` counter) so keys survive add/remove. On submit, manual rows with no SKU
selected are filtered out.

## Files
| File / symbol | Role |
|---|---|
| `src/pages/inventory/BeginningInventoryPage.tsx` → `processAI` | scans the uploaded DR image (Tesseract + mock fallback), builds editable confirm rows |
| `src/pages/inventory/BeginningInventoryPage.tsx` → `updateRow` / `addManualRow` / `removeRow` | Step-4 edit: editable DR/confirmed qty, add SKU (dropdown), remove row |
| `src/pages/inventory/EndingInventoryPage.tsx` → `updateUnsold`, `handleSave` | manual unsold entry + submit/resubmit |
| `src/services/tesseractService.ts` → `tesseractAnalyzeDR` | local DR OCR (KEPT) |
| `src/services/api.ts` → `aiService.processOCR` | mock OCR fallback (KEPT) |
| `src/services/storage.ts` → `uploadFile`, `buildObjectPath` | DR + crate photo uploads (`bi-dr`/`bi-crate`/`ei-crate` prefixes) |
| `src/store/useStore.ts` → `addBeginningInventory`, `addEndingInventory`, `resubmitEndingInventory` | persist (optimistic + rollback) |

## Data flow
BI: upload DR + crate photos → `processAI` (Tesseract OCR → confirm rows) →
manual edit → `handleSubmit` uploads photos to `zapp-private`, `addBeginningInventory`
(status `confirmed`). EI: pick delivery → type unsold per SKU → `handleSave`
uploads crate photos, `addEndingInventory` (status `pending_review`) which then
enters the [[ending-inventory-review]] queue.

## Gotchas
- **`crate_estimate` AIResult type + `InventoryItem.aiEstimate` still exist** in
  `src/types/index.ts` — kept for back-compat with seeded mock `aiResults` and
  the legacy `AIValidationPage.tsx`. They are simply no longer *produced* by
  these two capture flows. Don't remove them without also purging mock data.
- EI `aiResults` is now saved as `[]`; BI `aiResults` is `[...ocrResults]` (the
  raw scan of the uploaded DR image; see the ⚠️ above — NOT reconciled against
  `delivery.items`).
- `VITE_GEMINI_API_KEY` is dead — no code reads it. Can be deleted from
  `.env.local` + Vercel env.
- **BI's Select-Delivery is now scoped** (`getDeliveriesForCurrentUser()`) and
  auto-selects. EI's dropdown filters out already-ended deliveries but is not yet
  role-scoped — the other selector-scoping backlog items (Forecasting / Packaging)
  still stand; see CLAUDE.md "Phase 2B polish backlog".

## Related
[[ending-inventory-review]] · [[billing-and-delivery-recompute]] ·
CLAUDE.md "Pending product decisions" · memory `project_ocr_engine_decision`
