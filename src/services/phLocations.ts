// ============================================================
// ZAPP Donuts ERP — Philippine location data (PSGC API)
// ============================================================
//
// Cascading Province → City/Municipality → Barangay lookups for the
// public /apply Store Info step. Backed by the free, no-key PSGC API
// (Philippine Standard Geographic Code) served as static JSON:
//
//   /api/provinces/                                → all provinces
//   /api/provinces/{code}/cities-municipalities/   → LGUs of a province
//   /api/cities-municipalities/{code}/barangays/   → barangays of an LGU
//
// WHY AN API, NOT A BUNDLE: the full PH set is ~42,000 barangays
// (multi-MB). Bundling all of it would bloat the client. Fetching
// on-demand keeps each payload tiny (only the selected province's
// cities, only the selected city's barangays). Results are cached
// in-memory for the session so re-selecting never refetches.
//
// The caller is expected to degrade gracefully (fall back to a free-
// text input) if a fetch throws — e.g. the applicant is offline or
// the API is briefly down. See ApplicationPage Store Info step.

const BASE = 'https://psgc.gitlab.io/api';

export interface PsgcItem {
  code: string;
  name: string;
}

// Session cache: key = endpoint path, value = sorted items.
const cache = new Map<string, PsgcItem[]>();

async function fetchList(path: string): Promise<PsgcItem[]> {
  const cached = cache.get(path);
  if (cached) return cached;

  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`PSGC ${path} failed: ${res.status}`);
  }
  const raw = (await res.json()) as Array<{ code: string; name: string }>;
  const items = raw
    .map((r) => ({ code: r.code, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  cache.set(path, items);
  return items;
}

export function fetchProvinces(): Promise<PsgcItem[]> {
  return fetchList('/provinces/');
}

export function fetchCities(provinceCode: string): Promise<PsgcItem[]> {
  return fetchList(`/provinces/${provinceCode}/cities-municipalities/`);
}

export function fetchBarangays(cityCode: string): Promise<PsgcItem[]> {
  return fetchList(`/cities-municipalities/${cityCode}/barangays/`);
}
