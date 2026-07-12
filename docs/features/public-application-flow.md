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
   Review card shows **only the Code** (Type/Distributor/Plant hidden per boss).
1. **Applicant info** — full name, PH mobile regex, email.
2. **Store info** — store name, address, **Province → City/Municipality →
   Barangay** (cascading, from the PSGC API — see below), **+ map pin (required)**.
3. **Store photo** — front-view store photo ONLY. **Gov ID + Proof of Billing
   were removed** (boss: collected later, once the location is approved). A
   green **photo-instructions panel** sits under the upload.
4. **Consent** — data-privacy checkbox.

`validateStep(n)` gates each Next; final submit re-runs `validateStep(4)`.
Removed docs still have NOT NULL columns → `handleSubmit` persists `govIdUrl: ''`
and `proofOfBillingUrl: ''`.

> **Shop Code (Mister Donut store code) — NOT captured here.** Deliberately not on
> the public /apply form. MD supplies the code **after approval**, so it's assigned
> via the admin **"New Franchisee"** form on the Franchisees page
> (`src/pages/entities/FranchiseesPage.tsx` → pick an approved franchisee → enter
> shop code → `updateStore`). Persisted to `Store.shopCode` / `stores.shop_code`
> (migration `009_store_shop_code.sql`). `Application` has NO shop code.

## Location cascade (PSGC API)
Province/City/Barangay come from `src/services/phLocations.ts` (the free,
no-key **PSGC** API — `psgc.gitlab.io/api`), fetched on demand:
`fetchProvinces()` → `fetchCities(provinceCode)` → `fetchBarangays(cityCode)`,
session-cached in a `Map`. Not bundled — the full PH set is ~42k barangays
(multi-MB), so on-demand keeps payloads tiny. `form` tracks both the PSGC
`code` (drives the next fetch) and the display `name` (used in the address /
map / review). Each level **degrades to a free-text `<Input>`** if its fetch
throws (offline / API down / CORS) via the `locFailed` flags, so the form never
hard-blocks. The composed address is
`"<address>, Brgy. <barangay>, <city>, <province>"`.

**Metro Manila / NCR:** Metro Manila is NOT a PSGC province — it is a *region*
(NCR, code `130000000`) made of cities, so the `/provinces/` endpoint omits it.
`fetchProvinces()` injects a synthetic `NCR_PROVINCE` (`Metro Manila (NCR)`,
sorted into the M's) so Metro Manila applicants can pick their location, and
`fetchCities()` routes that one code to `/regions/{code}/cities-municipalities/`
instead of `/provinces/...`. Barangays use the normal city endpoint (NCR cities
are ordinary city-municipality codes). All in `phLocations.ts` — no page change.

## Progressive map zoom (geocoding)
PSGC returns names only (no coordinates), so to make the map **zoom toward the
chosen area** as the applicant selects Province → City → Barangay, each
selection geocodes the name via `src/services/geocode.ts` (`geocodePH`, free
OpenStreetMap **Nominatim**, `countrycodes=ph`, fails soft → null). The result
feeds `mapCenter`/`mapZoom` state → `StorePinPicker`'s `centerOverride` /
`zoomOverride` props (province zoom 10 → city 13 → barangay 16). `geoSeq` (a
ref) discards a stale earlier response when a newer selection is made. This
only moves the **view** — it never places the pin (the applicant still
taps/drags). `StorePinPicker`'s `Recenter` uses primitive lat/lng/zoom deps so
unrelated re-renders don't reset manual panning, and it stops recentering once
a pin exists (`active={!hasPin}`). Text-fallback mode (API down) skips
geocoding.

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

## Anonymous persistence (the /apply-doesn't-save gotcha — fixed)
Applicants are **anonymous** — no login, so the store never hydrates and
`dataSource` stays `'mock'`. Two things had to change so real submissions
actually persist (before this, /apply showed "Submitted!" but saved nothing
for anon users; it only worked when a dev happened to be logged in):
1. **Client:** `submitApplication` in `src/store/useStore.ts` **always**
   attempts the DB insert now — it does NOT gate on `dataSource === 'db'`
   like every other mutation, because its only caller is this public form.
2. **RLS:** `supabase/migrations/006_public_apply_insert.sql` grants anon
   INSERT on `applications` + policy `apps_insert_public`
   (`WITH CHECK (status = 'pending')`). Anon can create a pending application
   and nothing else (no select/update/delete).

Storage uploads already work anonymously (permissive INSERT dev policy +
`stor_read_anon` for the `gov-id/`+`proof-of-billing/` prefixes).
**Rollout order matters:** run migration 006 BEFORE deploying the client
change, else anon submits fail loudly (RLS block) until the policy exists.

## Gotchas
- The Step 4 review summary shows `form.lat, form.lng` (now always present since
  the pin is required — the old "Not provided" branch is effectively dead).
- Anon uploads rely on the storage RLS carve-out for `gov-id/` +
  `proof-of-billing/` prefixes (Phase 3b, `004_storage_rls.sql`).

## Related
CLAUDE.md "Pending product decisions" (#2, map pin) + "Gotchas" (approval) ·
[[ending-inventory-review]] · memory `pending-product-decisions`
