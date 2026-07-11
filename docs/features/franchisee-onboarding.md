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
2. **Store** — name, address, province/city/barangay (free text — internal staff
   know the location), + required **map pin** (`StorePinPicker`).
3. **Details** — shop code, delivery schedule (odd/even buttons), opening date.
4. **Documents** — store photo (→ `zapp-public`), valid ID + proof of billing
   (→ `zapp-private`); all camera-enabled.
5. **Contract** — recap + **placeholder** Terms & Conditions + accept checkbox →
   `termsAcceptedAt`. **Swap `TERMS_PLACEHOLDER` with the real contract when boss
   sends it** (Block 5).

Submit uploads the files, then calls `submitApplication({...})` with the new
fields. It flows into the existing Application → review → approve pipeline.

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

## Related
- Go-live reset: `scripts/reset-operational.ts` (`npm run db:reset`) clears
  operational + demo stores, KEEPS logins/org/catalog/codes.
- Account provisioning (real PD logins) is still NOT built — see CLAUDE.md
  "Deferred feature — Franchisee account provisioning".
- [[public-application-flow]] · [[billing-and-delivery-recompute]]
