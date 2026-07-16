# Franchisee Activation (Login Credentials & First-Time Account Activation)

Approving a `/apply` application now mints the franchisee's **login**. That
login starts **locked**: the franchisee can sign in, but reaches nothing except
a verification screen until staff have verified their documents.

Boss spec: *"Login Credentials & First-Time Account Activation"*. Phases A–G.

Related: [[public-application-flow]] (where the application comes from),
[[application-monitoring]] (the Shop Code is set there, and shares the same
Application Details page), [[account-creation]] (the same temp-password idea,
for PD/SPD/AS instead of franchisees), [[partner-onboarding]] (the `/onboarding`
path, which is **exempt** — see Gotchas).

## Entry points

| Where | Who | What |
|---|---|---|
| Application Details → **Approve** | PD / OS / Admin | Mints the login, reveals the temp password **once** |
| `/login` | franchisee | Types their **Shop Code**, not an email |
| Account Verification screen (replaces the whole app) | franchisee | Uploads Gov ID + Proof of Billing + Selfie, accepts Data Privacy, may change their password |
| Application Details → **Login Credentials** card | PD / SPD / AS / OS / Admin | Username, password state, account status, privacy acceptance, last sign-in, **Reset Password** |
| Application Details → **Documents** | PD / SPD / AS / OS / Admin | Verify / reject each document; the last verify **activates** the account |
| TopBar → user menu → **Change Password** | everyone | Sets their own password |

## Files

**Pure libs (no React, no store):**
- `src/lib/shopCodeAuth.ts` — Shop Code ⇄ synthetic email (`resolveLoginEmail`,
  `shopCodeToEmail`, `isShopLoginEmail`, `SHOP_LOGIN_DOMAIN`)
- `src/lib/accountGate.ts` — `isAccountLocked`
- `src/lib/documentVerification.ts` — `documentStatus`, `allDocumentsVerified`,
  `unverifiedDocuments`, `canVerifyDocuments`, labels
- `src/lib/loginCredentials.ts` — `passwordState`, `canViewLoginCredentials`,
  `canResetPassword`, labels

**UI:**
- `src/App.tsx` — the gate: short-circuits the ENTIRE router
- `src/pages/auth/LoginPage.tsx` — "Email or Shop Code" (`type="text"`)
- `src/pages/auth/AccountVerificationPage.tsx` — the locked screen
- `src/pages/applications/LoginCredentialsCard.tsx` — Phase E + the Reset button
- `src/pages/applications/DocumentsSection.tsx` — 4 tiles + verify/reject
- `src/components/auth/ChangePasswordModal.tsx` — used by the verification
  screen AND the TopBar

**Store (`src/store/useStore.ts`):** `reviewApplication` (returns
`GeneratedLogin | null`), `submitAccountVerification`, `reviewDocument`,
`resetFranchiseePassword`, `changeOwnPassword`, `recordLogin`.

**Server:** `supabase/functions/reset-password/index.ts` — the project's ONLY
Edge Function.

**Migrations:** `024` (account_status / password_changed_at / account_user_id),
`025` (self-verification policies + column-clamp triggers), `026`
(document_reviews + activation policy), `027` (last_login_at + the
auth-uuid RPC), `028` (`append_application_audit` RPC).

## Data flow

```
Approve (Shop Code required)
  └─ signUpIsolated(<shopcode>@shop.zappdonuts.ph, temp)   ← auth layer
     users row { id, email: synthetic, account_status: 'not_activated' }
     applications.account_user_id = that users.id           ← the link
     → GeneratedLogin revealed ONCE

Franchisee types Shop Code
  └─ resolveLoginEmail → signInWithPassword
     recordLogin(): users.last_login_at + one `first_login` audit entry
     isAccountLocked(user) → AccountVerificationPage (router replaced)

Uploads + Data Privacy
  └─ submitAccountVerification → applications.{gov_id_url, proof_of_billing_url,
     selfie_url, accepted_privacy_at, audit_log}
     users.account_status = 'pending_verification'   (still locked)

Staff verify each document
  └─ reviewDocument → applications.document_reviews[key]
     allDocumentsVerified() → users.account_status = 'active'  ← access granted
```

## Scope / RLS

| Action | Client gate | Server |
|---|---|---|
| Approve (mint login) | `canSetStatus` (PD/OS/Admin) + Shop Code present | 018 (PD may insert franchisee users) |
| Franchisee self-verify | own account only | 025 `apps_update_own_account` + `users_update_self`, **clamped by triggers** |
| Verify / reject a document | `canVerifyDocuments` | 003/022 application UPDATE policies |
| Activate (`account_status`) | implied by the last verify | 026 `users_update_account_status` (row) + 025 trigger (column) |
| Reset password | `canResetPassword` | the Edge Function re-checks with service_role |
| Change own password | signed-in | Supabase Auth session |
| Stamp `last_login_at` | — | 025 `users_update_self` + 027's widened clamp |

**The load-bearing security idea:** Postgres RLS is **ROW**-level, not
column-level. Granting a franchisee UPDATE on their own `users` row would let
them set `role='owner'`. So 025 pairs each narrow policy with a trigger that
compares `to_jsonb(NEW) - <allowed cols>` against `to_jsonb(OLD) - <allowed
cols>`. That is **fail-closed**: a column added by a future migration is
protected automatically, with no edit to this file. The same trick is what makes
026 safe — the policy opens the ROW to a PD, the trigger keeps the blast radius
to `account_status`.

## Gotchas

- **⚠️ The Edge Function must be deployed separately.** `supabase functions
  deploy reset-password`. Until then, Reset Password shows "Hindi maabot ang
  reset-password service" — everything else works.
- **⚠️ `NOTIFY pgrst, 'reload schema';` after any migration that adds a column.**
  PostgREST caches the schema and returns `PGRST204` otherwise (this bit us on
  024). 027 ends with it.
- **⚠️ Requires Supabase "Confirm email" = OFF.** `<shopcode>@shop.zappdonuts.ph`
  receives no mail; a confirmation step would make every generated login dead.
- **`account_status` is nullable with NO default, and `undefined` means
  UNLOCKED.** Every staff account and every pre-024 franchisee has none.
  Defaulting undefined to "locked" would have locked out the entire existing
  user base on deploy. No backfill needed.
- **The gate replaces the router, not a route.** A per-route guard leaves every
  unguarded and future path reachable by URL.
- **The login input cannot be `type="email"`** — the browser rejects a Shop Code
  before any of our code runs.
- **The temp password is revealed exactly once and is never stored.** Supabase
  bcrypts it. Storing it so the Login Credentials card could re-display it would
  mean plaintext — exactly what "securely encrypted" forbids. Lost password →
  Reset, never lookup. `password_changed_at` (null = still temp) is the only
  trace.
- **`/onboarding` applicants are EXEMPT** — they already have their own login
  (own email, own password) and already uploaded ID/proof/selfie in the wizard.
  Minting a second account would orphan the first. ⬜ **Still needs a boss
  decision.**
- **Only `first_login` / `password_changed` / `password_reset` reach the audit
  log.** Every sign-in would grow an unbounded JSONB column that is rewritten
  whole on each write, and staff have no application to write to. The recurring
  fact lives in `users.last_login_at` instead. A real login HISTORY (every
  session + IP) needs its own append-only table — out of scope.
- **`recordLogin` runs after hydration, not at sign-in** — the franchisee's own
  application is only in the slice once `hydrateFromDB` lands. It is deliberately
  NOT in `restoreSession`: a page refresh is not a new sign-in.
- **The reset/change-password store actions never roll back.** Once Auth has
  changed the password, undoing our bookkeeping would only make the two layers
  disagree — and would have staff hide a password that actually works. Failures
  after that point are logged, not thrown.
- **⚠️ Audit entries MUST be appended via `appendApplicationAudit` (028), never
  by re-sending the row.** Sending the whole `audit_log` array silently deletes
  entries whenever the caller's slice is stale — and it goes stale routinely,
  because `App.tsx` re-runs `restoreSession()` → `hydrateFromDB()` on every
  `SIGNED_IN` and `TOKEN_REFRESHED`, so a hydration that started earlier can
  land later and roll the slice back. This was caught live in E2E by 025's
  append-only trigger. The RPC does `audit_log || entry` in one statement
  against the current row, so staleness cannot cost an entry.
  **⬜ FOLLOW-UP:** `reviewDocument` and `submitAccountVerification` still send
  the whole row. Staff are exempt from the append-only trigger, so a stale staff
  slice can still drop entries with no error at all — the same bug without the
  seatbelt. Move both onto the RPC.
