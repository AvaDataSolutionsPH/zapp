// ============================================================
// ZAPP Donuts ERP — New Application Monitoring: field-level RBAC (pure)
// ============================================================
//
// The monitoring module lets several departments work the SAME application,
// each owning a different set of fields. This module is the single source of
// truth for "who may edit what" — the detail page asks it per field rather than
// scattering role checks through the JSX.
//
// Role mapping (spec label → our UserRole):
//   PD    → partner_distributor
//   SD    → sub_partner_distributor
//   AS    → area_manager
//   OS    → operations_manager
//   Admin → owner  (full access)
//
// ⚠️ This is CLIENT-side enforcement. RLS (003 + 022) gates row access per role,
// but not per column — an SPD with row UPDATE could in principle write any
// column. Column-level DB enforcement would need a trigger; out of scope here,
// consistent with how every other role is handled.
//
// ⚠️ Status is deliberately NOT a monitoring field. Approving an application has
// side effects (it creates the Store + the franchisee login via
// `reviewApplication`), so it stays an explicit action — Approve / Decline
// buttons — instead of a value the batch Save writes. See canSetStatus below.

import type { Application, AreaSupervisor, ReferralType, UserRole } from '@/types';

/** Fields the batch Save can write. `latLng` covers the lat+lng pair. */
export type MonitoringField =
  | 'googleMapsPictureUrl'
  | 'googleMapsLink'
  | 'latLng'
  | 'marketSource'
  | 'comparable'
  | 'ads'
  | 'rtc'
  | 'shopCode'
  | 'assignedPlantId'
  | 'remarksPdSd'
  | 'remarksAs'
  | 'remarksOs';

export const ALL_MONITORING_FIELDS: MonitoringField[] = [
  'googleMapsPictureUrl',
  'googleMapsLink',
  'latLng',
  'marketSource',
  'comparable',
  'ads',
  'rtc',
  'shopCode',
  'assignedPlantId',
  'remarksPdSd',
  'remarksAs',
  'remarksOs',
];

// Straight from the module's Role-Based Access Control table.
const PD_SD_FIELDS: MonitoringField[] = [
  'googleMapsPictureUrl',
  'googleMapsLink',
  'latLng',
  'marketSource',
  'assignedPlantId',
  'remarksPdSd',
];

const AS_FIELDS: MonitoringField[] = [
  'latLng',
  'marketSource',
  'comparable',
  'ads',
  'rtc',
  'shopCode',
  'assignedPlantId',
  'remarksAs',
];

const OS_FIELDS: MonitoringField[] = [
  'marketSource',
  'comparable',
  'ads',
  'rtc',
  'shopCode',
  'assignedPlantId',
  'remarksOs',
];

const BY_ROLE: Partial<Record<UserRole, MonitoringField[]>> = {
  owner: ALL_MONITORING_FIELDS, // Admin — full access
  partner_distributor: PD_SD_FIELDS,
  sub_partner_distributor: PD_SD_FIELDS,
  area_manager: AS_FIELDS,
  operations_manager: OS_FIELDS,
};

/** Fields this role may edit. Unlisted roles (franchisees, billing, …) get none. */
export const editableFieldsFor = (role: UserRole | undefined): MonitoringField[] =>
  (role && BY_ROLE[role]) || [];

export const canEditField = (role: UserRole | undefined, field: MonitoringField): boolean =>
  editableFieldsFor(role).includes(field);

/** True when the role owns at least one field — i.e. show the Save button. */
export const canEditAnyField = (role: UserRole | undefined): boolean =>
  editableFieldsFor(role).length > 0;

/**
 * Who may Approve / Disapprove.
 *
 * The spec is self-contradictory here: the field list annotates Status as
 * "filled up by PD/SD/AS/OS" while the RBAC table grants it to OS + Admin only.
 * We follow the FIELD LIST minus SD:
 *   • partner_distributor — approving its own-channel franchisees was an
 *     explicit earlier boss request (commit 7796856 + migration 018).
 *   • area_manager — the AS evaluates the site and assigns the Shop Code, so
 *     the boss expects to approve from that same screen. It was briefly
 *     excluded per the RBAC table; that read of the spec was wrong in practice.
 *     ⚠️ Requires migration 032 — an AS approval INSERTs the franchisee's
 *     `users` profile, which `ref_write` (admin-only) would otherwise reject
 *     AFTER the store and auth login are already committed.
 *   • sub_partner_distributor stays excluded — an SPD is view-only by design
 *     (003's app_is_viewonly), so it cannot create the store either.
 */
export const canSetStatus = (role: UserRole | undefined): boolean =>
  role === 'owner' ||
  role === 'operations_manager' ||
  role === 'partner_distributor' ||
  role === 'area_manager';

/**
 * The module's "Type", auto-determined from the referral code.
 *
 * ⚠️ An SPD-referred application is **Distributor**, not Direct — a Sub-Partner
 * sits UNDER a partner distributor, so nothing about it is direct-to-ZAPP. This
 * matches what approval actually does: `reviewApplication` treats
 * `distributor` + `sub_partner_distributor` as `isDistributorChannel` and
 * creates a `franchisee_distributor` login. The Applications table used to
 * render `referralType === 'distributor' ? 'Distributor' : 'Direct'`, which
 * labelled SPD applications "Direct" while the system enrolled them as
 * distributor-channel — the list and the outcome disagreed.
 */
export const applicationType = (referralType: ReferralType): 'Distributor' | 'Direct' =>
  referralType === 'distributor' || referralType === 'sub_partner_distributor'
    ? 'Distributor'
    : 'Direct';

// ─── Automatic Area-Supervisor assignment (Phase 5) ───────────────────────

/**
 * The AS covering a province, from the admin-managed master list
 * (`AreaSupervisor.assignedProvinces`, migration 023).
 *
 * Returns undefined when nothing covers the province — callers must then fall
 * back to whatever the referral code carried, which is the pre-Phase-5
 * behaviour. That fallback is what makes an EMPTY master list safe: until the
 * admin fills it in, assignment works exactly as it did before.
 *
 * Matching is case/whitespace-insensitive because provinces arrive as free text
 * from the PSGC cascade. If two supervisors claim the same province the first
 * wins — the admin UI is the place to resolve that, not a silent tiebreak here.
 */
export const resolveAreaSupervisorForProvince = (
  province: string | undefined,
  areaSupervisors: Pick<AreaSupervisor, 'id' | 'assignedProvinces'>[],
): string | undefined => {
  const key = province?.trim().toLowerCase();
  if (!key) return undefined;
  return areaSupervisors.find((as_) =>
    (as_.assignedProvinces ?? []).some((p) => p.trim().toLowerCase() === key),
  )?.id;
};

/**
 * The AS actually responsible for an application.
 *
 * The province master list WINS over whatever the referral code carried: the
 * list is live admin data, so editing it re-points every application at once
 * ("kahit mapalitan madali lang ichange"). Freezing an id at submit would need
 * a backfill on every change — and the anon /apply path cannot read the list
 * anyway. Falls back to the referral's AS when no province coverage matches, so
 * an empty master list behaves exactly as before Phase 5.
 */
export const effectiveAreaSupervisorId = (
  app: Pick<Application, 'province' | 'assignedAreaSupervisorId'>,
  areaSupervisors: Pick<AreaSupervisor, 'id' | 'assignedProvinces'>[],
): string | undefined =>
  resolveAreaSupervisorForProvince(app.province, areaSupervisors) ??
  app.assignedAreaSupervisorId;

/** Provinces already claimed by ANOTHER supervisor — the UI warns on these. */
export const provincesClaimedByOthers = (
  selfId: string,
  areaSupervisors: Pick<AreaSupervisor, 'id' | 'assignedProvinces'>[],
): Set<string> => {
  const taken = new Set<string>();
  for (const as_ of areaSupervisors) {
    if (as_.id === selfId) continue;
    for (const p of as_.assignedProvinces ?? []) taken.add(p.trim().toLowerCase());
  }
  return taken;
};

// ─── Transaction History (Phase 4) ────────────────────────────────────────

/** How each department is named in the audit trail. */
export const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  owner: 'Admin',
  operations_manager: 'OS',
  area_manager: 'AS',
  partner_distributor: 'PD',
  sub_partner_distributor: 'SD',
  // The franchisee writes to the log too — submitting verification documents on
  // their own application. Without these their entries showed a bare "—".
  franchisee_distributor: 'Franchisee',
  franchisee_direct: 'Franchisee',
};

/**
 * Market Source is a MULTI-SELECT checklist of location characteristics (boss
 * request — a site can neighbour several of these at once). The order here is
 * the order shown in the checklist. `other` reveals a free-text box whose value
 * is stored in `marketSourceOther`.
 */
export const MARKET_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'no_market_source', label: 'No Market Source' },
  { value: 'no_delivery_route', label: 'No Delivery Route' },
  { value: 'low_foot_traffic', label: 'Low Foot Traffic' },
  { value: 'existing_franchisee_nearby', label: 'Existing Franchisee Nearby' },
  { value: 'schools', label: 'Schools' },
  { value: 'church', label: 'Church' },
  { value: 'talipapa', label: 'Talipapa' },
  { value: 'public_market', label: 'Public Market' },
  { value: 'town_center', label: 'Town Center / Poblacion' },
  { value: 'municipality_hall', label: 'Municipality Hall' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'drop_point', label: 'Drop Point (Bus / Jeep / PUV)' },
  { value: 'high_foot_traffic', label: 'High Foot Traffic' },
  { value: 'other', label: 'Other' },
];

export const MARKET_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  MARKET_SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

/**
 * The selected market sources as one readable string — for the read-only view
 * and the audit log. Unknown keys (e.g. the two obsolete single-select values
 * from before migration 030) pass through as-is rather than vanish. The custom
 * "Other" text is appended in parentheses.
 */
export const marketSourceSummary = (
  values: string[] | undefined,
  other?: string,
): string => {
  const list = (values ?? []).map((v) =>
    v === 'other' && other?.trim()
      ? `Other: ${other.trim()}`
      : (MARKET_SOURCE_LABELS[v] ?? v),
  );
  return list.length ? list.join(', ') : '—';
};

/** Option-style values → their display text (so the log reads "Walk-in", not "walk_in"). */
export const VALUE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  referral: 'Referral',
  walk_in: 'Walk-in',
  website: 'Website',
  others: 'Others',
  yes: 'Yes',
  no: 'No',
  pending: 'Pending',
  approved: 'Approved',
  disapproved: 'Disapproved',
};

/**
 * Human labels, keyed by the REAL Application field — note `latLng` is only a UI
 * grouping, the patch carries `lat` and `lng` separately, so both appear here.
 * A key missing from this map is not a monitoring field and is skipped by the
 * diff (that is what keeps unrelated Application keys out of the log).
 */
const FIELD_LABELS: Record<string, string> = {
  googleMapsPictureUrl: 'Store Google Maps Picture',
  googleMapsLink: 'Google Maps Link',
  lat: 'Latitude',
  lng: 'Longitude',
  marketSource: 'Market Source',
  marketSourceOther: 'Market Source (Other)',
  comparable: 'Comparable',
  ads: 'ADS',
  rtc: 'RTC',
  shopCode: 'Shop Code',
  assignedPlantId: 'Plant',
  remarksPdSd: 'Remarks (PD/SD)',
  remarksAs: 'Remarks (Area Supervisor)',
  remarksOs: 'Remarks (Operations Supervisor)',
};

export interface MonitoringChange {
  field: string;
  label: string;
  previous: string;
  next: string;
}

const EMPTY = '—';

const format = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return EMPTY;
  const raw = String(value);
  return VALUE_LABELS[raw] ?? raw;
};

/**
 * Compare an application against a monitoring patch and return one entry per
 * field that ACTUALLY changed — the Transaction History records field-level
 * before/after, so a Save that touches nothing must log nothing.
 *
 * `resolve` lets the caller supply a display value the pure layer can't know
 * (e.g. plant id → plant name). Returning undefined falls back to the raw value.
 */
export const diffMonitoringFields = (
  before: Application,
  patch: Partial<Application>,
  resolve?: (field: string, value: unknown) => string | undefined,
): MonitoringChange[] => {
  const changes: MonitoringChange[] = [];
  for (const key of Object.keys(patch)) {
    const label = FIELD_LABELS[key];
    if (!label) continue;
    const beforeRaw = (before as unknown as Record<string, unknown>)[key];
    const afterRaw = (patch as unknown as Record<string, unknown>)[key];
    const previous = resolve?.(key, beforeRaw) ?? format(beforeRaw);
    const next = resolve?.(key, afterRaw) ?? format(afterRaw);
    if (previous === next) continue;
    changes.push({ field: key, label, previous, next });
  }
  return changes;
};
