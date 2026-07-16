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
| 4 | Transaction History (audit trail) | ✅ this commit |
| 5 | Auto-assignment (AS by province, Location, Type) | ✅ this commit (migration 023) |
| 6 | Filters (primary + secondary + role behaviour) | ✅ this commit |

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

## Transaction History (Phase 4)
Read-only table on the detail page, newest first, with the seven columns the
spec requires: Date & Time · User · Dept. · Action · Field Modified · Previous ·
New. It replaced the old "Audit Timeline", which only showed action/details and
printed the raw `performedBy` **id** where the spec asks for a User Name.

**No migration** — `audit_log` is JSONB and `mapApplicationToDB` passes it through
verbatim (`audit_log: a.auditLog`), so new nested keys need no schema change.

`AuditEntry` gained `performedByName?`, `role?`, `fieldModified?`,
`previousValue?`, `newValue?` — all optional, so entries written before Phase 4
stay valid; the table falls back to `performedBy` / `details` for them.

`diffMonitoringFields(before, patch, resolve?)` (pure, in
`lib/applicationMonitoring.ts`) returns one change per field that ACTUALLY
changed — a Save that alters nothing logs nothing. `FIELD_LABELS` is keyed by the
REAL Application field (so `lat`/`lng`, not the `latLng` UI grouping); a key
absent from it is not a monitoring field and is skipped, which is what keeps
unrelated Application keys out of the log.

Two display concerns the log must get right, both proven E2E:
- **`VALUE_LABELS`** is shared with `MonitoringFieldsCard`, so the log and the
  form can never disagree: it records `Facebook → Walk-in`, not `facebook → walk_in`.
- **`resolve`** injects domain lookups the pure layer can't do — the store passes
  a plant-id → plant-name resolver, so it records `Daraga Plant → Manila Plant`,
  not `plant-01 → plant-02`.

Entries are stamped in the store action (ids via `uid()`, timestamps via
`new Date()`), never during render — `react-hooks/purity` forbids that.
`reviewApplication` now also records `performedByName` / `role` and logs Status
as a field change (previous → new).

## Auto-assignment (Phase 5)
Three "Additional System Requirements" from the spec, all resolved LIVE (read
time) rather than frozen at submit:

- **Type** — `applicationType(referralType)` (see above), Distributor for
  distributor/SPD referrals, else Direct.
- **Location** — `resolveLocation(province)` in `lib/phRegions.ts`, a pure static
  map (Albay→Bicol Region, Cavite→Cavite, Occidental/Oriental Mindoro→Mindoro,
  Metro Manila (NCR)→Metro Manila, …). Computed on the anonymous `/apply` path and
  stored, and re-derived on render for pre-021 rows. Verified: Sorsogon → Bicol
  Region.
- **Area Supervisor** — from an **admin-managed province master list**, not a
  hardcoded map. Boss's instruction verbatim: *"Gawa nalang tayo ng admin
  settings na maglalagay sa per areas sa isang area supv. Para kahit mapalitan
  madali lang ichange."*

### The master list (admin settings)
`AreaSupervisor.assignedProvinces` (migration 023), edited on the Area
Supervisors page: a **Provinces (Coverage)** column + an **Assign Areas** button →
`AssignProvincesModal` (checkbox grid of `OPERATING_PROVINCES`, warns on overlap).
Store action `updateAreaSupervisorProvinces` (optimistic + rollback); RLS is
003's `ref_write` (admin) — no new policy.

> ⚠️ **Not `assigned_areas`.** That existing column holds free-text CITY names
> for display and is read in 7 places; redefining it as provinces would corrupt
> all of them. `assignedProvinces` is a separate, additive column.

### Read-time resolution — the load-bearing decision
`effectiveAreaSupervisorId(app, areaSupervisors)` = the province master list AS,
**falling back** to the referral code's AS when no province matches. The list is
used everywhere the AS is shown or filtered (monitoring list column + filter,
detail card, approval's store creation). It is deliberately NOT frozen onto the
application at submit, for two reasons:
1. **Editing the list must re-point every application at once** — that is exactly
   what "kahit mapalitan madali lang ichange" asks for. Freezing would need a
   backfill on every edit.
2. The anonymous `/apply` path **cannot read** the master list (`ref_select` is
   `TO authenticated`), so it could not resolve the AS at submit even if we wanted
   to.

The fallback is what makes an **empty** master list safe: until an admin fills it
in, assignment behaves exactly as before Phase 5.

### AS scope
`ApplicationsPage` now scopes an Area Supervisor by `effectiveAreaSupervisorId`,
so assigning a province in admin settings instantly re-scopes that AS's queue.
(This is the province-based visibility the spec's "assigned provinces" wording
called for.)

## Filters (Phase 6)
**Primary** (always visible): Status · Area (Province) · Area Supervisor · Type ·
Application Date (From/To) · Search. **Secondary** (behind an *Advanced filters*
toggle): Market Source · RTC · Comparable · ADS · Shop Code · Google Maps Link ·
Store Google Maps Picture · Plant. Plus a **Reset Filters** button and a
`{filtered} of {total}` counter. Every setter also resets to page 1 — filtering
while on page 3 would otherwise land on an empty page.

- **Area (Province)** is auto-populated from the provinces actually present in
  the user's own scope, so it never offers a value with zero results. Only
  applications filed since migration 021 have a province.
- **Search** covers Applicant Name, Store Name, Contact Number, Email, Referral
  Code and Shop Code (it used to be name/email/store only).
- **Status** gained `needs_more_info`, which was missing from the options —
  applications parked in that state were unreachable from the filter. `declined`
  is labelled **Disapproved** per the module; the stored value is unchanged.
- **Distributor** is hidden for PD/SPD (`isChannelScoped`) — their whole scope is
  already one distributor.

### Role scoping
| Role | Sees |
|---|---|
| Admin / OS | all |
| PD | own `assignedDistributorId` **+ every SPD that reports to it** |
| SPD | own referral only (`assignedSubPartnerDistributorId`) |
| AS | applications assigned to them (`assignedAreaSupervisorId`) |

> AS scoping is by **assigned provinces** via `effectiveAreaSupervisorId` (Phase
> 5): assigning a province in admin settings instantly re-scopes that AS's queue.

### Two bugs fixed here
1. **`/apply` dropped the SPD assignment.** It set `assignedDistributorId` but
   never `assignedSubPartnerDistributorId` (only `/onboarding` did). Since both
   the SPD scope and RLS 022 key off that column, an applicant using an SPD
   referral code on the public form would have been **invisible to that SPD
   forever**.
2. **Type mislabelled SPD applications "Direct".** The table rendered
   `referralType === 'distributor' ? 'Distributor' : 'Direct'`, but approval
   treats `sub_partner_distributor` as `isDistributorChannel` and creates a
   `franchisee_distributor` — the list and the outcome disagreed. Both now go
   through `applicationType()`.

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
- **Transaction History**: PD changed Market Source + Plant in one Save →
  **two rows** (one per field), each `Marco Villanueva | PD | updated`, reading
  `Market Source: Facebook → Walk-in` and `Plant: Daraga Plant → Manila Plant`
  (labels + plant names resolved, not raw enum/ids); the pre-Phase-4 `submitted`
  entry still renders via its fallbacks (`system`, `—`, "Application submitted").
  Persisted across a full reload.

## Related
[[public-application-flow]] (intake + migration 021) · [[account-creation]] ·
[[franchisee-onboarding]] · [[partner-onboarding]]
