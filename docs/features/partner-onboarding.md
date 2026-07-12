# Feature: Partner Onboarding (self-service) — Phase 1

**Status:** Phase 1 live (happy path). Phases 2–5 pending.
**Design:** `docs/superpowers/specs/2026-07-12-partner-onboarding-workflow-design.md`

## What it is
A NEW, standalone applicant flow (route **`/onboarding`**) where a partner
applicant creates their own login and submits onboarding requirements. Separate
from the legacy public `/apply` and the internal `/franchisees/new` (both
untouched).

## Flow (Boss's 9-step workflow; Step 5 removed)
5 wizard steps in `src/pages/public/PartnerOnboardingPage.tsx`:
1. **Create Account** — channel/referral code + name parts (First/Middle/Last/
   Suffix) + Mobile + Email + Password → **isolated `signUpIsolated`** creates a
   real Supabase auth login (no session; email-taken caught here).
2. **Business Info** — Store Name, Business + Residential Address, Facebook Link,
   Operating Hours, **map pin** (StorePinPicker).
3. **Documents** — Gov ID, Proof of Billing, **Live Selfie** (camera), Store Photo.
4. **Review Legal** — view Consignment / Privacy / Terms (`LegalDocModal`, reused).
5. **Confirm & Submit** — **4 checkboxes** (Agreement, Privacy, Terms,
   Certification); Submit enabled only when all checked. Uploads to storage +
   `submitApplication` insert with an **Application Number** (`ZAPP-YYYYMMDD-####`).

## Awaiting-verification screen
The applicant has an auth login but NO `users` profile until Admin activates them
(Phase 4). To avoid a login dead-end:
- `apps_select_own` RLS (migration 013) lets a signed-in applicant read their OWN
  application by JWT email.
- `login` / `restoreSession` (useStore): when no profile is found, they look up a
  pending application by email → set `pendingApplication` instead of signing out.
- `App.tsx`: when `pendingApplication` is set, render
  `AwaitingVerificationPage` (src/pages/public/) instead of the ERP.

## Persistence / RLS
- Applicant is **anonymous** during the wizard (isolated signUp = no session), so
  the application insert runs under anon → the existing `apps_insert_public`
  policy (migration 006, `WITH CHECK status='pending'`) covers it. Storage uploads
  use the permissive dev write policies.
- **Migration 013** adds the new `applications` columns + `apps_select_own`.
  **Run it before deploying** (else the insert fails on unknown columns).
- Channel-code resolution is **best-effort** against the (mock, for anon)
  referral slice; authoritative PD/SPD resolution happens at Admin verification
  (Phase 4). Unresolved → `referralType='zapp_internal'`, `assignedPlantId='plant-01'`.

## Data model (additive, migration 013)
`Application` += firstName/middleName/lastName/suffix, residentialAddress,
facebookLink, operatingHours, selfieUrl, acceptedConsignmentAt/PrivacyAt/TermsAt,
certifiedAt, agreementVersion, applicationNumber. All optional — legacy `/apply`
and internal onboarding rows stay valid. `mapApplicationToDB` maps them.

## Phase 4 — Admin Verification (live)
`ApplicationDetailPage` shows an **Onboarding Details** card (app number,
residential address, FB link, operating hours, accepted-agreements checklist)
for onboarding applications (`isOnboarding = !!applicationNumber`) and three
actions: **Verify & Activate** / **Request Info** / **Reject**.
- **Verify & Activate** (`reviewApplication` action `'approved'`): creates the
  Store AND — for onboarding apps — the franchisee **`users` profile**
  (role from the channel: distributor/SPD → `franchisee_distributor`, else
  `franchisee_direct`; `assignedStoreIds=[store.id]`). The applicant already has
  an auth login (Step 1), so their next login now resolves to full franchisee
  access instead of the awaiting screen. Order: app UPDATE → store INSERT → user
  INSERT, with best-effort compensating rollback.
- **Request Info** (`'needs_more_info'`): sets the status + note; applicant sees
  the note on the awaiting screen. **Needs migration `014`** (widens the
  applications status CHECK).
- **Reject** (`'declined'`): unchanged.
Legacy `/apply` applications (no `applicationNumber`) keep plain Approve/Decline
and get a store only — no user profile.

## Phase 5 — Security Deposit (live)
A newly-activated onboarding partner has a **`pending`** store until the ₱2,000
security deposit is paid. `FranchiseeDashboard` shows a **Security Deposit
Required** banner (gated on `store.status === 'pending'` AND no verified
`security_deposit` payment) with a **Pay ₱2,000 (Gateway)** button.
`paySecurityDeposit(storeId)` (useStore) records a **verified** `security_deposit`
Payment (simulated gateway, auto-confirmed), flips the store to **`active`**, and
notifies. `Payment.type` (`'billing' | 'security_deposit'`, default billing) +
migration `015` add the column; the deposit's synthetic `billingId` keeps it out
of `billingComputations`.

## Not yet built (later phases)
- Submission metadata (IP/device/GPS), PDF copy of the application — Phase 2.
- ID OCR autofill (Tesseract, best-effort) — Phase 3.

## Related
[[franchisee-onboarding]] · [[public-application-flow]] · [[account-creation]] ·
`src/data/legalContent.ts` + `src/components/legal/*`.
