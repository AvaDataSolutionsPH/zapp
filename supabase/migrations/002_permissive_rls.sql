-- ============================================================
-- ZAPP Donuts ERP — Phase 2A Permissive RLS
-- ============================================================
--
-- Adds USING (true) RLS policies so the app can read/write all tables
-- during dev. Phase 3 replaces these with role-scoped policies (PD sees
-- own stores only, SPD view-only, area_manager scoped by area, etc.).
--
-- WHY THIS IS NEEDED:
--   Supabase project was created with "Enable automatic RLS" CHECKED,
--   so every new table has RLS enabled but no policies. Without a
--   policy, ALL queries return zero rows — even for owners. This file
--   unlocks read/write for both anon and authenticated roles.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → paste this file → Run.
--   Run AFTER 001_create_tables.sql.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'plants',
    'skus',
    'packaging_catalog',
    'distributors',
    'sub_partner_distributors',
    'area_supervisors',
    'users',
    'stores',
    'applications',
    'deliveries',
    'beginning_inventories',
    'ending_inventories',
    'payments',
    'packaging_orders',
    'forecasts',
    'referral_codes',
    'sales_metrics',
    'notifications',
    'special_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop existing policy if re-running
    EXECUTE format('DROP POLICY IF EXISTS allow_all_dev ON %I', tbl);

    -- Permissive: anyone can do anything. Phase 3 replaces this.
    EXECUTE format(
      'CREATE POLICY allow_all_dev ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl
    );

    RAISE NOTICE 'Permissive policy applied to %', tbl;
  END LOOP;
END $$;

-- Verify
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
