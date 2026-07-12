// ============================================================
// ZAPP Donuts ERP - Gov ID OCR (Partner Onboarding Phase 3)
// ============================================================
//
// Best-effort ID scanning for the /onboarding Documents step. Runs local
// tesseract.js (no API, nothing leaves the device) on the uploaded government
// ID image and heuristically extracts the printed full name + ID number to
// PRE-FILL editable fields.
//
// Accuracy on varied PH ID layouts and phone photos is modest BY DESIGN — the
// applicant always confirms/corrects the values, and the reviewer sees them
// against the actual ID image at verification. This is an autofill convenience
// + a soft anti-fraud cross-check, never an authoritative read.
//
// tesseract.js is dynamically imported (heavy WASM) so it only loads when an ID
// is actually scanned, never at app boot.

export interface IdOcrResult {
  fullName?: string;
  idNumber?: string;
  rawText: string;
}

// Common PH government-ID number formats, most-specific first. A match is a
// strong hint, not a guarantee.
const ID_NUMBER_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // PhilSys / PhilID (16-digit, grouped)
  /\b\d{4}-\d{7}-\d\b/,          // UMID / SSS CRN
  /\b[A-Z]\d{2}-\d{2}-\d{6}\b/,  // Driver's License
  /\b\d{2}-\d{7}-\d\b/,          // SSS
  /\b[A-Z]{2}\d{7}\b/,           // Passport
  /\b\d{3}-\d{3}-\d{3}(?:-\d{3})?\b/, // TIN
];

const NAME_LABEL =
  /(?:full\s*name|name|pangalan|apelyido|surname|given\s*names?|last\s*name|first\s*name)\s*[:-]?\s*(.+)/i;

// Words that mark a line as ID chrome (headers, titles, field labels, issuer
// names) rather than the holder's name. Any candidate line containing one is
// rejected — this is what stops "REPUBLIC OF THE PHILIPPINES" / "PHILIPPINE
// IDENTIFICATION CARD" from being mistaken for the name. Kept lowercase; the
// holder's actual name effectively never contains these tokens.
const NON_NAME_WORDS = new Set([
  'republic', 'republika', 'philippines', 'philippine', 'pilipinas', 'identification',
  'identity', 'card', 'license', 'licence', 'driver', 'drivers', 'professional',
  'regulation', 'commission', 'social', 'security', 'system', 'unified', 'multipurpose',
  'multi', 'purpose', 'passport', 'postal', 'voter', 'voters', 'senior', 'citizen',
  'national', 'government', 'govt', 'date', 'birth', 'address', 'sex', 'gender',
  'nationality', 'signature', 'valid', 'until', 'expiry', 'expiration', 'issued',
  'issue', 'pcn', 'crn', 'tin', 'sss', 'umid', 'philsys', 'philhealth', 'pagibig',
  'bureau', 'internal', 'revenue', 'department', 'office', 'of', 'the', 'no',
]);

function hasNonNameWord(line: string): boolean {
  return line.toLowerCase().split(/[^a-zñ]+/).some((w) => w.length > 0 && NON_NAME_WORDS.has(w));
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/\b([a-zñ])/g, (c) => c.toUpperCase());
}

function cleanNameCandidate(s: string): string {
  return s.replace(/[^A-Za-zÑñ.\-'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function looksLikeName(s: string): boolean {
  const words = s.split(' ').filter((w) => w.length >= 2);
  if (words.length < 2 || words.length > 5) return false;
  return s.replace(/[^A-Za-z]/g, '').length >= 5;
}

function extractIdNumber(text: string): string | undefined {
  for (const re of ID_NUMBER_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return undefined;
}

function extractFullName(lines: string[]): string | undefined {
  // 1. Prefer a labelled line ("Name: JUAN DELA CRUZ") whose value isn't itself
  //    ID chrome.
  for (const line of lines) {
    const m = line.match(NAME_LABEL);
    if (m) {
      const cand = cleanNameCandidate(m[1]);
      if (looksLikeName(cand) && !hasNonNameWord(cand)) return toTitle(cand);
    }
  }
  // 2. Otherwise the longest predominantly-uppercase alphabetic line that is NOT
  //    an ID header/title/label (PH IDs print the holder's name in caps).
  //    hasNonNameWord drops "Republic of the Philippines", "Identification
  //    Card", field labels, etc.; the uppercase ratio drops address/date lines.
  let best: string | undefined;
  let bestLen = 0;
  for (const line of lines) {
    if (hasNonNameWord(line)) continue;
    const cand = cleanNameCandidate(line);
    if (!looksLikeName(cand)) continue;
    const alpha = line.replace(/[^A-Za-z]/g, '').length;
    const upperRatio = line.replace(/[^A-Z]/g, '').length / Math.max(1, alpha);
    if (upperRatio < 0.6) continue;
    if (cand.length > bestLen) {
      best = cand;
      bestLen = cand.length;
    }
  }
  return best ? toTitle(best) : undefined;
}

/**
 * Run local OCR on a government-ID image and best-effort extract the printed
 * full name + ID number. Never returns garbage-guaranteed fields — either a
 * plausible value or `undefined`. Throws only if OCR itself fails; callers
 * treat that as "no autofill" and proceed.
 */
export async function scanGovId(file: File): Promise<IdOcrResult> {
  const { recognize } = await import('tesseract.js');
  const result = await recognize(file, 'eng');
  const rawText = result?.data?.text ?? '';
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    fullName: extractFullName(lines),
    idNumber: extractIdNumber(rawText),
    rawText,
  };
}
