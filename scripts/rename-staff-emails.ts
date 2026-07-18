// ============================================================
// ZAPP Donuts ERP — Staff email domain rename (.ph → .com)
// ============================================================
//
// Renames the HQ staff demo logins from @zappdonuts.ph to @zappdonuts.com so the
// system matches the real ZAPP domain everywhere.
//
// ⚠️ WHY THIS NEEDS A SCRIPT AND NOT A FIND-AND-REPLACE
//
// An account's email lives in TWO layers that must ALWAYS agree:
//
//   1. auth.users.email    — the credential Supabase authenticates
//   2. public.users.email  — the profile carrying role + scope
//
// Every RLS helper in 003 resolves the caller as
// `WHERE u.email = auth.jwt() ->> 'email'`. Change one layer only and
// `app_role()` returns NULL → every policy denies → the user logs in to a blank
// screen. Worse, `login` force-signs-out a session whose profile it cannot find,
// so the account becomes unusable while looking fine in the dashboard.
//
// So each account is updated in BOTH layers, auth first: if the auth update
// fails we simply stop and nothing has drifted, whereas a failed profile update
// after a successful auth rename is reported loudly as a rift to repair by hand.
//
// ⚠️ SCOPE: the DEMO accounts only — HQ staff plus the demo partner/franchisee
// logins, which are seeded fiction and are all being replaced by real encoding
// anyway. Anything on example.com is a leftover TEST account queued for
// deletion, not something to rename.
//
// NOTE for real encoding: a real Partner Distributor is a separate BUSINESS and
// will bring its own company address (…@theircompany.com), and a real franchisee
// signs in with a SHOP CODE, not an email at all. So do not read this uniform
// .com demo set as the house rule for live data — it is only a tidy demo.
//
// Run AFTER deploying nothing / BEFORE nothing — it is self-contained. The
// matching source-side rename (mockData.ts + seed/01_demo_users.sql) is in the
// same commit, so a future `npm run db:seed` reproduces the .com addresses.
//
//     npx tsx scripts/rename-staff-emails.ts          # dry run: shows the plan
//     npx tsx scripts/rename-staff-emails.ts --yes    # actually renames
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS + admin API).
// NEVER commit the key or add it to Vercel.

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '✗ Missing env. Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NEW_DOMAIN = 'zappdonuts.com';

/**
 * Demo domains to fold into NEW_DOMAIN. The local part is kept as-is, so
 * `marco@bicolexpress.ph` becomes `marco@zappdonuts.com`.
 *
 * `example.com` is deliberately absent — those are TEST accounts to delete.
 */
const OLD_DOMAINS = [
  'zappdonuts.ph', // HQ staff
  'bicolexpress.ph', // PD Bicol
  'mmfoods.ph', // PD Manila
  'albaysouthdist.ph', // SPD
  'zapp.ph', // franchisee stores
];

const apply = process.argv.includes('--yes');

async function main() {
  console.log(`\nZAPP demo email rename — ${OLD_DOMAINS.map((d) => `@${d}`).join(', ')} → @${NEW_DOMAIN}`);
  console.log(`Project: ${url}`);
  console.log(apply ? 'Mode:    APPLY\n' : 'Mode:    DRY RUN (pass --yes to apply)\n');

  // The auth layer is the authority on which accounts exist at all.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('✗ Could not list auth users:', listErr.message);
    process.exit(1);
  }

  const targets = list.users.filter((u) => {
    const domain = u.email?.toLowerCase().split('@')[1] ?? '';
    return OLD_DOMAINS.includes(domain);
  });

  if (!targets.length) {
    console.log('Nothing to do — no demo account still uses an old domain.');
    return;
  }

  let renamed = 0;
  const rifts: string[] = [];

  for (const user of targets) {
    const oldEmail = user.email!.toLowerCase();
    const newEmail = `${oldEmail.split('@')[0]}@${NEW_DOMAIN}`;

    if (!apply) {
      console.log(`  would rename  ${oldEmail}  →  ${newEmail}`);
      continue;
    }

    // 1) Auth layer. email_confirm keeps the address usable immediately —
    //    without it a changed email can land unconfirmed and block sign-in.
    const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authErr) {
      console.error(`  ✗ ${oldEmail}: auth update failed — ${authErr.message} (skipped, no drift)`);
      continue;
    }

    // 2) Profile layer. A failure here leaves the two layers disagreeing, which
    //    is exactly the lockout this script exists to prevent — so try to put
    //    the auth address back, and if THAT fails too, report it loudly.
    const { error: profileErr } = await supabase
      .from('users')
      .update({ email: newEmail })
      .eq('email', oldEmail);

    if (profileErr) {
      const { error: revertErr } = await supabase.auth.admin.updateUserById(user.id, {
        email: oldEmail,
        email_confirm: true,
      });
      if (revertErr) {
        rifts.push(`${oldEmail} → auth is now ${newEmail} but public.users is still ${oldEmail}`);
        console.error(`  ✗✗ ${oldEmail}: profile update AND revert failed — MANUAL FIX NEEDED`);
      } else {
        console.error(`  ✗ ${oldEmail}: profile update failed (${profileErr.message}) — auth reverted`);
      }
      continue;
    }

    renamed += 1;
    console.log(`  ✓ ${oldEmail}  →  ${newEmail}`);
  }

  console.log(
    apply
      ? `\nDone. ${renamed}/${targets.length} renamed in both layers.`
      : `\nDry run only. ${targets.length} account(s) would be renamed.`,
  );

  if (rifts.length) {
    console.error('\n⚠️  LAYER RIFTS — these accounts CANNOT log in until fixed by hand:');
    rifts.forEach((r) => console.error(`   ${r}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ Unexpected failure:', err);
  process.exit(1);
});
