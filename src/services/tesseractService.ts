// ============================================================
// ZAPP Donuts ERP - tesseractService (Phase 2D-4: local OCR)
// ============================================================
//
// Local, no-API alternative to Gemini DR-slip OCR. Runs entirely
// in the browser via tesseract.js (WASM) so there is zero per-call
// cost and no data leaves the device. Trade-off vs Gemini: lower
// accuracy on skewed / low-contrast photos, printed text only
// (handwriting is not supported), and no LLM to do the SKU
// matching for us — so the parsing + fuzzy-matching that Gemini
// did server-side now happens here in plain code.
//
// The public entry point `tesseractAnalyzeDR` returns the EXACT
// same `AIResult[]` shape as `geminiAnalyzeDR`, so the
// BeginningInventoryPage consumer is unchanged.
//
// tesseract.js is dynamically imported inside the function so its
// (heavy) WASM bundle is only fetched the first time OCR actually
// runs, never at app boot.

import type { AIResult, ConfidenceLevel, SKU } from '@/types';

// ── Tuning constants ────────────────────────────────────────────────
//
// MATCH_THRESHOLD: minimum fuzzy score (0-1) to bind a parsed line to
// a catalog SKU. Below this we still surface the line but with no
// skuId + a "no catalog match" warning (mirrors the Gemini path).
const MATCH_THRESHOLD = 0.45;
const HIGH_MATCH = 0.8;

// Footer / header rows on a DR carry numbers too (totals, VAT, etc.)
// but are not product lines. Any line containing one of these words is
// skipped so it never becomes a bogus line item.
const SKIP_KEYWORDS = [
  'total',
  'subtotal',
  'grand',
  'vat',
  'vatable',
  'amount',
  'allowance',
  'mdsg',
  'sales',
  'signature',
  'received',
  'delivered',
  'driver',
  'customer',
  'route',
  'cluster',
  'plant',
  'date',
  'tin',
  'invoice',
  'receipt',
  'quantity',
  'description',
  'price',
  'dr no',
  'serial',
  'po no',
  'order no',
];

// ── Text normalisation + tokenising ─────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1); // single letters add noise
}

// ── Parsed line item ────────────────────────────────────────────────

export interface ParsedDRLine {
  rawLine: string;
  description: string; // alphabetic portion, for fuzzy matching
  quantity: number;
}

/**
 * Split raw OCR text into candidate DR line items.
 *
 * Heuristics (deliberately simple for v1 — printed, clean DR slips
 * generated from our own SKU catalog):
 *   - One line item per text line.
 *   - The quantity is the first INTEGER token (no decimal point).
 *     Price columns are 4-decimal (20.4400) so the decimal check
 *     keeps us from mistaking a price for the count.
 *   - The description is the alphabetic remainder of the line.
 *   - Lines with a SKIP_KEYWORD (totals/headers) are dropped.
 *   - Lines with no integer qty or no alphabetic description are
 *     dropped (separators, page numbers, etc.).
 */
export function parseDRLines(rawText: string): ParsedDRLine[] {
  const out: ParsedDRLine[] = [];

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const lower = line.toLowerCase();
    if (SKIP_KEYWORDS.some((kw) => lower.includes(kw))) continue;

    // First standalone integer (not part of a decimal) = quantity.
    // Capped at 3 digits: a single delivery line is never 1000+ units,
    // and the cap also rejects long serial/DR codes (e.g. "8583-0042")
    // so a header row never leaks in as a bogus line item.
    const qtyMatch = line.match(/(?<![.\d])(\d{1,3})(?![.\d])/);
    if (!qtyMatch) continue;
    const quantity = parseInt(qtyMatch[1], 10);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    // Description = the alphabetic words on the line.
    const description = line
      .replace(/[0-9.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const letters = description.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 3) continue; // need a real word to match on

    out.push({ rawLine: line, description, quantity });
  }

  return out;
}

// ── Fuzzy SKU matching ──────────────────────────────────────────────

/**
 * Dice coefficient over token sets — symmetric, cheap, and tolerant
 * of word-order differences ("Glazed Classic" vs "Classic Glazed").
 */
function tokenSetScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const t of new Set(a)) {
    if (setB.has(t)) shared += 1;
  }
  return (2 * shared) / (a.length + b.length);
}

export interface SkuMatch {
  sku?: SKU;
  score: number;
}

/**
 * Best fuzzy match for a description against the SKU catalog. Scores
 * against each SKU's name (primary) plus a small bonus when the
 * category word also appears, then keeps the top scorer. Returns no
 * sku when the best score is below MATCH_THRESHOLD.
 */
export function fuzzyMatchSku(description: string, skus: SKU[]): SkuMatch {
  const descTokens = tokenize(description);
  if (descTokens.length === 0) return { score: 0 };

  let best: SkuMatch = { score: 0 };

  for (const sku of skus) {
    const nameTokens = tokenize(sku.name);
    let score = tokenSetScore(descTokens, nameTokens);

    // Small nudge if the full normalised name appears as a substring
    // (handles single-token catalog names that the Dice set misses).
    const normName = normalize(sku.name);
    const normDesc = normalize(description);
    if (normName.length > 0 && normDesc.includes(normName)) {
      score = Math.max(score, 0.85);
    }

    // Tiny bonus when the category word is also present.
    if (sku.category && tokenize(sku.category).some((c) => descTokens.includes(c))) {
      score = Math.min(1, score + 0.05);
    }

    if (score > best.score) best = { sku, score };
  }

  return best.score >= MATCH_THRESHOLD ? best : { score: best.score };
}

// ── Confidence mapping ──────────────────────────────────────────────

/**
 * Combine the fuzzy-match strength with Tesseract's OCR confidence
 * (0-1) into the app's three-level scale. Match strength dominates —
 * a clean OCR read of the wrong SKU is still wrong.
 */
export function scoreToConfidence(matchScore: number, ocrConfidence: number): ConfidenceLevel {
  if (matchScore >= HIGH_MATCH && ocrConfidence >= 0.6) return 'high';
  if (matchScore >= MATCH_THRESHOLD) return 'medium';
  return 'low';
}

// ── Public entry point ──────────────────────────────────────────────

/**
 * Run local OCR on a DR image and map the result into AIResult[].
 * Same contract as geminiAnalyzeDR: type='ocr_dr', confidence set,
 * extractedValue = integer qty, skuId set on a clean match else
 * omitted with the raw text carried in skuName + a warning.
 *
 * Throws on any OCR failure so the caller's mock-fallback path runs
 * (identical pattern to the Gemini branch in BeginningInventoryPage).
 */
export async function tesseractAnalyzeDR(file: File, skus: SKU[]): Promise<AIResult[]> {
  // Lazy-load the WASM engine only when OCR actually runs.
  const { recognize } = await import('tesseract.js');

  const result = await recognize(file, 'eng');
  const text = result?.data?.text ?? '';
  // tesseract.js reports overall confidence as 0-100; normalise to 0-1.
  const ocrConfidence = Math.max(0, Math.min(1, (result?.data?.confidence ?? 0) / 100));

  const lines = parseDRLines(text);
  const stamp = Date.now().toString(36);

  return lines.map((line, idx): AIResult => {
    const { sku, score } = fuzzyMatchSku(line.description, skus);
    const confidence = scoreToConfidence(score, ocrConfidence);
    return {
      id: `ocr-tess-${stamp}-${idx}`,
      type: 'ocr_dr',
      skuId: sku?.id,
      skuName: sku?.name ?? line.description,
      extractedValue: Math.max(0, Math.floor(line.quantity || 0)),
      confidence,
      warning: !sku
        ? `No catalog match for "${line.description.trim()}"`
        : confidence !== 'high'
          ? `Low-confidence OCR match — please verify`
          : undefined,
    };
  });
}
