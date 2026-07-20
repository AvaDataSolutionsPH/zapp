// ============================================================
// ZAPP Donuts ERP — Who may maintain the catalogs
// ============================================================
//
// Both catalogs (donuts + packaging) are business data, so the people who run
// the business maintain them without a developer: Owner and Operations
// Supervisor.
//
// ⚠️ This MIRRORS the server, it does not decide anything. 003's `ref_write`
// restricts every reference table to app_is_admin() = owner +
// operations_manager, and that is the real gate. If this list ever grows past
// those two roles, the UI will offer an edit the database silently rejects —
// widen the RLS in the same change or not at all.
//
// ⚠️ AREA SUPERVISOR WAS CONSIDERED AND DELIBERATELY EXCLUDED. It was briefly
// requested, then withdrawn once the blast radius was clear: there is no
// per-area pricing in the schema, so an AS editing a price changes what EVERY
// store in the company pays — far beyond their province scope, and there are 8
// of them. If it is ever revisited, note that the fix is NOT to add
// 'area_manager' to app_is_admin(): that would also grant write on `users`, and
// since RLS is row-level an AS could insert themselves a row with role='owner'.
// It would need narrow per-table policies, the way migration 032 handled the
// franchisee-login case.

import type { UserRole } from '@/types';

const CATALOG_EDITORS: UserRole[] = ['owner', 'operations_manager'];

/** True when this role may add or edit catalog entries (donuts + packaging). */
export const canEditCatalog = (role: UserRole | undefined): boolean =>
  !!role && CATALOG_EDITORS.includes(role);
