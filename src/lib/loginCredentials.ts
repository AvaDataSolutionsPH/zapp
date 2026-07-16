// ============================================================
// ZAPP Donuts ERP — Login Credentials card (pure)
// ============================================================
//
// "Display the Username, whether the password is still the system-generated
// one, the Account Status, and the date and time the Data Privacy Policy was
// accepted. Visible to the Partner Distributor, Sub Partner Distributor, Area
// Supervisor and Admin."
//
// The card is a read-out of facts that already exist on the user + the
// application; nothing new is stored. In particular there is no "password"
// here — see passwordState.

import type { AccountStatus, User, UserRole } from '@/types';

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  not_activated: 'Not Activated',
  pending_verification: 'Pending Verification',
  active: 'Active',
};

export type PasswordState = 'temporary' | 'updated';

/**
 * Whether the franchisee is still on the password we generated for them.
 *
 * ⚠️ We never show the password itself. Supabase bcrypts it and it is revealed
 * exactly once, at creation. Storing it so this card could re-display it would
 * mean keeping it in plaintext — precisely what "passwords must be securely
 * encrypted" forbids. So the card shows the STATE, and a lost password is
 * recovered by reset (Phase F), never by lookup. This is the boss's own
 * Enhancement note, adopted as the design.
 */
export const passwordState = (user: User | undefined): PasswordState =>
  user?.passwordChangedAt ? 'updated' : 'temporary';

export const PASSWORD_STATE_LABELS: Record<PasswordState, string> = {
  temporary: 'Temporary (system-generated)',
  updated: 'Password Updated',
};

/**
 * Who may see a franchisee's login credentials.
 *
 * The spec's list is "Partner Distributor, Sub Partner Distributor, Area
 * Supervisor, and Admin". Operations is included for the same reason it is in
 * canVerifyDocuments — it is the module's Operations Supervisor, and it already
 * owns Status. Area Supervisor is `area_manager` here (one role, two names in
 * the boss's copy).
 *
 * Deliberately the SAME set as canVerifyDocuments: whoever can activate an
 * account is exactly whoever needs to tell the franchisee how to get in. A
 * franchisee is absent — they see their own credentials by being logged in.
 */
export const canViewLoginCredentials = (role: UserRole | undefined): boolean =>
  role === 'owner' ||
  role === 'operations_manager' ||
  role === 'area_manager' ||
  role === 'partner_distributor' ||
  role === 'sub_partner_distributor';

/**
 * Who may reset a franchisee's password (Phase F).
 *
 * Same set again — the reset only ever hands the new temporary password back to
 * the staff member who asked for it, and the Edge Function re-checks this rule
 * server-side with the service_role key. This client-side predicate only
 * decides whether to render the button.
 */
export const canResetPassword = canViewLoginCredentials;
