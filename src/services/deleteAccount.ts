// ============================================================
// ZAPP Donuts ERP — delete-account Edge Function client
// ============================================================
//
// Deleting an account touches auth.users, which only service_role can do, so
// this is a call rather than a computation. See the function for why it refuses
// far more often than it deletes.

import { supabase } from '@/lib/supabase';

export interface DeleteAccountResult {
  deleted: true;
  name: string;
  email: string;
  /** Which rows actually went, in order — useful when a step fails midway. */
  removed: string[];
}

export async function deleteAccountForUser(userId: string): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { userId } });

  if (error) {
    // FunctionsHttpError carries the function's own JSON body, which holds the
    // real reason — "may 3 store(s) pa", "ito na lang ang natitirang Owner".
    // Those are the whole point; a generic failure message would hide them.
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
        'Hindi maabot ang delete-account service. Kailangan itong i-deploy sa Supabase bago gumana ang pagbura.',
    );
  }

  if (!data?.deleted) throw new Error('Hindi nabura ang account.');
  return data as DeleteAccountResult;
}
