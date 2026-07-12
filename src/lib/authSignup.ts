// ============================================================
// Isolated auth sign-up for admin-driven Account Creation.
// ============================================================
//
// `supabase.auth.signUp` signs the caller IN as the newly created user, which
// would clobber the admin's (owner/ops/PD) session. To avoid that we run the
// sign-up on a THROWAWAY client that never persists a session, so the admin's
// login is untouched.
//
// Requires Supabase → Auth → Email → "Confirm email" to be OFF, otherwise the
// created account can't sign in until it clicks a confirmation email (which is
// exactly the email round-trip this temp-password flow avoids).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Create an auth login for `email` with `password` WITHOUT touching the current
 * session. Throws on failure so the caller can surface / roll back.
 */
export async function signUpIsolated(email: string, password: string): Promise<void> {
  const throwaway = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await throwaway.auth.signUp({ email, password });
  if (error) throw error;
}

/** Generate a readable, reasonably strong temporary password. */
export function generateTempPassword(): string {
  // Avoid ambiguous chars (0/O, 1/l/I). ~10 chars + a symbol + digits meets
  // Supabase's default strength without being impossible to relay by hand.
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `${pick(alpha, 6)}${pick(digits, 3)}$`;
}
