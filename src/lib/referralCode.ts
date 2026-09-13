// ============================================================
// ZAPP Donuts ERP — referral / channel code rules (pure)
// ============================================================
//
// A referral code is the string a franchisee types on `/apply` to reach their
// Partner Distributor or Sub-Partner. It is created with the account and, once
// anyone has applied under it, is effectively PERMANENT:
//
//     applications.referral_code  TEXT NOT NULL   -- the STRING, not an FK
//     referral_codes.code         TEXT NOT NULL UNIQUE
//
// Because an application stores the text rather than a link, renaming a code
// that is already in use does not fail — it quietly detaches every application
// filed under the old string from its distributor, with no error anywhere.
// That is why renaming is allowed ONLY while no application references it.

/** Codes are dictated over the phone, so they are upper-case and hyphenated. */
export const normalizeReferralCode = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

/**
 * Why a code is unacceptable, or null when it is fine.
 *
 * Deliberately strict about the character set: these get read aloud, written on
 * paper and retyped by applicants, so anything that survives normalisation but
 * reads badly is rejected early rather than becoming permanent.
 */
export const validateReferralCode = (raw: string): string | null => {
  const code = normalizeReferralCode(raw);
  if (!code) return 'Kailangan ng code.';
  if (code.length < 3) return 'Masyadong maikli — kahit 3 karakter.';
  if (code.length > 32) return 'Sobrang haba — 32 karakter lang.';
  if (!/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/.test(code)) {
    return 'Letra, numero at gitling lang (hal. MARX-BICOL).';
  }
  return null;
};

/** Derive a default code from a display name: "Juan Cruz" -> "JUAN-CRUZ-4F2". */
export const codeFromName = (name: string): string => {
  const slug = normalizeReferralCode(name).slice(0, 16) || 'PARTNER';
  return `${slug}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
};
