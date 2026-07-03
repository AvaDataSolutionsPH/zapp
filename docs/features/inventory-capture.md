# Feature: Inventory Capture (Beginning & Ending Inventory)

**Status:** live
**Owner roles:** franchisees submit; PD / area_manager / ops / owner review downstream.

The two front-line data-entry flows that feed the [[ending-inventory-review]]
state machine and, once approved, the [[billing-and-delivery-recompute]] cascade.

## Entry points
- Beginning Inventory (BI): `src/pages/inventory/BeginningInventoryPage.tsx`
  — a 5-step wizard (Upload DR → Upload Crate Photos → DR OCR → Confirm/Edit → Submit).
- Ending Inventory (EI): `src/pages/inventory/EndingInventoryPage.tsx`
  — single-form: pick delivery → enter unsold qty per SKU → upload crate photos → save.

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

## DR-slip OCR — KEPT (separate feature, local, no API)
BI Step 3 still runs OCR on the uploaded DR image via **local Tesseract.js**
(`src/services/tesseractService.ts` → `tesseractAnalyzeDR`), zero cost, no
network. On failure it falls back to the mock `aiService.processOCR`
(`src/services/api.ts`). OCR only pre-fills DR quantities; the human still
confirms. Do NOT confuse this with crate counting — OCR stays.

## Files
| File / symbol | Role |
|---|---|
| `src/pages/inventory/BeginningInventoryPage.tsx` → `processAI` | runs DR OCR (Tesseract + mock fallback), builds confirm rows |
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
- EI `aiResults` is now saved as `[]`; BI `aiResults` is `[...ocrResults]` (DR
  OCR only, no crate estimates).
- `VITE_GEMINI_API_KEY` is dead — no code reads it. Can be deleted from
  `.env.local` + Vercel env.
- Selector dropdowns here still list ALL deliveries, not scope-filtered — see
  CLAUDE.md "Phase 2B polish backlog" (Select-Delivery scoping).

## Related
[[ending-inventory-review]] · [[billing-and-delivery-recompute]] ·
CLAUDE.md "Pending product decisions" · memory `project_ocr_engine_decision`
