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

const GEMINI_MODEL = 'gemini-flash-latest';

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
- Match liberally on category words: any "chocolate ___" → likely sku-02; any "bavarian ___" → likely sku-03.
- Set matchedSkuId to null when no reasonable match exists rather than forcing one.
- Codes printed on the slip (like 10-digit material codes) are NOT in this catalog — use the text description for matching.

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

  const response = await ai.models.generateContent({
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
  });

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

// ── Phase 2D-3: Crate counting (stub) ───────────────────────────────

export async function geminiCountCrate(
  _file: File,
  _skus: SKU[],
): Promise<AIResult[]> {
  throw new Error('geminiCountCrate not implemented — wired in Phase 2D-3');
}
