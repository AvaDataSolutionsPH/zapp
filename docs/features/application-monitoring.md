# Feature: ZAPP New Application Monitoring

**Status:** in progress — Phases 1–3 live, 4–6 pending
**Owner roles:** owner (Admin), operations_manager (OS), area_manager (AS),
partner_distributor (PD), sub_partner_distributor (SD)

Manages and monitors newly submitted partner applications from submission until
approved/disapproved. Intake-form data auto-populates; each department completes
the fields it owns during evaluation.

## Entry points
- Sidebar **Applications** (owner/ops/AS) and **New Applications** (PD) → both
  route to `/applications` (`ApplicationsPage.tsx`) — the monitoring list.
- Detail: `/applications/:id` → `ApplicationDetailPage.tsx`.
- Evaluation fields: `src/pages/applications/MonitoringFieldsCard.tsx`.
- Field RBAC (pure): `src/lib/applicationMonitoring.ts`.

## Role mapping (spec label → our UserRole)
| Spec | UserRole |
|---|---|
| PD | `partner_distributor` |
| SD / Sub PD | `sub_partner_distributor` |
| AS | `area_manager` |
| OS | `operations_manager` |
| Admin | `owner` |

## Phase status
| Phase | What | State |
|---|---|---|
| 1 | Facebook link on intake + monitoring | ✅ `f350fe3` |
| 2 | Schema + form-filled fields (migration 021) | ✅ `d8646dd` |
| 3 | 25-field detail, field-level RBAC, batch Save (migration 022) | ✅ this commit |
| 4 | Transaction History (audit trail) | ⬜ |
| 5 | Auto-assignment (AS by province, Location, Type) | ⬜ blocked on the province→AS master list |
| 6 | Filters (primary + secondary + role behaviour) | ⬜ |

## Field-level RBAC (`src/lib/applicationMonitoring.ts`)
`editableFieldsFor(role)` / `canEditField(role, field)` implement the module's
RBAC table. Fields a role does NOT own still render — read-only — so everyone
sees the whole picture; only the input is withheld.

| Role | Editable |
|---|---|
| PD / SD | Google Maps Picture, Google Maps Link, Lat/Lng, Market Source, Plant, Remarks (PD/SD) |
| AS | Lat/Lng, Market Source, Comparable, ADS, RTC, Shop Code, Plant, Remarks (AS) |
| OS | Market Source, Comparable, ADS, RTC, Shop Code, Plant, Remarks (OS) |
| Admin | everything |

> ⚠️ **Client-side only.** RLS (003 + 022) gates ROW access per role, not
> columns. A role with row UPDATE could in principle write any column. Column
> enforcement would need a trigger — deliberately out of scope, consistent with
> every other role in this app.

## Status is an ACTION, not a Save-able field
The spec contradicts itself — the field list annotates Status "filled up by
PD/SD/AS/OS" while the RBAC table grants it to OS + Admin only. Two decisions,
both confirmed with the user:

1. **Who:** `canSetStatus` = **owner + operations_manager + partner_distributor**.
   PD is kept on top of the RBAC table because approving its own-channel
   franchisees was an explicit earlier boss request (commit `7796856` +
   migration 018); following the table literally would have been a regression.
   AS and SD are excluded per the table — note this **tightened** `canAct`, which
   used to be status-only and therefore let an AS approve.
2. **How:** Status stays the **Approve / Decline / Request Info buttons**, NOT a
   dropdown the batch Save writes. Approving has side effects — `reviewApplication`
   creates the `Store` and (for onboarding applications) the franchisee login. A
   plain field save would flip the status without creating either.

## Save semantics
"No changes shall take effect until Save." Everything in `MonitoringFieldsCard`
is draft state; nothing reaches the store until Save succeeds. A `dirty` flag
gates the button and shows a Discard action.

- The **Google Maps Picture uploads ON SAVE**, not on pick — cancelling leaves no
  orphan object in the bucket. It goes to `zapp-private` under
  `store-maps/<applicationId>/…` and re-signs on render via `useStorageUrl`.
- The patch only ever includes fields the role owns, so a stray draft value from
  a read-only field can never reach the DB.
- Store action `updateApplicationMonitoring(id, patch)` — optimistic + background
  UPDATE + rollback. No side effects, unlike `reviewApplication`.

## Migrations
- **021** — the 12 monitoring columns + `province` index. See
  [[public-application-flow]].
- **022** — SPD access. `apps_select`/`apps_update` (003) listed only admin / PD /
  AS, so a **Sub-PD could not even SELECT an application**, let alone edit one —
  making the spec's "PD/SD" rights and "Sub PD: own referral code only" filter
  impossible. 022 adds `apps_select_spd` + `apps_update_spd` scoped to
  `assigned_sub_partner_distributor_id = app_spd()`, plus an index on that column.
  Additive (new named policies; Postgres ORs them) so 003's behaviour is untouched.

> **Rollout order:** run 021 and 022 BEFORE deploying the client — `mapApplicationToDB`
> sends the new columns on every insert, so deploying first fails every `/apply`
> submission with "column does not exist".

## SPD also needed a menu + client scoping (not just RLS)
Fixing RLS alone left the Sub-PD unable to reach the page at all:
- **Sidebar** — `sub_partner_distributor` was in no entry's `allowedRoles`. It is
  now on **New Applications** alongside `partner_distributor`.
- **`ApplicationsPage` scoping** — only `area_manager` and `partner_distributor`
  had branches; an SPD fell through to the see-everything `return allApplications`.
  It now filters on `assignedSubPartnerDistributorId === currentUser.subPartnerDistributorId`
  ("Own Referral Code only"). RLS already scopes the fetch, but the client filter
  keeps the mock/no-DB path honest and stops the fall-through.

## Verified (Playwright, local vs shared Supabase)
- **PD**: only the PD/SD row is editable; Comparable/ADS/RTC/Shop Code/Remarks
  (AS)/(OS) render read-only `—`. Save disabled until dirty → filled Google Maps
  Link + Market Source + Remarks (PD/SD) → Save → **persisted across a full
  reload**.
- **Admin (owner)**: every field renders as an input/combobox.
- **SPD (mariel@albaysouthdist.ph)**: sidebar shows New Applications; list drops
  from 8 rows to **3 — all `SPD-MARIEL`**, no `BICOL-MARCO`; Evaluation Details
  renders with the PD/SD fields editable and AS/OS ones read-only; **no
  Approve/Verify & Activate/Reject** button (confirms `canSetStatus` excludes SD);
  Save → **RLS 022 accepted the UPDATE**, persisted across a full reload.

## Related
[[public-application-flow]] (intake + migration 021) · [[account-creation]] ·
[[franchisee-onboarding]] · [[partner-onboarding]]
