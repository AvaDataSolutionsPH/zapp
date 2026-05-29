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

import { GoogleGenAI } from '@google/genai';
import type { AIResult, SKU } from '@/types';

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

// ── Phase 2D-2: DR slip OCR (stub) ──────────────────────────────────

export async function geminiAnalyzeDR(
  _file: File,
  _skus: SKU[],
): Promise<AIResult[]> {
  throw new Error('geminiAnalyzeDR not implemented — wired in Phase 2D-2');
}

// ── Phase 2D-3: Crate counting (stub) ───────────────────────────────

export async function geminiCountCrate(
  _file: File,
  _skus: SKU[],
): Promise<AIResult[]> {
  throw new Error('geminiCountCrate not implemented — wired in Phase 2D-3');
}
