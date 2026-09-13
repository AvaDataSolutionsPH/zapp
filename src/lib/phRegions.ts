// ============================================================
// ZAPP Donuts ERP — province → Location (region grouping), pure
// ============================================================
//
// The monitoring module's "Location" field: a coarse grouping the business
// thinks in ("Bicol Region", "Metro Manila", "Mindoro", ...), auto-determined
// from the applicant's province. Its examples were Bicol Region, Quezon
// Province, Metro Manila, Cavite, Mindoro, Nueva Ecija, Pampanga, "Other
// supported regions".
//
// This is plain PH geography, not a business decision, so it's seeded here
// rather than asked for. Note the grouping is NOT uniform: some entries are a
// whole region (Bicol), some a single province (Cavite), some a pair (Mindoro) —
// that's the business's own vocabulary, kept as-is on purpose.
//
// Provinces are matched case-insensitively and tolerate the "(NCR)" suffix the
// /apply PSGC cascade adds to Metro Manila.
//
// Unknown provinces fall back to the province name itself rather than a bogus
// group — better an honest "Cebu" than mislabelling it.

/** Province (lowercased) → Location label. */
const PROVINCE_TO_LOCATION: Record<string, string> = {
  // Bicol Region
  albay: 'Bicol Region',
  'camarines norte': 'Bicol Region',
  'camarines sur': 'Bicol Region',
  catanduanes: 'Bicol Region',
  sorsogon: 'Bicol Region',
  masbate: 'Bicol Region',
  // Standalone provinces the business names directly
  quezon: 'Quezon Province',
  cavite: 'Cavite',
  'nueva ecija': 'Nueva Ecija',
  pampanga: 'Pampanga',
  batangas: 'Batangas',
  laguna: 'Laguna',
  // Grouped
  'occidental mindoro': 'Mindoro',
  'oriental mindoro': 'Mindoro',
  // NCR is a region, not a PSGC province — phLocations.ts injects it as
  // "Metro Manila (NCR)", so both spellings must resolve.
  'metro manila': 'Metro Manila',
  'metro manila (ncr)': 'Metro Manila',
  ncr: 'Metro Manila',
};

/**
 * The canonical comparison key for a province name.
 *
 * ⚠️ The SAME province arrives under TWO spellings. The `/apply` PSGC cascade
 * injects NCR as **"Metro Manila (NCR)"** (`NCR_PROVINCE` in
 * `services/phLocations.ts` — NCR is a region, so the PSGC `/provinces/`
 * endpoint omits it), while the admin's Assign-Provinces master list writes
 * **"Metro Manila"** (from `OPERATING_PROVINCES` below). Province matching is an
 * exact compare, so without this helper assigning "Metro Manila" to an Area
 * Supervisor could NEVER match a Metro Manila application — the AS would see an
 * empty queue with no error, exactly the failure migration 029 fixed for the
 * frozen-id case.
 *
 * Strips ONE trailing parenthetical suffix, then trims + lowercases. It is a
 * pure no-op for every province without a parenthetical — which today is every
 * single entry of `OPERATING_PROVINCES`, Bicol included. That is what makes
 * adopting it regression-safe: no live value changes meaning.
 *
 * ⚠️ Keep in sync with `app_province_key()` in
 * `supabase/migrations/040_province_canonical_match.sql` — RLS runs FIRST, so if
 * Postgres and the client disagree on ownership the row is dropped before the
 * client ever sees it.
 */
export const canonicalProvince = (p: string | undefined): string =>
  (p ?? '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase();

/**
 * Location for a province. Returns undefined only for blank input, so a
 * province we don't group yet still records something meaningful.
 */
export const resolveLocation = (province: string | undefined): string | undefined => {
  const key = province?.trim().toLowerCase();
  if (!key) return undefined;
  return PROVINCE_TO_LOCATION[key] ?? province!.trim();
};

/** Distinct Location labels, for filter dropdowns. */
export const ALL_LOCATIONS: string[] = [
  ...new Set(Object.values(PROVINCE_TO_LOCATION)),
].sort();

/**
 * The provinces the business operates in, in the order the module's Area
 * filter lists them. Used to populate the admin's province picker — an admin
 * must be able to assign a province BEFORE any application from it exists.
 */
export const OPERATING_PROVINCES: string[] = [
  'Albay',
  'Camarines Norte',
  'Camarines Sur',
  'Catanduanes',
  'Sorsogon',
  'Masbate',
  'Quezon',
  'Cavite',
  'Metro Manila',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Nueva Ecija',
  'Pampanga',
  'Batangas',
  'Laguna',
];
