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

import type { Application, ReferralType, UserRole } from '@/types';

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
 * We follow neither literally — `partner_distributor` keeps it because approving
 * its own-channel franchisees was an explicit earlier boss request (commit
 * 7796856 + migration 018), and dropping it would be a regression. AS and SD are
 * excluded per the RBAC table. Confirmed with the user.
 */
export const canSetStatus = (role: UserRole | undefined): boolean =>
  role === 'owner' || role === 'operations_manager' || role === 'partner_distributor';

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

// ─── Transaction History (Phase 4) ────────────────────────────────────────

/** How each department is named in the audit trail. */
export const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  owner: 'Admin',
  operations_manager: 'OS',
  area_manager: 'AS',
  partner_distributor: 'PD',
  sub_partner_distributor: 'SD',
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
