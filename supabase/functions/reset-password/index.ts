// ============================================================
// ZAPP Donuts ERP — reset-password Edge Function
// ============================================================
//
// Login Credentials & First-Time Account Activation — Phase F.
//
// "Reset Password — authorized personnel may issue a new temporary password."
//
// WHY THIS EXISTS AT ALL (this is the project's FIRST Edge Function).
// Setting another user's password is `auth.admin.updateUserById`, which only
// the service_role key can do. That key bypasses RLS entirely — it is full DB
// admin — so it must NEVER reach the browser. The whole app is otherwise a pure
// SPA on the anon key. This is the one operation that cannot live client-side,
// so it gets a server, and the server does exactly this one thing.
//
// WHAT IT DOES NOT DO. It does not email anyone and it does not store the new
// password. The password is returned ONCE to the staff member who asked for it,
// exactly like the temp password minted at approval, and Supabase keeps only
// the bcrypt hash. password_changed_at is set back to NULL so the Login
// Credentials card correctly reads "Temporary" again.
//
// AUTHORIZATION. The JWT proves who is calling; it does NOT decide what they
// may do. Because this function runs as service_role, RLS does not protect the
// target row — so the scope rule from migration 026 (who may activate a
// franchisee) is re-checked HERE, in code, before any write. It is duplicated
// rather than shared because Deno cannot import from src/; if 026's rule
// changes, change it here too.
//
// DEPLOY (needs the Supabase CLI — the project has no other functions yet):
//   supabase functions deploy reset-password --project-ref qwmqpkylezesvhfnwvgd
// No secrets to set: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by
// the runtime. Until it is deployed the client shows a clear "not available"
// error rather than failing silently.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/**
 * Same shape as src/lib/authSignup.ts generateTempPassword — readable enough to
 * relay by phone, no ambiguous characters. Duplicated because Deno cannot reach
 * into src/.
 */
function generateTempPassword(): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `${pick(alpha, 6)}${pick(digits, 3)}$`;
}

interface Profile {
  id: string;
  email: string;
  role: string;
  distributor_id: string | null;
  sub_partner_distributor_id: string | null;
}

/** Mirrors migration 026's users_update_account_status policy. */
function mayReset(caller: Profile, target: Profile): boolean {
  if (target.role !== 'franchisee_distributor' && target.role !== 'franchisee_direct') return false;
  switch (caller.role) {
    case 'owner':
    case 'operations_manager':
    case 'area_manager':
      return true;
    case 'partner_distributor':
      return !!caller.distributor_id && caller.distributor_id === target.distributor_id;
    case 'sub_partner_distributor':
      return (
        !!caller.sub_partner_distributor_id &&
        caller.sub_partner_distributor_id === target.sub_partner_distributor_id
      );
    default:
      return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function is not configured.' }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Who is calling? ──────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in.' }, 401);

  const { data: authCaller, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !authCaller?.user?.email) return json({ error: 'Not signed in.' }, 401);

  const { data: caller } = await admin
    .from('users')
    .select('id, email, role, distributor_id, sub_partner_distributor_id')
    .ilike('email', authCaller.user.email)
    .maybeSingle();
  if (!caller) return json({ error: 'No profile for this login.' }, 403);

  // ── Who is being reset? ──────────────────────────────────────────────────
  let userId: unknown;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (typeof userId !== 'string' || !userId.trim()) {
    return json({ error: 'userId is required.' }, 400);
  }

  const { data: target } = await admin
    .from('users')
    .select('id, email, role, distributor_id, sub_partner_distributor_id')
    .eq('id', userId)
    .maybeSingle();
  if (!target) return json({ error: 'Account not found.' }, 404);

  if (!mayReset(caller as Profile, target as Profile)) {
    return json({ error: 'You are not allowed to reset this account.' }, 403);
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  // public.users.id is our own id; the auth layer is linked by EMAIL only, and
  // auth.users is not exposed over PostgREST — hence the service_role-only RPC
  // from migration 027.
  const { data: authUserId, error: rpcErr } = await admin.rpc('auth_user_id_by_email', {
    p_email: target.email,
  });
  if (rpcErr || !authUserId) return json({ error: 'No login exists for this account.' }, 404);

  const tempPassword = generateTempPassword();
  const { error: updErr } = await admin.auth.admin.updateUserById(authUserId as string, {
    password: tempPassword,
  });
  if (updErr) return json({ error: updErr.message }, 500);

  // Back to "Temporary" on the Login Credentials card. Best-effort: the
  // password is already changed, so failing here must not tell the caller the
  // reset failed — that would have them hand out a password they think is dead.
  const { error: flagErr } = await admin
    .from('users')
    .update({ password_changed_at: null })
    .eq('id', target.id);
  if (flagErr) console.error('[reset-password] password_changed_at not cleared:', flagErr);

  return json({ tempPassword, username: target.email });
});
