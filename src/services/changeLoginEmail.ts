// ============================================================
// ZAPP Donuts ERP — change-login-email Edge Function client
// ============================================================
//
// Thin wrapper over supabase/functions/change-login-email. Changing ANOTHER
// user's sign-in address needs the service_role key, which must never reach the
// browser — so this is a call, not a computation.
//
// The function is deployed separately from the app, so it can be missing while
// the client that calls it is live. That case is translated into a sentence a
// staff member can act on rather than a raw 404.

import { supabase } from '@/lib/supabase';

export interface ChangeLoginEmailResult {
  /** The address the account now authenticates with. */
  email: string;
  previousEmail?: string;
  name?: string;
  /** True when the new address matched the old one and nothing was written. */
  unchanged?: boolean;
}

export async function changeLoginEmailForUser(
  userId: string,
  newEmail: string,
): Promise<ChangeLoginEmailResult> {
  const { data, error } = await supabase.functions.invoke('change-login-email', {
    body: { userId, newEmail },
  });

  if (error) {
    // FunctionsHttpError carries the function's own JSON body, which holds the
    // real reason (not owner / address taken / no login). Surface that.
    const ctx = (error as { context?: Response }).context;
    let message: string | undefined;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (typeof body?.error === 'string') message = body.error;
      } catch {
        // Not JSON — the function is missing or crashed before responding.
      }
    }
    throw new Error(
      message ??
        'Hindi maabot ang change-login-email service. Kailangan itong i-deploy sa Supabase bago gumana ang pagpalit ng login email.',
    );
  }

  if (!data?.email) throw new Error('Walang natanggap na bagong email.');
  return data as ChangeLoginEmailResult;
}
