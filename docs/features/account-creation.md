# Feature: Account Creation (login for PD / SPD / Area Supervisor)

**Status:** live
**Owner roles:** owner, operations_manager (create any: PD / SPD / AS);
partner_distributor (**Franchisee** or **Sub-Partner** within its own scope).

## Entry points
- Sidebar: **New Account** (owner / ops / PD) → route `/accounts/new`.
- Page: `src/pages/entities/NewAccountPage.tsx`.

## PD dropdown = Franchisee + Sub-Partner (not Area Supervisor)
A PD onboards its own **Franchisees** and **Sub-Partners**; Area Supervisors are
created by HQ, so the PD's Account-Type dropdown offers only those two (owner/ops
still get PD / SPD / AS, unchanged). **Franchisee** is a dropdown-only shortcut
(`type DropdownRole = NewAccountRole | 'franchisee'`) — it is NOT a
`createPartnerAccount` role. Because a franchisee needs a **Store** (shop code,
map pin, valid ID) that this simple login form does not create, picking
"Franchisee" shows an info panel + **Continue to Franchisee Onboarding** button
that routes to `/franchisees/new` (the full [[franchisee-onboarding]] wizard,
which pre-resolves the PD's own channel). Sub-Partner keeps the inline
create-login form below.

## What it does
Creates a **login + entity record (+ referral code) in one step** for a Partner
Distributor, Sub-Partner Distributor, or Area Supervisor, and reveals a
**temporary password** for the admin to relay (no email — "Option A"). The new
person logs in with the temp password and changes it. This matches the
Bicol-PD-first rollout: the PD onboards its own downline before ZAPP absorbs
everything centrally.

## Flow (`createPartnerAccount` in `src/store/useStore.ts`)
1. Permission check — owner/ops any; PD may create only SPD/AS (never another PD).
2. `signUpIsolated(email, tempPassword)` (`src/lib/authSignup.ts`) creates the auth
   login on a **throwaway Supabase client** (`persistSession:false`) so the admin's
   session is NOT clobbered. A random temp password is generated.
3. Insert **entity → referral code → users profile** in that order (order matters:
   the PD `users` RLS policy subqueries the freshly-inserted SPD row).
4. Optimistic in-memory update; return `{ email, tempPassword }` → the page reveals
   it with a **Copy Credentials** button.

For a PD, plant + parent-distributor are taken from the PD's own scope (not shown
in the form). owner/ops pick plant (+ parent PD for an SPD).

## Login resolves DB-created accounts (bug fixed)
`login` / `restoreSession` used to resolve the profile ONLY from the in-memory
`demoUsers` seed via `findProfileByEmail`, so a freshly-created account (present
in the DB but not the seed) failed with "Invalid email or password". Fixed: both
now fall back to **`fetchUserByEmail`** (`src/services/db.ts`) — a live DB lookup —
when the in-memory seed has no match.

## Required Supabase configuration (one-time)
- **Run migration `011_partner_account_creation.sql`** — adds PD-scoped INSERT
  policies on `sub_partner_distributors`, `area_supervisors`, `referral_codes`,
  `users` (owner/ops already write via the `ref_write` admin policy). Postgres ORs
  policies, so admin behavior is unchanged.
- **Authentication → Sign In / Providers → User Signups → turn OFF "Confirm
  email".** Otherwise a temp-password account is created "unconfirmed" and cannot
  sign in until it clicks a confirmation email — defeating the no-email design.

## RLS scoping (migration 011)
PD is confined to its own scope: SPD `parent_distributor_id = app_distributor()`,
AS `plant_id = app_plant()`, referral `distributor_id = app_distributor()`, and
`users` only `sub_partner_distributor` / `area_manager` profiles inside scope.

## Verified (Playwright + DB read-back)
- owner creates a PD → temp password → **login works** (lands on dashboard as PD).
- that PD creates an SPD → **no RLS error**; SPD `parent_distributor_id` = the PD's
  distributor, plant inherited, referral code generated, user profile linked.

## Plants per role (migration 041)

Boss: *"Forecaster is multiple plants. Same sa billing multiple plants din hawak
nila. Plant manager per plant lang yan."*

| Role | Plants | Picker |
|---|---|---|
| Owner / Operations Manager | ALL (never asked) | none |
| **Billing User** | several | multi-select |
| **Forecaster** | several | multi-select |
| **Plant Manager** | exactly one | single Select |
| PD / Sub-PD / Area Supervisor | one (home plant tag only — scope comes from the distributor / provinces) | single Select |

`forecasterPlantScope` in `src/store/useStore.ts` mirrors `app_plant_scope()` in
migration 041 **exactly**, because RLS runs first and a client more generous
than the DB just renders empty lists (the 029 failure mode).

⚠️ The rule is `plant_ids` non-empty → those plants; else `plant_id` → that one
plant; else ALL. The middle case exists so a forecaster created BEFORE 041 (one
`plant_id`, empty `plant_ids`) is not silently widened to the whole company —
it is the one place the "empty means ALL" convention from 031 had to be applied
with a fallback rather than literally.

**Forecaster and Plant Manager are now creatable here** (Owner only). They were
roles with no creation path at all — a lost one needed raw SQL. Fixing that also
uncovered a latent escalation: the staff branch of `createPartnerAccount`
hardcoded `billing_user ? 'billing_user' : 'operations_manager'`, so any other
staff role would have been saved as **Operations Manager**. It now writes
`input.role` verbatim.

## Gotchas
- Partial failure: if `signUp` succeeds but a later insert fails, the auth login
  exists without a full profile (login fails safe until fixed). Rare with correct
  RLS; surfaced loudly in the console.
- `db:reset` KEEPS users/distributors/SPD/referral_codes, so **test accounts made
  here survive a reset** — delete them manually before go-live.
- Not built: self-service signup, admin password reset, per-account deactivation.

## Related
[[franchisee-onboarding]] (uses the referral codes created here) ·
CLAUDE.md "Deferred feature — Franchisee account provisioning" (now partially
delivered for PD/SPD/AS).
