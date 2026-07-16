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

import type { UserRole } from '@/types';

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
