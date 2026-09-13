// ============================================================
// ZAPP Donuts ERP — change-login-email Edge Function
// ============================================================
//
// Boss: "dapat flexible din ang system" — a login address typed wrong at
// account creation should be correctable without a developer.
//
// WHY THIS NEEDS A SERVER (this is the project's SECOND Edge Function).
// Changing ANOTHER user's sign-in address is `auth.admin.updateUserById`, which
// only the service_role key can do. That key is full DB admin and bypasses RLS,
// so it must never reach the browser. Same reasoning as reset-password.
//
// ⚠️ THE PART THAT MAKES THIS DANGEROUS: a login lives in TWO places that must
// ALWAYS agree.
//
//     auth.users.email     <- the credential Supabase checks at sign-in
//     public.users.email   <- the profile EVERY RLS policy resolves you by
//                             (`u.email = auth.jwt() ->> 'email'`, migration 003)
//
// Write one and not the other and the account still authenticates but resolves
// to NO profile: `app_role()` returns null, every policy denies, the screen is
// blank, and `login` force-signs-out a session with no profile. No error says
// why. That is exactly what the .ph -> .com rename had to guard against.
//
// So this function writes auth FIRST and the profile SECOND, and if the profile
// write fails it puts the auth address BACK before returning an error. A
// partial run can therefore never lock someone out.
//
// AUTHORIZATION. The JWT proves who is calling; it does not decide what they
// may do. service_role bypasses RLS, so the rule is enforced HERE in code:
// OWNER ONLY. Changing someone's sign-in identity is an account-takeover
// primitive — an ops manager who could repoint an owner's login at their own
// address would own the system. It is deliberately narrower than
// reset-password, which merely issues a temporary password.
//
// A user may always change their OWN password from the TopBar; that is
// unrelated and unaffected.
//
// DEPLOY (via the Supabase Dashboard → Edge Functions → Deploy via editor, the
// same way reset-password was deployed):
//   · slug MUST be exactly `change-login-email` — the slug is fixed at creation
//     and the "Name" field in Settings is display-only, so a wrong slug means
//     recreating the function.
//   · "Verify JWT with legacy secret" must stay OFF — this project uses the new
//     sb_publishable_ key format and does its own auth above.
// No secrets to set: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by
// the runtime. Until deployed the client shows a clear "not available" message
// rather than failing silently.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    .select('id, email, role')
    .ilike('email', authCaller.user.email)
    .maybeSingle();
  if (!caller) return json({ error: 'No profile for this login.' }, 403);

  // Owner only — see the header. Enforced here because service_role ignores RLS.
  if (caller.role !== 'owner') {
    return json({ error: 'Admin (Owner) lang ang pwedeng magpalit ng login email.' }, 403);
  }

  // ── What is being changed? ───────────────────────────────────────────────
  let userId: unknown;
  let newEmail: unknown;
  try {
    ({ userId, newEmail } = await req.json());
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (typeof userId !== 'string' || !userId.trim()) return json({ error: 'userId is required.' }, 400);
  if (typeof newEmail !== 'string' || !EMAIL_RE.test(newEmail.trim())) {
    return json({ error: 'Hindi valid ang email address.' }, 400);
  }
  const next = newEmail.trim().toLowerCase();

  const { data: target } = await admin
    .from('users')
    .select('id, email, name, role')
    .eq('id', userId)
    .maybeSingle();
  if (!target) return json({ error: 'Account not found.' }, 404);

  const current = String(target.email).toLowerCase();
  if (current === next) return json({ email: next, unchanged: true });

  // ── Is the new address free? Check BOTH layers. ──────────────────────────
  const { data: clash } = await admin
    .from('users')
    .select('id')
    .ilike('email', next)
    .neq('id', target.id)
    .maybeSingle();
  if (clash) return json({ error: `Ginagamit na ang "${next}" ng ibang account.` }, 409);

  const { data: authClashId } = await admin.rpc('auth_user_id_by_email', { p_email: next });
  if (authClashId) return json({ error: `May login na gumagamit ng "${next}".` }, 409);

  // public.users.id is our own id; the auth layer is linked by EMAIL only, and
  // auth.users is not exposed over PostgREST — hence the service_role-only RPC
  // from migration 027.
  const { data: authUserId, error: rpcErr } = await admin.rpc('auth_user_id_by_email', {
    p_email: target.email,
  });
  if (rpcErr || !authUserId) return json({ error: 'No login exists for this account.' }, 404);

  // ── 1. Credential first ──────────────────────────────────────────────────
  // email_confirm keeps the address usable immediately; the project runs with
  // "Confirm email" OFF and nobody is waiting on a verification mail.
  const { error: authUpdErr } = await admin.auth.admin.updateUserById(authUserId as string, {
    email: next,
    email_confirm: true,
  });
  if (authUpdErr) return json({ error: authUpdErr.message }, 500);

  // ── 2. Profile second, and UNDO the credential if it fails ───────────────
  const { data: profRows, error: profErr } = await admin
    .from('users')
    .update({ email: next })
    .eq('id', target.id)
    .select('id');

  if (profErr || !profRows || profRows.length === 0) {
    const { error: revertErr } = await admin.auth.admin.updateUserById(authUserId as string, {
      email: target.email,
      email_confirm: true,
    });
    if (revertErr) {
      // Both layers now disagree and we could not fix it. Say so loudly and
      // precisely — this is the one state that locks the account out.
      console.error('[change-login-email] REVERT FAILED', { userId: target.id, revertErr });
      return json({
        error:
          `KRITIKAL: napalitan ang login sa "${next}" pero hindi na-update ang profile, at hindi ma-ibalik. ` +
          `Hindi makakapasok ang account na ito hangga't hindi naaayos nang manual.`,
      }, 500);
    }
    return json({ error: profErr?.message ?? 'Hindi na-update ang profile. Ibinalik ang dating email.' }, 500);
  }

  return json({ email: next, previousEmail: target.email, name: target.name });
});
