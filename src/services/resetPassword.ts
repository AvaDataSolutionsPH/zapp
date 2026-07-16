// ============================================================
// ZAPP Donuts ERP — reset-password Edge Function client
// ============================================================
//
// Thin wrapper over the project's only Edge Function (supabase/functions/
// reset-password). Setting another user's password needs the service_role key,
// which must never reach the browser — so this is a call, not a computation.
//
// The function is deployed separately from the app (Supabase CLI), so it can be
// missing while the client that calls it is live. That case is translated into
// a sentence a staff member can act on rather than a raw 404.

import { supabase } from '@/lib/supabase';

export interface ResetPasswordResult {
  /** Revealed ONCE. Never stored — Supabase keeps only the bcrypt hash. */
  tempPassword: string;
  /** The email the account actually authenticates with. */
  username: string;
}

export async function resetPasswordForUser(userId: string): Promise<ResetPasswordResult> {
  const { data, error } = await supabase.functions.invoke('reset-password', {
    body: { userId },
  });

  if (error) {
    // FunctionsHttpError carries the function's own JSON body, which holds the
    // real reason (not allowed / no login exists). Surface that, not "failed".
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
        'Hindi maabot ang reset-password service. Kailangan itong i-deploy sa Supabase bago gumana ang Reset Password.',
    );
  }

  if (!data?.tempPassword) throw new Error('Walang natanggap na bagong password.');
  return data as ResetPasswordResult;
}
