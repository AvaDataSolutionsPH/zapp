# Feature: Public Franchise Application (`/apply`)

**Status:** live
**Owner roles:** public (unauthenticated applicants); reviewed later by
area_manager / operations_manager / owner via [[ending-inventory-review]]-adjacent
Applications queue.

## Entry points
- Route: `/apply` (+ `?ref=<code>` prefills the referral code).
- Page: `src/pages/public/ApplicationPage.tsx` — a multi-step wizard.
- Map pin component: `src/pages/public/StorePinPicker.tsx`.

## Wizard steps (`renderStep` + `validateStep` switch, 0-indexed)
0. **Referral code** — must resolve via `referralService` (`referralInfo`).
1. **Applicant info** — full name, PH mobile regex, email.
2. **Store info** — store name, address, province, city, **+ map pin (required)**.
3. **Documents** — store photo, gov ID, proof of billing (all required, uploaded
   to Supabase Storage on submit).
4. **Consent** — data-privacy checkbox.

`validateStep(n)` gates each Next; final submit re-runs `validateStep(4)`.

## Map pin (Grab-style, `StorePinPicker`)
Replaced the old optional Latitude/Longitude **text inputs + placeholder box**
with an interactive Leaflet map. Applicants **tap to drop / drag to adjust** a
single marker on the EXACT store location.

- **Required** — `validateStep` case 2 sets `errors.lat` if `form.lat`/`form.lng`
  are empty; can't advance past Store Info without a pin.
- **⚠️ Warning copy (must stay):** "I-pin ang EKSAKTONG lokasyon ng iyong
  TINDAHAN — hindi ang inyong bahay." This is the whole point — applicants were
  confused by raw lat/lng and would otherwise pin their house.
- **No external API** — tap/drag only. No geolocation, no geocoding/search
  (deliberate: honors the no-API / cost + privacy stance, and avoids
  auto-centering on the applicant's house). OSM tiles only.
- **Centering:** `PROVINCE_CENTROIDS[province]` → else `DEFAULT_CENTER`
  (Legazpi, Albay — Bicol-first business). `Recenter` (uses `useMap().setView`)
  follows province changes **only until a pin is dropped**, then leaves the pin
  alone. `MapContainer center/zoom` props are mount-only in react-leaflet v5, so
  the `Recenter` child is what handles later updates.
- **Data contract:** `form.lat` / `form.lng` stay **strings** (fixed 6 decimals);
  `onChange(lat,lng)` writes both. Submit still does `parseFloat(form.lat) || 0`
  in `handleSubmit`, so nothing downstream changed.

## Leaflet setup (shared gotcha)
- CSS is loaded **globally** in `index.html` (`unpkg .../leaflet.css`) — not
  imported per-file.
- Default marker icon is fixed the same way as `GeoHeatmapPage`: delete
  `L.Icon.Default.prototype._getIconUrl` and `mergeOptions` the CDN icon URLs,
  else markers render broken under the bundler.
- Leaflet containers need an explicit height — `StorePinPicker` sets
  `style={{ height: '18rem' }}`.

## Data flow
Fill wizard → `handleSubmit` uploads store photo (`zapp-public`) + gov ID /
proof-of-billing (`zapp-private`) → builds the application object (lat/lng
parsed to numbers) → `submitApplication` (async, optimistic + rollback). On
approval, `reviewApplication` creates the `Store` row (see CLAUDE.md gotchas:
area-supervisor fallback, compensating rollback).

## Gotchas
- The Step 4 review summary shows `form.lat, form.lng` (now always present since
  the pin is required — the old "Not provided" branch is effectively dead).
- Anon uploads rely on the storage RLS carve-out for `gov-id/` +
  `proof-of-billing/` prefixes (Phase 3b, `004_storage_rls.sql`).

## Related
CLAUDE.md "Pending product decisions" (#2, map pin) + "Gotchas" (approval) ·
[[ending-inventory-review]] · memory `pending-product-decisions`
