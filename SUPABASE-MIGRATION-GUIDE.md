# Supabase Migration Guide — Move ZAPP ERP to a New Supabase Account

> Goal: stand up the whole backend on a **new Supabase project** (new account),
> because the old project keeps auto-pausing on the free tier.
> Nothing is copied from the old DB — everything is **rebuilt from the repo**
> (5 migrations + auth seed + `npm run db:seed`), so it is fully reproducible.
>
> ⚠️ **Never paste API keys / passwords into chat.** They live only in
> `.env.local` (gitignored) and the Vercel env UI. This file is safe to commit
> because it contains no secrets.

---

## What gets rebuilt (and what does not)

| Layer | How it's recreated | Source |
|---|---|---|
| Schema (19 tables) | Run migrations 001→005 | `supabase/migrations/` |
| Table RLS + grants | Included in 002/003/005 | `supabase/migrations/` |
| Auth users (11 demo logins, pw `111111`) | Run the auth seed | `supabase/seed/01_demo_users.sql` |
| Entity data (stores, deliveries, etc.) | `npm run db:seed` | `scripts/seed-from-mock.ts` ← `src/data/mockData.ts` |
| Storage buckets (`zapp-public`, `zapp-private`) | **Manual** in dashboard (NOT in migrations) | see Step 5 |
| Storage read policies | Run migration 004 | `supabase/migrations/004_storage_rls.sql` |

> The only thing NOT recovered: any ad-hoc test rows you created by hand in the
> old DB after the last seed. The full demo dataset comes back.

---

## STEP 1 — Create the new project
1. Log into the **new Supabase account** → **New Project**.
2. Name: `zapp-donuts-erp` · Region: **Southeast Asia (Singapore)** ·
   Database password: use a strong one and **save it** (needed for DB admin).
3. Wait ~2 min for provisioning.

## STEP 2 — Grab the 3 keys (Settings → API)
- **Project URL** → `https://xxxxx.supabase.co`
- **anon / public** key
- **service_role** key (secret — `.env.local` only, never Vercel-public, never chat)

## STEP 3 — Run the SQL migrations (SQL Editor → New query → paste → Run)
Run these **in order**, one at a time, confirming success before the next:
1. `supabase/migrations/001_create_tables.sql`  → creates 19 tables
2. `supabase/migrations/002_permissive_rls.sql` → dev grants + permissive RLS
3. `supabase/migrations/003_role_scoped_rls.sql` → role-scoped RLS (46 policies)
4. `supabase/migrations/005_grant_service_role.sql` → grants for the seed script
   (004 comes AFTER buckets exist — see Step 6.)

## STEP 4 — Create the auth users
Run `supabase/seed/01_demo_users.sql` in the SQL Editor.
Verify under **Authentication → Users**: 11 rows, all password `111111`.

## STEP 5 — Create the two Storage buckets (Dashboard → Storage)
These are NOT in the migrations. Create both manually:
1. **`zapp-public`** — **Public** bucket ON (store photos; permanent public URLs).
2. **`zapp-private`** — **Public** bucket OFF (gov IDs, billing proofs, DR slips,
   crate photos, payment proofs; served via 1-hour signed URLs).

Then add permissive dev policies so uploads work. In **SQL Editor** run:
```sql
-- Allow authenticated + anon to INSERT/UPDATE/DELETE/SELECT during dev.
-- (004 tightens the SELECT afterwards.)
create policy allow_all_dev on storage.objects for all
  to anon, authenticated
  using (bucket_id in ('zapp-public','zapp-private'))
  with check (bucket_id in ('zapp-public','zapp-private'));
```

## STEP 6 — Tighten storage reads
Now run `supabase/migrations/004_storage_rls.sql` (replaces the permissive
SELECT with the scoped read policies; INSERT/UPDATE/DELETE stay open for dev).

## STEP 7 — Point the app at the new project (`.env.local`)
Edit `.env.local` (gitignored) — replace the old values:
```
VITE_SUPABASE_URL=<new project URL>
VITE_SUPABASE_ANON_KEY=<new anon key>
SUPABASE_SERVICE_ROLE_KEY=<new service_role key>   # local only
VITE_GEMINI_API_KEY=<leave as-is for now; being removed next session>
```
Then seed the entity data:
```
npm run db:seed
```
Expect: "Using service-role key" then per-table row counts, ending
"✅ Seed complete." (deliveries 38, forecasts 23, stores 26, users 11, …).

## STEP 8 — Update Vercel env vars (Production + Preview) → redeploy
In the Vercel project → Settings → Environment Variables, update:
- `VITE_SUPABASE_URL` → new URL
- `VITE_SUPABASE_ANON_KEY` → new anon key
- (Do NOT add the service_role key to Vercel.)
Then **Redeploy** (Deployments → latest → Redeploy; uncheck build cache).
`VITE_*` vars are baked at build time, so a redeploy is required.

## STEP 9 — Verify
- Local: `npm run dev` → `/login` → Quick Demo Login (Owner) → dashboard has data.
- Storage: open a payment proof / inventory photo → image renders (signed URL OK).
- Per-role: log in as `helen@zappdonuts.ph` (plant mgr) etc. → scoped data shows.
- Vercel: same checks on the deployed URL after redeploy.

---

## Gotchas
- **service_role key**: local `.env.local` ONLY. It bypasses RLS (full admin).
  Never commit it, never add to Vercel, never paste in chat.
- **Seeding fails with `42501 permission denied`** → migration 005 wasn't run
  (grants the seed's service_role the table privileges).
- **Buckets are manual** — migrations can't create them; Step 5 is required or
  uploads/renders break.
- **Old project**: it's only *paused* (resumable, lossless) — you can delete it
  later once the new one is verified, or keep it as a backup.
