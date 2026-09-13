// ============================================================
// ZAPP Donuts ERP — delete-account Edge Function
// ============================================================
//
// Boss: "lagyan delete option ang PD na user at ang OWNER" — a wrong account
// encoded during setup should be removable without a developer. Until now the
// app had NO delete anywhere: every entity screen could only create and edit,
// so a typo'd Partner Distributor was permanent.
//
// WHY A SERVER (this is the project's THIRD Edge Function).
// An account lives in TWO layers, and only one of them is reachable from the
// browser:
//     public.users   — deletable with the anon key, subject to RLS
//     auth.users     — `auth.admin.deleteUser`, service_role ONLY
// Deleting just the profile would leave a login that authenticates into nothing
// (blank screen, forced sign-out) — an orphan nobody can see or clean up from
// the UI. So both go together, here.
//
// ⚠️ THIS REFUSES MORE OFTEN THAN IT DELETES, ON PURPOSE.
// Nothing in this schema has ON DELETE CASCADE. A distributor is referenced by
// stores, applications, referral_codes, sub_partner_distributors and users; an
// area supervisor by stores.area_supervisor_id, which is NOT NULL. Deleting one
// with history either fails with an opaque 23503 or, worse, would need those
// rows destroyed too — silently erasing real business records.
//
// So deletion is allowed ONLY while the account owns nothing. That matches the
// real use case (an account created by mistake five minutes ago) and refuses
// the dangerous one (an account with trading history) with a readable list of
// what is holding it. For those, DEACTIVATE instead: distributors and
// sub-partners already carry a `status` column.
//
// AUTHORIZATION — OWNER ONLY, enforced here because service_role bypasses RLS.
// Plus two refusals that protect the system from itself:
//   · you cannot delete YOURSELF (an owner removing their own login ends the
//     session mid-request and cannot be undone from the UI);
//   · you cannot delete the LAST owner. /accounts/new cannot create an `owner`,
//     so removing the final one leaves the business with no way back in except
//     raw SQL.
//
// DEPLOY (Supabase Dashboard → Edge Functions → Deploy via editor):
//   · slug MUST be exactly `delete-account` — fixed at creation.
//   · "Verify JWT with legacy secret" must stay OFF — this project uses the new
//     sb_publishable_ key format and does its own auth below.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function is not configured.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── Who is calling? ──────────────────────────────────────────────────────
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in.' }, 401);

  const { data: authCaller, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !authCaller?.user?.email) return json({ error: 'Not signed in.' }, 401);

  const { data: caller } = await admin
    .from('users').select('id, email, role').ilike('email', authCaller.user.email).maybeSingle();
  if (!caller) return json({ error: 'No profile for this login.' }, 403);
  if (caller.role !== 'owner') {
    return json({ error: 'Admin (Owner) lang ang pwedeng magbura ng account.' }, 403);
  }

  let userId: unknown;
  try { ({ userId } = await req.json()); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (typeof userId !== 'string' || !userId.trim()) return json({ error: 'userId is required.' }, 400);

  const { data: target } = await admin
    .from('users')
    .select('id, name, email, role, distributor_id, sub_partner_distributor_id')
    .eq('id', userId).maybeSingle();
  if (!target) return json({ error: 'Account not found.' }, 404);

  // ── Refusals that protect the system from itself ─────────────────────────
  if (target.id === caller.id) {
    return json({ error: 'Hindi mo pwedeng burahin ang sarili mong account.' }, 400);
  }
  if (target.role === 'owner') {
    const { count } = await admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner');
    if ((count ?? 0) <= 1) {
      return json({
        error: 'Ito na lang ang natitirang Owner. Gumawa muna ng panibagong Owner bago ito burahin.',
      }, 400);
    }
  }

  // ── What still points at this account? ───────────────────────────────────
  // Nothing cascades, so anything found here means the delete would either fail
  // with a raw 23503 or require destroying real records. Report, do not guess.
  const blockers: string[] = [];
  const countWhere = async (table: string, col: string, val: string) => {
    const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(col, val);
    return count ?? 0;
  };

  if (target.distributor_id) {
    const d = target.distributor_id;
    const stores = await countWhere('stores', 'distributor_id', d);
    const apps = await countWhere('applications', 'assigned_distributor_id', d);
    const spds = await countWhere('sub_partner_distributors', 'parent_distributor_id', d);
    const others = (await countWhere('users', 'distributor_id', d)) - 1; // minus the target
    if (stores) blockers.push(`${stores} store(s)`);
    if (apps) blockers.push(`${apps} application(s)`);
    if (spds) blockers.push(`${spds} sub-partner(s)`);
    if (others > 0) blockers.push(`${others} ibang user sa ilalim nito`);
  }
  if (target.sub_partner_distributor_id) {
    const s = target.sub_partner_distributor_id;
    const stores = await countWhere('stores', 'sub_partner_distributor_id', s);
    const apps = await countWhere('applications', 'assigned_sub_partner_distributor_id', s);
    if (stores) blockers.push(`${stores} store(s)`);
    if (apps) blockers.push(`${apps} application(s)`);
  }
  // An Area Supervisor is matched by id OR name — the two id spaces differ
  // (`user-09` vs `am-01`), exactly as in migration 029.
  const { data: supRow } = await admin
    .from('area_supervisors').select('id')
    .or(`id.eq.${target.id},name.eq.${target.name}`).maybeSingle();
  if (supRow) {
    const stores = await countWhere('stores', 'area_supervisor_id', supRow.id);
    const apps = await countWhere('applications', 'assigned_area_supervisor_id', supRow.id);
    if (stores) blockers.push(`${stores} store(s)`);
    if (apps) blockers.push(`${apps} application(s)`);
  }

  if (blockers.length) {
    return json({
      error:
        `Hindi mabubura si ${target.name} — may nakakabit pa: ${blockers.join(', ')}. ` +
        `I-set na lang sa Inactive imbes na burahin, para hindi mawala ang history.`,
      blockers,
    }, 409);
  }

  // ── Delete, children first (no cascades anywhere in this schema) ─────────
  const removed: string[] = [];
  const step = async (label: string, run: () => Promise<{ error: { message: string } | null }>) => {
    const { error } = await run();
    if (error) throw new Error(`${label}: ${error.message}`);
    removed.push(label);
  };

  try {
    if (target.distributor_id) {
      await step('referral_codes', () => admin.from('referral_codes').delete().eq('distributor_id', target.distributor_id));
    }
    if (target.sub_partner_distributor_id) {
      await step('referral_codes', () => admin.from('referral_codes').delete().eq('sub_partner_distributor_id', target.sub_partner_distributor_id));
    }
    // The PROFILE must go before the entity it references (users has FKs to
    // distributors and sub_partner_distributors) — the same ordering trap that
    // made the first cleanup script fail with 23503.
    await step('public.users', () => admin.from('users').delete().eq('id', target.id));

    if (target.distributor_id) {
      await step('distributors', () => admin.from('distributors').delete().eq('id', target.distributor_id));
    }
    if (target.sub_partner_distributor_id) {
      await step('sub_partner_distributors', () => admin.from('sub_partner_distributors').delete().eq('id', target.sub_partner_distributor_id));
    }
    if (supRow) {
      await step('area_supervisors', () => admin.from('area_supervisors').delete().eq('id', supRow.id));
    }
  } catch (e) {
    return json({ error: `Nabura ang ilan pero may pumalya: ${String(e)}. Pakisuri sa Supabase.`, removed }, 500);
  }

  // ── The credential LAST, so a failure above never leaves a login with no
  //    profile (that authenticates into a blank screen and cannot be cleaned
  //    up from the UI). ───────────────────────────────────────────────────
  const { data: authUserId } = await admin.rpc('auth_user_id_by_email', { p_email: target.email });
  if (authUserId) {
    const { error: delErr } = await admin.auth.admin.deleteUser(authUserId as string);
    if (delErr) {
      return json({
        error: `Nabura ang profile pero hindi ang login (${delErr.message}). Burahin ito sa Supabase → Authentication → Users.`,
        removed,
      }, 500);
    }
    removed.push('auth.users');
  }

  return json({ deleted: true, name: target.name, email: target.email, removed });
});
