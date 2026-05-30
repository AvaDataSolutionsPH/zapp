// ============================================================
// ZAPP Donuts ERP - aiService (Phase 2D foundation)
// ============================================================
//
// Thin wrapper around @google/genai for the two vision tasks
// we need: DR-slip OCR (extract line items from a printed
// delivery receipt) and crate counting (count + classify donuts
// in a top-down crate photo). 2D-1 only ships the foundation
// (SDK init, env-var gate, file → base64 helper, ping). The
// actual prompt + JSON-schema logic lands in 2D-2 + 2D-3.

import { GoogleGenAI, Type } from '@google/genai';
import type { AIResult, ConfidenceLevel, SKU } from '@/types';

// ── Config ──────────────────────────────────────────────────────────

// Pinned to the stable 2.5 Flash release rather than the `-latest`
// moving alias. The alias periodically routes to whichever model is
// freshest and during high-traffic windows that pool gets saturated
// before the pinned stable models do.
const GEMINI_MODEL = 'gemini-2.5-flash';

// Vite exposes only `VITE_*` env vars to the browser bundle. Missing
// or empty value = AI features stay off; consumers fall back to the
// existing mock path so the app still works locally without a key.
function readApiKey(): string | undefined {
  const raw = import.meta.env.VITE_GEMINI_API_KEY;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isGeminiConfigured(): boolean {
  return readApiKey() !== undefined;
}

// ── Client (lazy singleton) ─────────────────────────────────────────
//
// We construct the GoogleGenAI client on first use rather than at
// module load so an unconfigured env never crashes the app shell.

let clientSingleton: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (clientSingleton) return clientSingleton;
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env.local.',
    );
  }
  clientSingleton = new GoogleGenAI({ apiKey });
  return clientSingleton;
}

// ── Browser file → base64 ───────────────────────────────────────────
//
// `inlineData` in the Gemini API expects a base64-encoded string of
// the raw bytes plus the original MIME type. We avoid Node's Buffer
// (not in the browser bundle) by going through FileReader.readAsDataURL
// and stripping the `data:<mime>;base64,` prefix.

export async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file as data URL'));
        return;
      }
      const commaIdx = result.indexOf(',');
      if (commaIdx < 0) {
        reject(new Error('Malformed data URL from FileReader'));
        return;
      }
      resolve({
        data: result.slice(commaIdx + 1),
        mimeType: file.type || 'application/octet-stream',
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

// ── Retry helper ────────────────────────────────────────────────────
//
// Gemini Free Tier sporadically returns HTTP 503 UNAVAILABLE when the
// shared inference pool is saturated. The Google API itself recommends
// retrying — most 503s recover within a few seconds. We retry up to
// `maxAttempts` times with exponential backoff (1s, 2s, 4s) and only
// for the specific transient codes; everything else throws immediately
// so the caller's fallback path runs without an extra delay.

const TRANSIENT_PATTERNS = ['503', 'UNAVAILABLE', '429', 'RESOURCE_EXHAUSTED'];

function isTransient(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

async function retryOnTransient<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === maxAttempts) throw err;
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ── Connectivity check ──────────────────────────────────────────────
//
// Smallest possible round-trip to verify the API key + network path
// work end-to-end. Returns the model's reply string on success or
// throws on any failure. Useful for the dev console + future settings
// page health check.

export async function pingGemini(): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: 'Reply with the single word OK and nothing else.',
  });
  return response.text ?? '';
}

// ── Phase 2D-2: DR slip OCR ─────────────────────────────────────────
//
// Sends the uploaded DR image to Gemini Vision with a structured JSON
// schema and the in-app SKU catalog, then maps the response into the
// existing AIResult shape so the BeginningInventoryPage consumer is
// unchanged. Fuzzy matching is delegated to the model — we provide the
// catalog and ask it to pick the closest match (or null) per line.
//
// The returned AIResult[] guarantees: type='ocr_dr', confidence set,
// extractedValue present (qty as integer). skuId is set when the model
// found a clean match; otherwise it's omitted and skuName carries the
// raw printed description so the reviewer can manually map.

const CONFIDENCE_VALUES: ConfidenceLevel[] = ['high', 'medium', 'low'];

function normalizeConfidence(value: unknown): ConfidenceLevel {
  return CONFIDENCE_VALUES.includes(value as ConfidenceLevel)
    ? (value as ConfidenceLevel)
    : 'low';
}

interface DRLineItem {
  rawDescription: string;
  quantity: number;
  matchedSkuId?: string | null;
  confidence: string;
  matchReason?: string | null;
}

interface DRResponse {
  drNumber?: string | null;
  drDate?: string | null;
  lineItems: DRLineItem[];
}

const DR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    drNumber: { type: Type.STRING, nullable: true },
    drDate: { type: Type.STRING, nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rawDescription: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
          matchedSkuId: { type: Type.STRING, nullable: true },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
          matchReason: { type: Type.STRING, nullable: true },
        },
        required: ['rawDescription', 'quantity', 'confidence'],
      },
    },
  },
  required: ['lineItems'],
};

function buildDRPrompt(skus: SKU[]): string {
  const catalog = skus
    .map((s) => `- ${s.id}: ${s.name} (${s.category})`)
    .join('\n');

  return `You are reading a printed Delivery Receipt (DR) from a Philippine donut distribution business.

Task: extract every product line item printed on the receipt. Ignore header rows, totals, signatures, and any non-line-item content.

For each line item, return:
- rawDescription: the exact product name/code as printed on the slip
- quantity: the order quantity (integer; truncate decimals to the integer part)
- matchedSkuId: best match from the catalog below, or null if no clean match
- confidence: "high" (clear name match), "medium" (partial / category match / synonym), or "low" (uncertain guess)
- matchReason: short explanation (e.g. "exact name match", "no chocolate-ring entry in catalog, matched on chocolate")

Catalog of valid SKUs (try to map each rawDescription to one of these):
${catalog}

Matching rules:
- Match liberally on category/flavor words (e.g. any "chocolate ___", any "bavarian ___") to the closest catalog name.
- The catalog id IS the real 10-digit product code printed in the slip's Code column. If a line shows a 10-digit code that exactly equals a catalog id, match to that id directly — it is the most reliable signal.
- Set matchedSkuId to null when no reasonable match exists rather than forcing one.

Also extract from the header if present:
- drNumber: the DR number
- drDate: the DR date

Return JSON only matching the provided schema. No prose.`;
}

export async function geminiAnalyzeDR(
  file: File,
  skus: SKU[],
): Promise<AIResult[]> {
  const ai = getClient();
  const { data, mimeType } = await fileToBase64(file);

  const response = await retryOnTransient(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildDRPrompt(skus) },
            { inlineData: { data, mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: DR_RESPONSE_SCHEMA,
      },
    }),
  );

  const raw = response.text ?? '';
  let parsed: DRResponse;
  try {
    parsed = JSON.parse(raw) as DRResponse;
  } catch (err) {
    throw new Error(
      `Gemini returned non-JSON for DR OCR. First 200 chars: ${raw.slice(0, 200)}`,
      { cause: err },
    );
  }

  const skuById = new Map(skus.map((s) => [s.id, s]));

  return parsed.lineItems.map((line, idx): AIResult => {
    const matchedSku = line.matchedSkuId ? skuById.get(line.matchedSkuId) : undefined;
    const confidence = normalizeConfidence(line.confidence);
    return {
      id: `ocr-${Date.now().toString(36)}-${idx}`,
      type: 'ocr_dr',
      skuId: matchedSku?.id,
      skuName: matchedSku?.name ?? line.rawDescription,
      extractedValue: Math.max(0, Math.floor(line.quantity || 0)),
      confidence,
      warning:
        !matchedSku && line.rawDescription
          ? `No catalog match for "${line.rawDescription}"`
          : line.matchReason && confidence !== 'high'
            ? line.matchReason
            : undefined,
    };
  });
}

// ── Phase 2D-3: Crate counting ──────────────────────────────────────
//
// Sends one or more top-down crate photos to Gemini Vision with the
// SKU catalog and asks the model to identify visible donut types and
// tally counts per type. When multiple crate images are uploaded we
// send them all in a single multimodal request so the model sums
// across crates in one round-trip (cheaper + lower latency than N
// separate calls).
//
// Identification is best-effort: without reference photos of each SKU,
// the model leans on the catalog name + category as hints (e.g.
// "Bavarian Cream → filled donut with cream peeking out", "Classic
// Glazed → shiny clear glaze"). Demo-grade accuracy — the human
// reviewer is the final source of truth in our workflow.

interface CrateLineItem {
  matchedSkuId?: string | null;
  rawDescription: string;
  count: number;
  confidence: string;
  matchReason?: string | null;
}

interface CrateResponse {
  totalDonuts?: number;
  lineItems: CrateLineItem[];
}

const CRATE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    totalDonuts: { type: Type.INTEGER, nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          matchedSkuId: { type: Type.STRING, nullable: true },
          rawDescription: { type: Type.STRING },
          count: { type: Type.INTEGER },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
          matchReason: { type: Type.STRING, nullable: true },
        },
        required: ['rawDescription', 'count', 'confidence'],
      },
    },
  },
  required: ['lineItems'],
};

function buildCratePrompt(skus: SKU[], imageCount: number): string {
  const catalog = skus
    .map((s) => `- ${s.id}: ${s.name} (${s.category})`)
    .join('\n');

  const imageNote =
    imageCount > 1
      ? `You are looking at ${imageCount} crate photos. Sum the count across all photos per SKU (each photo shows a different crate; do NOT assume any donut appears in multiple photos).`
      : `You are looking at one crate photo.`;

  return `You are counting donuts in a Philippine donut distributor's crate(s) for an inventory check.

${imageNote}

Task: identify each visible donut and assign it to one SKU from the catalog below. Then aggregate counts per SKU.

For each SKU you see, return:
- matchedSkuId: the catalog id (the 10-digit product code), or null if you cannot confidently identify the type
- rawDescription: short visual description of what you see (e.g. "chocolate-glazed rings with rainbow sprinkles")
- count: integer count of donuts of this type across all images
- confidence: "high" (clearly identified), "medium" (likely but uncertain), "low" (guess)
- matchReason: brief visual cue (e.g. "ring + chocolate glaze + multicolor sprinkles")

Donut catalog:
${catalog}

Identification hints — these are the ONLY products that exist. Match by these
real visual associations (the codes below are the matchedSkuId to return):
- 2000017949 "Chocolate Zprinkles": RING shape, glossy chocolate glaze, topped with multicolor (rainbow) sprinkles.
- 2000000521 "Strawberry Zprinkles": RING shape, bright red/pink glaze, topped with multicolor sprinkles. (Distinguish from Chocolate Zprinkles by the RED glaze vs CHOCOLATE glaze — both are sprinkled rings.) Note: the printed DR may call this "Strawberry Filled" — same product, same code.
- 2000015695 "Choco Butternut": RING shape, coated in brown/tan crumb (butternut/sesame-like) coating, NO glossy glaze, no sprinkles.
- 2000015696 "Zapp Its! Choco Butternut": SMALL / mini version of the brown crumb-coated donut (bite-size, often round balls or small rings).
- 2000000519 "Zapp Its!": SMALL / mini plain donut dusted with powdered sugar, no filling dollop visible, no glaze.
- 2000000538 "Bavarian - Classic": ROUND/SQUARE filled donut dusted with powdered sugar, ONE filling spot (pale yellow custard).
- 2000000520 "Bavarian - Choco": ROUND/SQUARE filled donut dusted with powdered sugar, ONE filling spot (dark chocolate).
- 2000020575 "Dobol Bav - Classic, Chocolate": SQUARE powdered-sugar donut with TWO filling dollops — one pale-yellow custard AND one dark chocolate.
- 2000020576 "Dobol Bav - Classic, Strawberry": SQUARE powdered-sugar donut with TWO filling dollops — one pale-yellow custard AND one red strawberry jam.

Key disambiguation:
- RING + sprinkles → Chocolate Zprinkles (chocolate glaze) or Strawberry Filled (red glaze).
- RING + brown crumb coat, no glaze → Choco Butternut (or its mini, Zapp Its! Choco Butternut, if clearly smaller).
- SQUARE + powdered sugar → a Bavarian. ONE dollop = Bavarian Classic (yellow) / Bavarian Choco (dark). TWO dollops = Dobol Bav (yellow+dark = Chocolate; yellow+red = Strawberry).
- The "Dobol" (double) Bavarians ALWAYS show two filling holes; single Bavarians show one. Use the dollop colors to pick the flavor.

Rules:
- These 9 are the only valid products. If a donut clearly doesn't match any of them, set matchedSkuId to null and describe what you see — do NOT invent a flavor that isn't listed.
- For powdered square donuts, the filling-dollop colors are the most reliable signal; count the dollops (one vs two) first, then read their colors.
- Skip empty slots / crate background / hands / paper / non-donut objects.
- Return JSON only matching the schema. No prose.`;
}

export async function geminiCountCrate(
  files: File[],
  skus: SKU[],
): Promise<AIResult[]> {
  if (files.length === 0) {
    throw new Error('geminiCountCrate requires at least one crate image');
  }

  const ai = getClient();
  const encoded = await Promise.all(files.map((f) => fileToBase64(f)));

  const response = await retryOnTransient(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildCratePrompt(skus, files.length) },
            ...encoded.map((e) => ({
              inlineData: { data: e.data, mimeType: e.mimeType },
            })),
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: CRATE_RESPONSE_SCHEMA,
      },
    }),
  );

  const raw = response.text ?? '';
  let parsed: CrateResponse;
  try {
    parsed = JSON.parse(raw) as CrateResponse;
  } catch (err) {
    throw new Error(
      `Gemini returned non-JSON for crate count. First 200 chars: ${raw.slice(0, 200)}`,
      { cause: err },
    );
  }

  const skuById = new Map(skus.map((s) => [s.id, s]));

  return parsed.lineItems.map((line, idx): AIResult => {
    const matchedSku = line.matchedSkuId ? skuById.get(line.matchedSkuId) : undefined;
    const confidence = normalizeConfidence(line.confidence);
    return {
      id: `crate-${Date.now().toString(36)}-${idx}`,
      type: 'crate_estimate',
      skuId: matchedSku?.id,
      skuName: matchedSku?.name ?? line.rawDescription,
      estimatedValue: Math.max(0, Math.floor(line.count || 0)),
      confidence,
      warning:
        !matchedSku && line.rawDescription
          ? `Unidentified: "${line.rawDescription}"`
          : line.matchReason && confidence !== 'high'
            ? line.matchReason
            : undefined,
    };
  });
}
