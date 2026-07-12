# Design: ZAPP Donuts Partner Onboarding Workflow (self-service)

**Date:** 2026-07-12
**Status:** DRAFT — awaiting user approval before implementation
**Source:** Boss-provided 9-step "Partner Onboarding Workflow" + chat clarifications.

## 1. Goal

A **new, self-service** partner onboarding flow where an applicant creates their
own login, submits business info + documents + legal confirmations, and the
system records a tamper-evidence trail. Admin verifies, applicant pays a ₱2,000
security deposit via the gateway, and the partner becomes **Active**.

## 2. Decisions locked with the user (2026-07-12)

1. **Separate flow.** New route (`/onboarding`), a NEW page. The existing public
   `/apply` and internal `/franchisees/new` stay untouched (legacy). No changes
   to their behaviour.
2. **PD/SPD linking via channel code.** The applicant enters a referral/channel
   code (same resolver as onboarding today: PD / SPD / direct) so the record is
   scoped to the correct distributor.
3. **Security deposit via the (simulated) gateway** — recorded through the
   payment layer as a new `security_deposit` payment type.
4. **Design doc first** (this document), then phased implementation.

## 3. Key interpretations / assumptions (confirm if wrong)

- **"Approved applicant" (Step 1)** = someone who holds a valid channel code and
  proceeds to self-register. The *formal* approval is Admin Verification (Step 8).
  There is no separate pre-approval gate before account creation.
- **Live Selfie** = capture a selfie photo via the device camera as a deterrent
  ("para matakot"). NO real liveness detection or face-match — just a stored photo.
- **ID OCR autofill** = best-effort assist using local Tesseract. PH IDs vary in
  layout, so extracted fields are **prefilled but fully editable**; never blocking.
- **Store Location + Store Photo** are KEPT (Step 8 admin verifies "Store Photos"
  and "Store Location"), even though Boss's Step 2/3 list doesn't restate them.
  Store Location = the existing Grab-style map pin. *(Flag for boss if wrong.)*
- **Account = real login.** Step 1 creates a Supabase Auth user + `users` profile
  (Option A: client `signUp`), realising the long-deferred franchisee provisioning.
  The applicant is signed in for the rest of the flow, so uploads + the application
  persist under their own user id (no anonymous-persistence problem).

## 4. Architecture overview

- **Route:** `/onboarding` → new `PartnerOnboardingPage` (public, but transitions
  to an authenticated session after Step 1). Rendered under `PublicLayout`.
- **Account model:** a partner login created in a **pending** state. The linked
  `Store` is only created/activated at Admin Verification (Step 8) + Active after
  the deposit (Step 9). Until then the applicant can log in and see a
  "pending verification" status screen.
- **Reuse:** `LegalDocModal` + the channel-code resolver + `uploadFile`/storage +
  camera `FileUpload` + the simulated payment gateway + `createPartnerAccount`
  patterns (throwaway-client signUp, RLS-scoped inserts).
- **Regression-safe:** all new type fields are optional; new Payment type is an
  additive union member; `reviewApplication` is extended, not rewritten.

## 5. Data model changes (all additive)

### `Application` (src/types + migration)
- `residentialAddress?`, `facebookLink?`, `operatingHours?`
- `selfieUrl?` (storage ref, zapp-private)
- Name parts: `firstName?`, `middleName?`, `lastName?`, `suffix?`
- Submission metadata: `submittedIp?`, `userAgent?`, `deviceInfo?`, `gpsLat?`,
  `gpsLng?`, `agreementVersion?`, `applicationNumber?`, `pdfUrl?`
- Acceptance record: `acceptedConsignmentAt?`, `acceptedPrivacyAt?`,
  `acceptedTermsAt?`, `certifiedAt?`
- Verification: extend `status` union with `under_review`, `needs_more_info`
  (keep existing `pending`/`approved`/`declined` for back-compat).

### `users` (migration)
- Optional `first_name`, `middle_name`, `last_name`, `suffix` (compose `name`).
- An `onboarding_status?` ('pending' | 'verified' | 'active') OR reuse a store link
  — decided in Phase 4.

### `Payment` (src/types + migration)
- `type?: 'billing' | 'security_deposit'` (default 'billing'; existing rows read as
  billing). For deposits `billingId` is not required.
- Deposit rows flow through the SAME submitted → (collected) → verified states; a
  deposit skips collection (no PD) and is verified by admin/billing.

### `agreementVersion`
- A module constant (e.g. `LEGAL_VERSION = '2026-07'`) stamped on each acceptance.

## 6. The 9 steps → implementation

| Step | UI / behaviour | Notes |
|---|---|---|
| **1 Create Account** | Channel code → resolve PD/SPD/direct. Name (First/Middle/Last/Suffix), Mobile, Email, Password → `signUp` + sign in + insert `users` (pending). | Confirm-email OFF (already). |
| **2 Business Info** | Store Name, Business Address, Residential Address, Facebook Link, Operating Hours, **map pin** (Store Location). | Map pin kept. |
| **3 Documents** | Gov ID, Proof of Billing, **Live Selfie** (camera), + Store Photo. | Selfie = camera capture. |
| **4 Review Legal** | View Consignment / Privacy / Terms (LegalDocModal, reused). | Read-only. |
| **6 Confirmations** | **4 checkboxes** (Agreement, Privacy, Terms, Certification). Submit disabled until all checked. | Extends the current single-checkbox idea. |
| **7 Submit** | Insert Application (scoped to user + PD). Capture metadata. Generate Application Number + PDF. Success screen. | Metadata/PDF = Phase 2. |
| **8 Admin Verify** | Admin detail view: all info + docs + accepted agreements. Actions: Verify & Activate / Request Info / Reject. | Extends `reviewApplication`. |
| **9 Security Deposit** | Post-verify: applicant pays ₱2,000 via gateway → verified → notification → status **Active**. | New payment type. |

## 7. Phased delivery plan

**Phase 1 — Onboarding wizard (Steps 1–4, 6–7 UI + persistence)**
New route + `PartnerOnboardingPage`; channel code + account creation (real login);
business-info + documents (incl. selfie) + review + 4 confirmations + submit
(basic application insert, scoped to the new user + PD). Uploads persist. Ships the
end-to-end happy path WITHOUT metadata/PDF/OCR.

**Phase 2 — Submission metadata + Application Number + PDF**
Capture userAgent/device/GPS/agreement-version/e-acceptance timestamps; generate a
human-readable Application Number; generate a PDF summary (jsPDF, dynamically
imported like exceljs) stored to zapp-private. **IP address** needs an external
service (e.g. ipify) or an Edge Function — flagged; include only if approved.

**Phase 3 — ID OCR autofill (best-effort)**
On Gov ID upload, run Tesseract, parse name/address, prefill the editable fields.
Assistive only; never blocks submission.

**Phase 4 — Admin Verification (Step 8)**
Extend the application review UI + `reviewApplication`: Verify & Activate (create/
activate Store + activate login), Request Additional Info (new status), Reject.
Show accepted agreements + all docs for review.

**Phase 5 — Security Deposit (Step 9)**
After verification, surface a ₱2,000 deposit payment via the gateway; record as a
`security_deposit` Payment; on verified → notification + Store/partner Active.

## 8. Open questions for boss (do not block Phase 1)

1. **Store Photo + Map Pin** — confirm we keep both (implied by Step 8). ✅ assumed yes.
2. **IP address capture** — OK to use an external service (ipify) client-side, or
   defer until an Edge Function exists? (SPA cannot read its own IP unaided.)
3. **PDF copy** — is a client-generated PDF summary acceptable (vs a server-rendered
   official document)?
4. **Pending-account visibility** — after Create Account but before activation, what
   should the applicant see on login? (Proposed: a read-only "Awaiting verification"
   status screen.)
5. **Agreement version** — any versioning scheme boss wants, or is a date tag fine?

## 9. Out of scope (explicitly)

- Real biometric liveness / face-match on the selfie.
- Changes to the existing `/apply` and `/franchisees/new` flows.
- Server-side (Edge Function) submission hardening — remains a future track.

## 10. Related

- `docs/features/franchisee-onboarding.md`, `docs/features/account-creation.md`,
  `docs/features/public-application-flow.md`, `docs/features/payment-flow.md`
- `src/data/legalContent.ts`, `src/components/legal/*` (built 2026-07-12)
- CLAUDE.md "Deferred feature — Franchisee account provisioning" (now realised here)
