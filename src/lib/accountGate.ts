// ============================================================
// ZAPP Donuts ERP — franchisee activation gate (pure)
// ============================================================
//
// "Before verification, the franchisee shall not have access to any ERP
// modules... Only the Account Verification process shall be accessible until the
// account has been successfully verified."
//
// One predicate, used by App.tsx to replace the ENTIRE router (not a per-route
// guard), so there is no URL a locked account can type its way into.

import type { User } from '@/types';

/**
 * True when this account must be held at the verification screen.
 *
 * ⚠️ `accountStatus === undefined` deliberately means UNLOCKED, not locked.
 * Only accounts minted after migration 024 carry a status; every staff login and
 * every franchisee approved before it has none. Defaulting undefined to "locked"
 * would have locked the entire existing user base out of the ERP on deploy.
 */
export const isAccountLocked = (user: User | null | undefined): boolean =>
  !!user?.accountStatus && user.accountStatus !== 'active';
