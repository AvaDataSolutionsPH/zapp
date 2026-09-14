// ============================================================
// ZAPP Donuts ERP — endorsement regression test
//   npx tsx scripts/qa-endorsement.ts
// ============================================================
//
// Proves the "Endorsed to others" flow (048 + 049) through the ANON key and
// real signed-in sessions — the same path the browser takes. Covers the offer,
// accept, decline, the sub-partner route, and the three things that must be
// refused.
//
// DECLINE is the reason this is a permanent test: it was broken on the first
// attempt and looked fine, because ACCEPT happened to satisfy an unrelated
// policy while DECLINE had nothing to hide behind. Only writing as a real
// recipient caught it.
//
// ⚠️ Writes to production and cleans up after itself: three distributors, one
// sub-partner, four logins and three applications, all deleted at the end
// (children before parents — the FK order). The last check fails loudly if
// anything survives. Run it after any change to the endorsement policies.
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASS = 'QaTemp!2026#zapp';

let pass = 0, fail = 0;
const fails: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; fails.push(label + (detail ? ' :: ' + detail : '')); console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`); }
};
const s = Math.random().toString(36).slice(2, 7);
const authIds: string[] = [];
const userIds: string[] = [];
const appIds: string[] = [];

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

const entry = (action: string) => ({
  id: `audit-qa-${Math.random().toString(36).slice(2, 8)}`,
  action, performedBy: 'qa', performedByName: 'QA', role: 'partner_distributor',
  performedAt: new Date().toISOString(), details: 'QA', fieldModified: 'Endorsement',
});

async function main() {
  const { data: plants } = await admin.from('plants').select('id').order('name');
  const pA = plants![0].id, pB = plants![1].id, pC = plants![2].id;
  const dA = `dist-qa-a-${s}`, dB = `dist-qa-b-${s}`, dC = `dist-qa-c-${s}`, spd = `spd-qa-${s}`;

  await admin.from('distributors').insert([
    { id: dA, name: 'QA Dist A', contact_person: 'A', email: `a${s}@x.com`, phone: '0', plant_id: pA, plant_ids: [pA], referral_code: `QAA${s}`, assigned_area_ids: [], status: 'active' },
    { id: dB, name: 'QA Dist B', contact_person: 'B', email: `b${s}@x.com`, phone: '0', plant_id: pB, plant_ids: [pB], referral_code: `QAB${s}`, assigned_area_ids: [], status: 'active' },
    { id: dC, name: 'QA Dist C', contact_person: 'C', email: `c${s}@x.com`, phone: '0', plant_id: pC, plant_ids: [pC], referral_code: `QAC${s}`, assigned_area_ids: [], status: 'active' },
  ] as never);
  await admin.from('sub_partner_distributors').insert({
    id: spd, name: 'QA SubPartner', contact_person: 'S', email: `s${s}@x.com`, phone: '0',
    parent_distributor_id: dB, plant_id: pB, plant_ids: [pB], status: 'active',
  } as never);

  const mk = async (tag: string, role: string, extra: Record<string, unknown>) => {
    const email = `qa-${tag}-${s}@example.com`;
    const { data } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
    authIds.push(data!.user.id);
    const id = `user-qa-${tag}-${s}`;
    userIds.push(id);
    await admin.from('users').insert({ id, name: `QA ${tag.toUpperCase()}`, email, role, avatar: 'x', ...extra } as never);
    return signIn(email);
  };

  const A = await mk('pda', 'partner_distributor', { plant_id: pA, plant_ids: [pA], distributor_id: dA });
  const B = await mk('pdb', 'partner_distributor', { plant_id: pB, plant_ids: [pB], distributor_id: dB });
  const C = await mk('pdc', 'partner_distributor', { plant_id: pC, plant_ids: [pC], distributor_id: dC });
  const S = await mk('spd', 'sub_partner_distributor', { plant_id: pB, distributor_id: dB, sub_partner_distributor_id: spd });

  const mkApp = async (tag: string) => {
    const id = `app-qa-${tag}-${s}`;
    appIds.push(id);
    await admin.from('applications').insert({
      id, full_name: 'QA Applicant', mobile: '0917', email: `qa-${tag}-${s}@x.com`,
      store_name: 'QA Store', address: 'x', province: 'Metro Manila (NCR)', lat: 0, lng: 0,
      store_photo_url: 'x', gov_id_url: '', proof_of_billing_url: '',
      referral_code: `QAA${s}`, referral_type: 'distributor',
      assigned_distributor_id: dA, assigned_plant_id: pA,
      status: 'pending', submitted_at: new Date().toISOString(), audit_log: [], application_source: 'apply',
    } as never);
    return id;
  };
  const app1 = await mkApp('e1'), app2 = await mkApp('e2'), app3 = await mkApp('e3');

  const offer = (client: SupabaseClient, id: string, toPd?: string, toSpd?: string) =>
    client.from('applications').update({
      endorsed_by_distributor_id: dA,
      endorsed_to_distributor_id: toPd ?? null,
      endorsed_to_sub_partner_distributor_id: toSpd ?? null,
      endorsement_status: 'pending', endorsed_at: new Date().toISOString(),
      endorsement_note: 'Metro Manila, wala akong coverage',
    } as never).eq('id', id).select('id');

  console.log('\n=== 1. OFFER — ownership must NOT move yet ===');
  const { data: off, error: offErr } = await offer(A, app1, dB);
  check(!offErr && off?.length === 1, 'PD A can endorse their own application', offErr?.message);
  const { data: mid } = await admin.from('applications').select('assigned_distributor_id').eq('id', app1).maybeSingle();
  check(mid?.assigned_distributor_id === dA, 'ownership stays with PD A while pending');
  check((await B.from('applications').select('id').eq('id', app1)).data?.length === 1, 'PD B (target) can SEE the offer');
  check((await C.from('applications').select('id').eq('id', app1)).data?.length === 0, 'unrelated PD C canNOT see it');

  console.log('\n=== 2. ACCEPT via RPC — ownership + plant move ===');
  const { error: accErr } = await B.rpc('respond_to_endorsement', {
    p_application_id: app1, p_accept: true, p_entry: entry('endorsement_accepted'), p_reason: null,
  });
  check(!accErr, 'PD B can ACCEPT', accErr?.message);
  const { data: acc } = await admin.from('applications')
    .select('assigned_distributor_id,assigned_plant_id,endorsement_status,audit_log').eq('id', app1).maybeSingle();
  check(acc?.assigned_distributor_id === dB, 'ownership moved to PD B');
  check(acc?.assigned_plant_id === pB, 'plant followed the recipient');
  check(acc?.endorsement_status === 'accepted', 'status = accepted');
  check((acc?.audit_log ?? []).length === 1, 'audit entry landed with it', `entries=${(acc?.audit_log ?? []).length}`);
  check((await A.from('applications').select('id').eq('id', app1)).data?.length === 1, 'PD A keeps a READ-ONLY record');
  const { data: aWrite } = await A.from('applications').update({ notes: 'tamper' } as never).eq('id', app1).select('id');
  check((aWrite?.length ?? 0) === 0, 'PD A can no longer WRITE to it', `rows=${aWrite?.length}`);

  console.log('\n=== 3. DECLINE via RPC — the bug 049 fixes ===');
  await offer(A, app2, dB);
  const { error: decErr } = await B.rpc('respond_to_endorsement', {
    p_application_id: app2, p_accept: false, p_entry: entry('endorsement_declined'), p_reason: 'wala rin akong coverage',
  });
  check(!decErr, 'PD B can DECLINE', decErr?.message);
  const { data: dec } = await admin.from('applications')
    .select('assigned_distributor_id,endorsement_status,endorsement_decline_reason,audit_log').eq('id', app2).maybeSingle();
  check(dec?.assigned_distributor_id === dA, 'declined application stays with PD A');
  check(dec?.endorsement_status === 'declined', 'status = declined');
  check(dec?.endorsement_decline_reason === 'wala rin akong coverage', 'decline reason saved');
  check((dec?.audit_log ?? []).length === 1, 'decline is in the audit history', `entries=${(dec?.audit_log ?? []).length}`);
  const { data: aAgain } = await A.from('applications').update({ notes: 'still mine' } as never).eq('id', app2).select('id');
  check(aAgain?.length === 1, 'PD A can still act on it after a decline');

  console.log('\n=== 4. ENDORSE TO A SUB-PARTNER ===');
  await offer(A, app3, undefined, spd);
  check((await S.from('applications').select('id').eq('id', app3)).data?.length === 1, 'the SPD can SEE an offer made to them');
  const { error: sErr } = await S.rpc('respond_to_endorsement', {
    p_application_id: app3, p_accept: true, p_entry: entry('endorsement_accepted'), p_reason: null,
  });
  check(!sErr, 'the SPD can ACCEPT', sErr?.message);
  const { data: sAfter } = await admin.from('applications')
    .select('assigned_distributor_id,assigned_sub_partner_distributor_id,assigned_plant_id').eq('id', app3).maybeSingle();
  check(sAfter?.assigned_sub_partner_distributor_id === spd, 'SPD id set');
  check(sAfter?.assigned_distributor_id === dB, 'parent PD id set too');
  check(sAfter?.assigned_plant_id === pB, 'plant is the sub-partner plant');
  check((await B.from('applications').select('id').eq('id', app3)).data?.length === 1, 'parent PD B sees it in their channel');

  console.log('\n=== 5. WHAT MUST BE REFUSED ===');
  await offer(A, app2, dB); // fresh pending offer to B
  const { error: cErr } = await C.rpc('respond_to_endorsement', {
    p_application_id: app2, p_accept: true, p_entry: entry('x'), p_reason: null,
  });
  check(!!cErr, 'an unrelated PD cannot answer an offer made to someone else', cErr ? '' : 'it succeeded!');
  const { error: aErr } = await A.rpc('respond_to_endorsement', {
    p_application_id: app2, p_accept: true, p_entry: entry('x'), p_reason: null,
  });
  check(!!aErr, 'the SENDER cannot accept on the recipient behalf', aErr ? '' : 'it succeeded!');
  await B.rpc('respond_to_endorsement', { p_application_id: app2, p_accept: false, p_entry: entry('d'), p_reason: 'no' });
  const { error: twiceErr } = await B.rpc('respond_to_endorsement', {
    p_application_id: app2, p_accept: true, p_entry: entry('x'), p_reason: null,
  });
  check(!!twiceErr, 'an already-resolved offer cannot be answered twice', twiceErr ? '' : 'it succeeded!');

  console.log('\n=== 6. TEARDOWN (children before parents) ===');
  for (const id of appIds) await admin.from('applications').delete().eq('id', id);
  for (const id of userIds) await admin.from('users').delete().eq('id', id);
  for (const id of authIds) await admin.auth.admin.deleteUser(id);
  await admin.from('sub_partner_distributors').delete().eq('id', spd);
  await admin.from('distributors').delete().in('id', [dA, dB, dC]);

  const { count: la } = await admin.from('applications').select('*', { count: 'exact', head: true }).like('id', 'app-qa-%');
  const { count: ld } = await admin.from('distributors').select('*', { count: 'exact', head: true }).like('id', 'dist-qa-%');
  const { count: ls } = await admin.from('sub_partner_distributors').select('*', { count: 'exact', head: true }).like('id', 'spd-qa-%');
  const { count: lu } = await admin.from('users').select('*', { count: 'exact', head: true }).like('id', 'user-qa-%');
  check((la ?? 0) + (ld ?? 0) + (ls ?? 0) + (lu ?? 0) === 0, 'all fixtures removed',
    `apps=${la} dists=${ld} spds=${ls} users=${lu}`);

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  for (const f of fails) console.log('  - ' + f);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
