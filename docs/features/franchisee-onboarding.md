# Feature: Internal Franchisee Onboarding (New Franchisee form)

**Status:** live
**Owner roles:** owner, operations_manager, partner_distributor (encoders);
approved by owner/ops via the Applications review queue.

## Entry points
- Route: `/franchisees/new` (login-gated, inside the dashboard Layout — NOT on the
  public landing, per boss "hindi visible sa landing page").
- Page: `src/pages/entities/FranchiseeOnboardingPage.tsx` — a 6-step wizard.
- Button: "New Franchisee" on the Franchisees page (`FranchiseesPage.tsx`,
  `canOnboardApplication` = owner/ops/PD). The older shop-code modal on the same
  page was relabeled **"Assign Shop Code"** (owner/ops) for editing an existing
  store's code — the two are separate tools.

## Why this exists (vs the public `/apply`)
The public `/apply` is an anonymous, marketing-facing lead form. This one is the
**internal onboarding packet** a PD/staff fills for a real, vetted franchisee. It
captures what `/apply` deliberately omits: **shop code (from the PD), delivery
schedule (odd/even), opening date, valid ID + proof of billing, and Terms &
Conditions**. Both flows coexist.

## Wizard steps (`renderStep` / `validateStep`, 0-indexed)
0. **Channel** — a channel/referral code resolved against the **LIVE store
   slices** (`referralCodes` / `distributors` / `subPartnerDistributors` /
   `plants`), NOT the mock `referralService` the public form uses. This is what
   lets the system tell **PD vs SPD vs direct** and works with REAL data after a
   reset. `resolveChannel` branches on `referral.type`.
1. **Applicant** — full name, PH mobile, email.
2. **Store** — name, address, **PSGC Province → City/Municipality → Barangay
   cascade** (`LocationCascadeFields`), + required **map pin** (`StorePinPicker`).
   The cascade also geocodes the chosen area and hands the map a
   `centerOverride`/`zoomOverride` so it follows the address — see
   "Map pin: the location cascade" below.
3. **Details** — shop code, delivery schedule (odd/even buttons), opening date.
4. **Documents** — store photo (→ `zapp-public`), valid ID + proof of billing
   (→ `zapp-private`); all camera-enabled.
5. **Contract** — recap + **placeholder** Terms & Conditions + accept checkbox →
   `termsAcceptedAt`. **Swap `TERMS_PLACEHOLDER` with the real contract when boss
   sends it** (Block 5).

Submit uploads the files, then calls `submitApplication({...})` with the new
fields. It flows into the existing Application → review → approve pipeline.

## Map pin: the location cascade (added after a live bug report)
The Store step originally had **three free-text inputs** for province/city/
barangay and passed nothing but `province` to `StorePinPicker`. That picker can
only self-center from a **12-entry hardcoded `PROVINCE_CENTROIDS` table matched
EXACTLY by name**, so:

- any province outside that table (e.g. **"Camarines Norte"**, which is not in
  it) fell through to the Legazpi default, and
- a non-empty province *still* bumped the zoom to 13, so the map sat at **street
  level on the wrong province**.

Reproduced on production: with `Camarines Norte` / `Daet` typed, the map was at
`13.15, 123.75` @ z13 — ~120 km from Daet. Since the pin is **required**
(`validateStep` case 2), the encoder simply could not finish the step. The boss
reported this as "hindi gumagana ang map"; it worked on `/apply` because that
form has always had the real cascade.

**Fix:** `src/components/forms/LocationCascadeFields.tsx` — the PSGC cascade +
Nominatim geocoding, extracted so internal forms get what `/apply` has. It
reports resolved NAMES upward (each form keeps its own state shape) and a map
target via `onMapTarget(center, zoom)`, which this page stores in
`mapCenter`/`mapZoom` and passes as `centerOverride`/`zoomOverride`. Zoom follows
the cascade: province 10 → city 13 → barangay 16. Each level degrades to a
free-text `Input` if its fetch fails, so a PSGC/Nominatim outage can't hard-block
the form. Verified: `Camarines Norte` → `14.26, 122.70` @ z10, then `Daet` →
`14.09, 122.96` @ z13.

⬜ `/apply` still has its own inline copy of this logic — deliberately NOT
refactored (the public form is the highest-risk path to touch). Two
implementations of the same cascade is how the province "(NCR)" mismatch bug
happened; migrating `ApplicationPage` onto this component is worthwhile follow-up.

## Data flow into the Store (approval)
`reviewApplication` (`src/store/useStore.ts`) copies the onboarding fields onto the
new `Store`: `shopCode`, `deliverySchedule`, `openingDate`,
`subPartnerDistributorId`. **franchiseType**: `distributor` for both `distributor`
AND `sub_partner_distributor` channels (they sit under a PD); only `zapp_internal`
is `direct`.

## Channel model (SPD added)
`ReferralType` gained `'sub_partner_distributor'`. `ReferralCode` gained
`subPartnerDistributorId`; `SubPartnerDistributor` gained `referralCode`;
`Application` gained `assignedSubPartnerDistributorId`. Seed: `spd-01` →
`referralCode 'SPD-MARIEL'`, plus referral code `ref-21` (type
`sub_partner_distributor`). Migration **`010_franchisee_onboarding.sql`** adds the
columns and widens the `referral_type` / `type` CHECK constraints. Read side is
generic snake→camel (`db.ts`), so no read-mapper changes were needed; write side
(`dbWrite.ts`) + seed (`seed-from-mock.ts`) got the new columns.

## Files
| File | Role |
|---|---|
| `src/pages/entities/FranchiseeOnboardingPage.tsx` | the wizard |
| `src/components/forms/LocationCascadeFields.tsx` | PSGC cascade + geocoded map target (shared) |
| `src/pages/public/StorePinPicker.tsx` | the map pin (shared with `/apply`, `/onboarding`) |
| `src/lib/leafletIcon.ts` | bundled Leaflet marker images (no CDN) |
| `src/pages/entities/FranchiseesPage.tsx` | entry button + Assign-Shop-Code modal |
| `src/store/useStore.ts` → `reviewApplication` | copies onboarding fields to Store |
| `src/types/index.ts` | ReferralType/DeliverySchedule + new Application/Store/ReferralCode/SPD fields |
| `src/services/dbWrite.ts`, `scripts/seed-from-mock.ts` | write/seed mappers |
| `supabase/migrations/010_franchisee_onboarding.sql` | columns + widened CHECKs |
| `src/pages/applications/ApplicationDetailPage.tsx` | shows the SPD referral-type label |

## Gotchas
- **Migration 010 must be run before this code writes** — `dbWrite`/seed reference
  the new columns; an un-migrated DB would 400 on store edits + seed.
- The channel code resolves against **hydrated DB data** — a code only works if it
  exists in `referral_codes` for the logged-in session's scope. After a fresh
  `db:seed`, `SPD-MARIEL` / `BICOL-MARCO` / `ZAPP-INT-001` all resolve.
- Verified end-to-end (Playwright): SPD channel → submit → approve → Store carries
  `shop_code=MD-TEST-001`, `delivery_schedule=odd`, `franchise_type=distributor`,
  `sub_partner_distributor_id=spd-01`.
- **Province/city are now resolved PSGC names, not typed text.** That is also a
  data-quality fix: free text never matched the Area Supervisor province master
  list (same class of bug as migration 029). The cascade writes the canonical
  name, so AS routing can actually match.
- The province field the picker still receives is only a **fallback** centroid
  lookup for when geocoding fails — the cascade's `centerOverride` wins.

## Related
- Go-live reset: `scripts/reset-operational.ts` (`npm run db:reset`) clears
  operational + demo stores, KEEPS logins/org/catalog/codes.
- Account provisioning (real PD logins) is still NOT built — see CLAUDE.md
  "Deferred feature — Franchisee account provisioning".
- [[public-application-flow]] · [[billing-and-delivery-recompute]]
