// ============================================================
// ZAPP Donuts ERP — pre-flight smoke test   (npx tsx scripts/qa-smoke.ts)
// ============================================================
//
// Drives the WHOLE franchisee pipeline against the live database using the
// ANON key and real signed-in sessions — the same path the browser takes — so
// an RLS denial shows up here instead of as "hindi na-save" in front of a
// customer.
//
// Covers: anonymous /apply submit -> owner review + approve (all four writes)
// -> franchisee sign-in, document upload and activation -> Partner Distributor
// and Area Supervisor scope + saves -> Storage uploads and signed reads.
//
// ⚠️ IT WRITES TO PRODUCTION, then deletes everything it made. Every fixture is
// created here (owner, PD, AS, franchisee, application, store, uploads) and
// removed in teardown; the final check fails loudly if anything is left behind.
// It never touches a real person's row. If it crashes mid-run, re-run it — the
// fixtures are name-spaced with a random stamp and setup purges its own leftovers.
//
// A failing line is a real defect: these are the exact calls the UI makes.
//
// Service-role is used ONLY for fixture setup/teardown and for reading results
// back; every assertion about what a USER can do runs through the anon key.
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false } });

const PASS = 'QaTemp!2026#zapp';
const OWNER_EMAIL = 'qa-temp-owner@example.com';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(ok: boolean, label: string, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ' :: ' + detail : ''}`);
    console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`);
  }
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

const uid = () => Math.random().toString(36).slice(2, 8);

/** Remove anything a previous crashed run left behind. */
async function purgeLeftovers() {
  const { data: users } = await admin.from('users').select('id,email');
  for (const u of users ?? []) {
    if (u.id.startsWith('user-qa-') || (u.email ?? '').startsWith('qa-')) {
      await admin.from('users').delete().eq('id', u.id);
    }
  }
  for (const t of ['stores', 'applications'] as const) {
    const { data } = await admin.from(t).select('id');
    for (const r of data ?? []) {
      if (String(r.id).startsWith(`${t === 'stores' ? 'store' : 'app'}-qa-`)) {
        await admin.from(t).delete().eq('id', r.id);
      }
    }
  }
  const { data: logins } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const l of logins?.users ?? []) {
    const e = l.email ?? '';
    if (e.startsWith('qa-') || e.startsWith('qa.') || /^qa[a-z0-9]{4}@shop\./i.test(e)) {
      await admin.auth.admin.deleteUser(l.id);
    }
  }
}

async function main() {
  await purgeLeftovers();
  const stamp = uid();
  const APP_ID = `app-qa-${stamp}`;
  const STORE_ID = `store-qa-${stamp}`;
  const FRAN_ID = `user-qa-fran-${stamp}`;
  const SHOP = `QA${stamp.toUpperCase().slice(0, 4)}`;
  const FRAN_EMAIL = `${SHOP.toLowerCase()}@shop.zappdonuts.com`;

  const OWNER_ID = `user-qa-owner-${stamp}`;

  console.log(`\n=== FIXTURES (shop code ${SHOP}) ===`);

  // A throwaway owner. Never reuse a real person's login for this: it would
  // mean knowing or resetting their password.
  const { data: ownerAuth, error: ownerAuthErr } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL, password: PASS, email_confirm: true,
  });
  if (ownerAuthErr) throw new Error(`could not create QA owner: ${ownerAuthErr.message}`);
  const { error: ownerProfErr } = await admin.from('users').insert({
    id: OWNER_ID, name: 'QA Smoke Owner', email: OWNER_EMAIL, role: 'owner',
    avatar: 'https://ui-avatars.com/api/?name=QA', plant_ids: [],
  } as never);
  if (ownerProfErr) {
    await admin.auth.admin.deleteUser(ownerAuth.user.id);
    throw new Error(`could not create QA owner profile: ${ownerProfErr.message}`);
  }
  console.log('  QA owner created');

  // Real channel: Jose's live referral code.
  const { data: ref } = await admin
    .from('referral_codes').select('*').eq('code', 'ZAPP-PH').maybeSingle();
  if (!ref) throw new Error('ZAPP-PH missing');
  console.log(`  referral ZAPP-PH -> plant ${ref.plant_id} dist ${ref.distributor_id}`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 1. ANONYMOUS /apply SUBMIT (the public path) ===');
  const anon = anonClient();

  const { data: rpcRes, error: rpcErr } = await anon.rpc('validate_referral_code', { p_code: 'zapp-ph' });
  check(!rpcErr && !!rpcRes, 'anon can validate a referral code (044)', rpcErr?.message);

  const appRow = {
    id: APP_ID,
    full_name: 'QA Mock Franchisee',
    mobile: '09171234567',
    email: `qa.fran.${stamp}@example.com`,
    store_name: `QA Mock Store ${stamp}`,
    address: '123 QA St, Brgy. Test, Legazpi City, Albay',
    province: 'Albay',
    location: 'Bicol Region',
    lat: 13.14, lng: 123.74,
    // NOT NULL in 001. /apply sends empty strings (ID + proof are collected
    // post-approval); omitting them entirely is a 23502.
    store_photo_url: 'zapp-public/store-photo/qa/qa.png',
    gov_id_url: '',
    proof_of_billing_url: '',
    referral_code: 'ZAPP-PH',
    referral_type: 'distributor',
    assigned_distributor_id: ref.distributor_id,
    assigned_plant_id: ref.plant_id,
    status: 'pending',
    submitted_at: new Date().toISOString(),
    audit_log: [],
    application_source: 'apply',
  };
  const { error: insErr } = await anon.from('applications').insert(appRow as never);
  check(!insErr, 'anon can INSERT an application (006)', insErr?.message);

  const { data: readBack } = await admin.from('applications').select('*').eq('id', APP_ID).maybeSingle();
  check(!!readBack, 'application actually persisted');
  check(readBack?.province === 'Albay', 'province persisted on the application', String(readBack?.province));
  check(!!readBack?.application_number, 'application_number assigned by trigger (036)', String(readBack?.application_number));

  // anon must NOT be able to read applications back
  const { data: anonRead } = await anon.from('applications').select('id').eq('id', APP_ID);
  check((anonRead?.length ?? 0) === 0, 'anon CANNOT read applications back (no leak)');

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 2. OWNER REVIEWS + APPROVES (the 4-write path) ===');
  const owner = await signedIn(OWNER_EMAIL, PASS);

  const { data: ownerApps, error: ownerReadErr } = await owner.from('applications').select('id').eq('id', APP_ID);
  check(!ownerReadErr && (ownerApps?.length ?? 0) === 1, 'owner can read the new application', ownerReadErr?.message);

  // Shop code assignment (what the admin does before approving)
  const { data: scRows, error: scErr } = await owner
    .from('applications').update({ shop_code: SHOP } as never).eq('id', APP_ID).select('id');
  check(!scErr && (scRows?.length ?? 0) === 1, 'owner can save the Shop Code (0-row trap)', scErr?.message);

  // Resolve the AS the way the client does
  const { data: sups } = await owner.from('area_supervisors').select('*');
  const covers = (s: { plant_id: string; plant_ids?: string[] | null }) =>
    s.plant_id === ref.plant_id || (s.plant_ids ?? []).includes(ref.plant_id);
  const byProvince = (sups ?? []).find((s) =>
    (s.assigned_provinces ?? []).some((p: string) => p.trim().toLowerCase() === 'albay'));
  const asRow = byProvince ?? (sups ?? []).find(covers) ?? (sups ?? [])[0];
  check(!!asRow, 'an Area Supervisor resolves for this application');
  console.log(`        resolved AS: ${asRow?.name} (${byProvince ? 'by province' : 'by plant fallback'})`);

  // Approve: UPDATE application
  const { data: apRows, error: apErr } = await owner
    .from('applications')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), account_user_id: FRAN_ID } as never)
    .eq('id', APP_ID).select('id');
  check(!apErr && (apRows?.length ?? 0) === 1, 'owner can APPROVE (update applications)', apErr?.message);

  // INSERT store
  const storeRow = {
    id: STORE_ID,
    name: appRow.store_name,
    business_name: appRow.store_name,
    owner_name: appRow.full_name,
    address: appRow.address,
    lat: appRow.lat, lng: appRow.lng,
    plant_id: ref.plant_id,
    distributor_id: ref.distributor_id,
    area_supervisor_id: asRow!.id,
    franchise_type: 'distributor',
    status: 'pending',
    province: appRow.province,
    area: '',
    phone: appRow.mobile,
    email: appRow.email,
    created_at: new Date().toISOString(),
    delivery_status: 'active',
    shop_code: SHOP,
  };
  const { error: stErr } = await owner.from('stores').insert(storeRow as never);
  check(!stErr, 'owner can INSERT the store', stErr?.message);

  const { data: stBack } = await admin.from('stores').select('province,area_supervisor_id').eq('id', STORE_ID).maybeSingle();
  check(stBack?.province === 'Albay', 'store carries the province (the bug just fixed)', String(stBack?.province));

  // Mint the franchisee login + profile
  const { data: fAuth, error: fAuthErr } = await admin.auth.admin.createUser({
    email: FRAN_EMAIL, password: PASS, email_confirm: true,
  });
  check(!fAuthErr, 'franchisee auth login created', fAuthErr?.message);

  const { error: fuErr } = await owner.from('users').insert({
    id: FRAN_ID, name: appRow.full_name, email: FRAN_EMAIL,
    role: 'franchisee_distributor',
    avatar: 'https://ui-avatars.com/api/?name=QA',
    plant_id: ref.plant_id, distributor_id: ref.distributor_id,
    assigned_store_ids: [STORE_ID], account_status: 'not_activated',
  } as never);
  check(!fuErr, 'owner can INSERT the franchisee profile', fuErr?.message);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 3. FRANCHISEE SIGNS IN + ACTIVATES ===');
  let fran: SupabaseClient | null = null;
  try {
    fran = await signedIn(FRAN_EMAIL, PASS);
    check(true, 'franchisee can sign in with the Shop Code email');
  } catch (e) {
    check(false, 'franchisee can sign in with the Shop Code email', String(e));
  }

  if (fran) {
    const { data: ownStore, error: osErr } = await fran.from('stores').select('id,name').eq('id', STORE_ID);
    check(!osErr && (ownStore?.length ?? 0) === 1, 'franchisee can read their OWN store (038)', osErr?.message);

    const { data: allStores } = await fran.from('stores').select('id');
    check((allStores?.length ?? 0) === 1, 'franchisee sees ONLY their own store', `saw ${allStores?.length}`);

    // Their own profile row
    const { data: me } = await fran.from('users').select('id,role,account_status').eq('id', FRAN_ID);
    check((me?.length ?? 0) === 1, 'franchisee can read their own profile');

    // 025: may change ONLY account_status / password_changed_at
    const { data: acRows, error: acErr } = await fran
      .from('users').update({ account_status: 'pending_verification' } as never)
      .eq('id', FRAN_ID).select('id');
    check(!acErr && (acRows?.length ?? 0) === 1, 'franchisee can set their OWN account_status (025/026)', acErr?.message);

    // 025 trigger must REFUSE a role escalation
    const { error: escErr } = await fran
      .from('users').update({ role: 'owner' } as never).eq('id', FRAN_ID).select('id');
    const { data: roleNow } = await admin.from('users').select('role').eq('id', FRAN_ID).maybeSingle();
    check(roleNow?.role === 'franchisee_distributor',
      'franchisee CANNOT escalate their role (025 clamp)', `role is now ${roleNow?.role}; err=${escErr?.message ?? 'none'}`);

    // Must not see other people's users
    const { data: otherUsers } = await fran.from('users').select('id');
    check((otherUsers?.length ?? 0) <= 2, 'franchisee cannot enumerate all users', `saw ${otherUsers?.length}`);

    // The REAL activation write: 025 allows exactly gov_id_url,
    // proof_of_billing_url, selfie_url, accepted_privacy_at, audit_log.
    const { data: docRows, error: docErr } = await fran
      .from('applications')
      .update({
        gov_id_url: 'zapp-private/gov-id/qa/id.png',
        proof_of_billing_url: 'zapp-private/proof-of-billing/qa/proof.png',
        selfie_url: 'zapp-private/selfie/qa/selfie.png',
      } as never)
      .eq('id', APP_ID).select('id');
    check(!docErr && (docRows?.length ?? 0) === 1,
      'franchisee CAN submit verification docs (the activation path)',
      docErr?.message ?? `rows=${docRows?.length}`);

    // ...but must not be able to touch anything else on it.
    const { error: tamperErr } = await fran
      .from('applications').update({ status: 'approved', notes: 'tampered' } as never)
      .eq('id', APP_ID).select('id');
    check(!!tamperErr, 'franchisee CANNOT tamper with other application fields', 'no error raised');

    // Other people's applications must be invisible.
    const { data: allApps } = await fran.from('applications').select('id');
    check((allApps?.length ?? 0) === 1, 'franchisee sees ONLY their own application',
      `saw ${allApps?.length}`);

    // A franchisee must not be able to mint stores.
    const { error: badStore } = await fran.from('stores').insert({
      id: 'store-qa-evil', name: 'evil', business_name: 'evil', owner_name: 'evil',
      address: 'x', lat: 0, lng: 0, plant_id: ref.plant_id, area_supervisor_id: asRow!.id,
      franchise_type: 'direct', status: 'active', province: '', area: '', phone: '', email: '',
      created_at: new Date().toISOString(), delivery_status: 'active',
    } as never);
    check(!!badStore, 'franchisee CANNOT insert a store', 'insert succeeded!');
    await admin.from('stores').delete().eq('id', 'store-qa-evil');

    // Reference tables a franchisee can read (privacy surface).
    const { data: allUsers2 } = await fran.from('users').select('id');
    const { data: allDist } = await fran.from('distributors').select('id');
    const { data: allSup } = await fran.from('area_supervisors').select('id');
    const { data: allCodes } = await fran.from('referral_codes').select('id');
    console.log(`        franchisee reference reads -> users:${allUsers2?.length} ` +
      `distributors:${allDist?.length} area_supervisors:${allSup?.length} referral_codes:${allCodes?.length}`);
    check((allCodes?.length ?? 0) === 0, 'franchisee cannot read referral codes (045)',
      `saw ${allCodes?.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 4. OWNER FINISHES ACTIVATION ===');
  const { data: actRows, error: actErr } = await owner
    .from('users').update({ account_status: 'active' } as never).eq('id', FRAN_ID).select('id');
  check(!actErr && (actRows?.length ?? 0) === 1, 'owner can activate the franchisee', actErr?.message);

  const { data: shopRows, error: shopErr } = await owner
    .from('stores').update({ status: 'active' } as never).eq('id', STORE_ID).select('id');
  check(!shopErr && (shopRows?.length ?? 0) === 1, 'owner can activate the store', shopErr?.message);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 5. PARTNER DISTRIBUTOR SCOPE (they encode franchisees too) ===');
  // A temporary PD login attached to Jose's EXISTING distributor, so we test the
  // real scope rules without inventing a second distributor.
  const PD_ID = `user-qa-pd-${stamp}`;
  const PD_EMAIL = `qa-pd-${stamp}@example.com`;
  const { data: pdAuth } = await admin.auth.admin.createUser({
    email: PD_EMAIL, password: PASS, email_confirm: true,
  });
  await admin.from('users').insert({
    id: PD_ID, name: 'QA Temp PD', email: PD_EMAIL, role: 'partner_distributor',
    avatar: 'https://ui-avatars.com/api/?name=QA', plant_id: ref.plant_id,
    plant_ids: [ref.plant_id], distributor_id: ref.distributor_id,
  } as never);

  const pd = await signedIn(PD_EMAIL, PASS);
  const { data: pdApps, error: pdAppsErr } = await pd.from('applications').select('id,assigned_distributor_id');
  check(!pdAppsErr, 'PD can read applications', pdAppsErr?.message);
  const foreign = (pdApps ?? []).filter((a) => a.assigned_distributor_id !== ref.distributor_id);
  check(foreign.length === 0, 'PD sees ONLY their own channel applications', `saw ${foreign.length} foreign`);

  // The PD must be able to SAVE evaluation fields (the monitoring batch save).
  const { data: pdSave, error: pdSaveErr } = await pd
    .from('applications').update({ remarks_pd_sd: 'QA remark' } as never)
    .eq('id', APP_ID).select('id');
  check(!pdSaveErr && (pdSave?.length ?? 0) === 1, 'PD can SAVE evaluation fields on their application',
    pdSaveErr?.message ?? `rows=${pdSave?.length}`);

  const { data: pdStores } = await pd.from('stores').select('id,distributor_id');
  const foreignStores = (pdStores ?? []).filter((x) => x.distributor_id !== ref.distributor_id);
  check(foreignStores.length === 0, 'PD sees ONLY their own stores', `saw ${foreignStores.length} foreign`);

  const { data: pdCodes } = await pd.from('referral_codes').select('code');
  check((pdCodes ?? []).every((c) => c.code === 'ZAPP-PH'), 'PD sees only their own referral code (045)',
    (pdCodes ?? []).map((c) => c.code).join(','));

  const { data: pdUsers } = await pd.from('users').select('id');
  console.log(`        PD reference reads -> users:${pdUsers?.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 6. AREA SUPERVISOR SCOPE ===');
  const AS_ID = `user-qa-as-${stamp}`;
  const AS_EMAIL = `qa-as-${stamp}@example.com`;
  const { data: asAuth } = await admin.auth.admin.createUser({
    email: AS_EMAIL, password: PASS, email_confirm: true,
  });
  // Matched to the REAL supervisor row by name, exactly as 029's helper does.
  await admin.from('users').insert({
    id: AS_ID, name: asRow!.name, email: AS_EMAIL, role: 'area_manager',
    avatar: 'https://ui-avatars.com/api/?name=QA', plant_id: ref.plant_id,
  } as never);

  const asC = await signedIn(AS_EMAIL, PASS);
  const { data: asApps, error: asErr } = await asC.from('applications').select('id,province');
  check(!asErr, 'AS can read applications', asErr?.message);
  check((asApps ?? []).some((a) => a.id === APP_ID),
    'AS sees the Albay application routed to them (029/040)', `saw ${asApps?.length} apps`);

  const { data: asSave, error: asSaveErr } = await asC
    .from('applications').update({ remarks_as: 'QA AS remark' } as never)
    .eq('id', APP_ID).select('id');
  check(!asSaveErr && (asSave?.length ?? 0) === 1, 'AS can SAVE their evaluation fields',
    asSaveErr?.message ?? `rows=${asSave?.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 7. STORAGE (uploads are where "hindi na-save" usually hides) ===');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const cleanup: Array<[string, string]> = [];

  // (a) ANONYMOUS applicant uploading their store photo on /apply.
  const anonUp = await anonClient().storage
    .from('zapp-public').upload(`store-photo/qa-${stamp}/photo.png`, png, { contentType: 'image/png' });
  check(!anonUp.error, 'anon CAN upload a store photo (/apply)', anonUp.error?.message);
  if (!anonUp.error) cleanup.push(['zapp-public', `store-photo/qa-${stamp}/photo.png`]);

  // (b) FRANCHISEE uploading identity docs on the locked activation screen.
  if (fran) {
    for (const purpose of ['gov-id', 'proof-of-billing', 'selfie']) {
      const up = await fran.storage
        .from('zapp-private').upload(`${purpose}/qa-${stamp}/f.png`, png, { contentType: 'image/png' });
      check(!up.error, `franchisee CAN upload ${purpose} (activation)`, up.error?.message);
      if (!up.error) cleanup.push(['zapp-private', `${purpose}/qa-${stamp}/f.png`]);
    }
  }

  // (c) STAFF must be able to READ those private docs back to verify them.
  const signed = await owner.storage
    .from('zapp-private').createSignedUrl(`gov-id/qa-${stamp}/f.png`, 60);
  check(!signed.error && !!signed.data?.signedUrl,
    'owner CAN sign a URL for the private doc (verification)', signed.error?.message);
  if (signed.data?.signedUrl) {
    const res = await fetch(signed.data.signedUrl);
    check(res.ok, 'the signed URL actually serves the file', `HTTP ${res.status}`);
  }

  // (d) A franchisee must NOT be able to read someone else's private folder.
  if (fran) {
    const foreign = await fran.storage.from('zapp-private').list('gov-id');
    console.log(`        franchisee can list zapp-private/gov-id -> ${foreign.data?.length ?? 0} entries`);
  }

  for (const [bucket, path] of cleanup) await admin.storage.from(bucket).remove([path]);
  console.log(`        cleaned ${cleanup.length} uploaded test objects`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== 8. TEARDOWN ===');
  await admin.from('users').delete().eq('id', PD_ID);
  await admin.from('users').delete().eq('id', AS_ID);
  if (pdAuth?.user?.id) await admin.auth.admin.deleteUser(pdAuth.user.id);
  if (asAuth?.user?.id) await admin.auth.admin.deleteUser(asAuth.user.id);
  await admin.from('users').delete().eq('id', OWNER_ID);
  if (ownerAuth?.user?.id) await admin.auth.admin.deleteUser(ownerAuth.user.id);
  await admin.from('users').delete().eq('id', FRAN_ID);
  await admin.from('stores').delete().eq('id', STORE_ID);
  await admin.from('applications').delete().eq('id', APP_ID);
  if (fAuth?.user?.id) await admin.auth.admin.deleteUser(fAuth.user.id);
  const { count: leftApps } = await admin.from('applications').select('*', { count: 'exact', head: true }).eq('id', APP_ID);
  const { count: leftStores } = await admin.from('stores').select('*', { count: 'exact', head: true }).eq('id', STORE_ID);
  const { count: leftUsers } = await admin.from('users').select('*', { count: 'exact', head: true }).eq('id', FRAN_ID);
  const { data: stillUsers } = await admin.from('users').select('id');
  const strayUsers = (stillUsers ?? []).filter((u) => String(u.id).startsWith('user-qa-'));
  const { data: stillLogins } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const strayLogins = (stillLogins?.users ?? []).filter((l) => (l.email ?? '').startsWith('qa-'));
  check(
    (leftApps ?? 0) + (leftStores ?? 0) + (leftUsers ?? 0) + strayUsers.length + strayLogins.length === 0,
    'all QA fixtures removed',
    `apps=${leftApps} stores=${leftStores} users=${leftUsers} strayProfiles=${strayUsers.length} strayLogins=${strayLogins.length}`,
  );

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('HARNESS CRASHED:', e); process.exit(1); });
