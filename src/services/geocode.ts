// ============================================================
// ZAPP Donuts ERP — Free geocoding (OpenStreetMap Nominatim)
// ============================================================
//
// Used ONLY to progressively re-center + zoom the /apply store map as
// the applicant picks Province → City/Municipality → Barangay. It does
// NOT place the pin (the applicant still taps/drags) — it just moves
// the map view closer to the chosen area so finding the exact spot is
// easier.
//
// Nominatim is free + no-key. We keep it light: countrycodes=ph,
// limit=1, and it fails SOFT (returns null) so a miss / offline / rate
// limit never blocks the form — the map simply stays where it is.
// (Browsers can't set a User-Agent header; Nominatim accepts the
// automatic Referer for low-volume browser use like this.)

export interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodePH(query: string): Promise<GeoResult | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search' +
      `?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
