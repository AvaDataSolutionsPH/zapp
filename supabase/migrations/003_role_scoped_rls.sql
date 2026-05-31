-- ============================================================
-- ZAPP Donuts ERP — Phase 3 Role-Scoped RLS
-- ============================================================
--
-- Replaces the dev-only `allow_all_dev` permissive policies (002) with
-- per-role rules that mirror the app's existing client-side scoping
-- (see src/store/useStore.ts getStoresForCurrentUser / *ForCurrentUser).
--
-- DESIGN PRINCIPLE — "RLS >= UI":
--   Every SELECT policy returns AT LEAST the rows the client already
--   shows for that role. The React UI then filters further. This avoids
--   "the screen is blank but the data exists" bugs. Where the client is
--   broader than store-scope (billing_user sees ALL payments, forecaster
--   sees ALL forecasts), the policy widens to match.
--
-- AUTH MAPPING:
--   There is no FK between auth.users (random UUID) and public.users
--   ("user-01", linked only by email in the client). RLS runs server-side,
--   so the helper functions below map the session's JWT email ->
--   public.users row to read role + scope columns. They are SECURITY
--   DEFINER so they can read public.users despite its own RLS (no recursion).
--
-- ANON:
--   Public pages (store directory, /apply) run on mock data while logged
--   out (dataSource='mock', DB writes skipped), so they never touch the DB.
--   These policies are TO authenticated only; anon matches no policy and is
--   denied. Table GRANTs from 001 stay; the policy is the gate.
--
-- SEEDING:
--   `npm run db:seed` (scripts/seed-from-mock.ts) must use the SERVICE_ROLE
--   key after this migration — the anon/authenticated key is now blocked by
--   these policies. The script prefers SUPABASE_SERVICE_ROLE_KEY from
--   .env.local (gitignored, local-only; never in client/Vercel). Service
--   role bypasses RLS entirely.
--
-- HOW TO RUN:
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Run AFTER 001 + 002.
--
-- HOW TO REVERT (restore open dev access):
--   Re-run 002_permissive_rls.sql. It drops these policies' siblings via
--   the same table list? NO — 002 only drops `allow_all_dev`. To fully
--   revert, run the "REVERT" block at the very bottom of this file
--   (commented out), then re-run 002.

-- ============================================================
-- 1. Helper functions (map JWT email -> role / scope)
-- ============================================================

-- Current session's profile columns, read from public.users by email.
CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.role FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_plant() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.plant_id FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_distributor() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.distributor_id FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_spd() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.sub_partner_distributor_id FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_area_ids() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(u.area_ids, '{}') FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_store_ids() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(u.assigned_store_ids, '{}') FROM public.users u WHERE u.email = (auth.jwt() ->> 'email') LIMIT 1
$$;

-- Role-class predicates.
CREATE OR REPLACE FUNCTION public.app_is_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT public.app_role() IN ('owner', 'operations_manager')
$$;

CREATE OR REPLACE FUNCTION public.app_is_viewonly() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT public.app_role() = 'sub_partner_distributor'
$$;

CREATE OR REPLACE FUNCTION public.app_is_reviewer() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT public.app_role() IN ('owner', 'operations_manager', 'area_manager', 'partner_distributor')
$$;

-- Canonical "store ids this session can see" — mirrors getStoresForCurrentUser.
CREATE OR REPLACE FUNCTION public.app_store_scope() RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.app_role()
    WHEN 'owner'                  THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'operations_manager'     THEN ARRAY(SELECT id FROM public.stores)
    WHEN 'plant_manager'          THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'forecaster'             THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'billing_user'           THEN ARRAY(SELECT id FROM public.stores WHERE plant_id = public.app_plant())
    WHEN 'partner_distributor'    THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
    WHEN 'franchisee_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE distributor_id = public.app_distributor())
    WHEN 'sub_partner_distributor' THEN ARRAY(SELECT id FROM public.stores WHERE sub_partner_distributor_id = public.app_spd())
    WHEN 'franchisee_direct'      THEN public.app_store_ids()
    WHEN 'area_manager'           THEN ARRAY(
                                      SELECT id FROM public.stores
                                      WHERE id = ANY(public.app_store_ids())
                                         OR area_supervisor_id = ANY(public.app_area_ids()))
    ELSE '{}'::text[]
  END
$$;

-- Authenticated clients must be able to call the helpers.
GRANT EXECUTE ON FUNCTION
  public.app_role(), public.app_plant(), public.app_distributor(),
  public.app_spd(), public.app_area_ids(), public.app_store_ids(),
  public.app_is_admin(), public.app_is_viewonly(), public.app_is_reviewer(),
  public.app_store_scope()
TO authenticated;

-- ============================================================
-- 2. Drop ALL existing policies (makes this script re-runnable)
--    Removes the permissive `allow_all_dev` AND any policies left over
--    from a partial earlier run, so re-running never hits "already exists".
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  tables TEXT[] := ARRAY[
    'plants','skus','packaging_catalog','distributors','sub_partner_distributors',
    'area_supervisors','users','stores','applications','deliveries',
    'beginning_inventories','ending_inventories','payments','packaging_orders',
    'forecasts','referral_codes','sales_metrics','notifications','special_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 3. Reference tables — read by ANY authenticated, write by admin
--    (catalog / org data the whole app needs: SKUs, plants, users, etc.)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  ref_tables TEXT[] := ARRAY[
    'plants','skus','packaging_catalog','distributors',
    'sub_partner_distributors','area_supervisors','users','referral_codes'
  ];
BEGIN
  FOREACH tbl IN ARRAY ref_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ref_select ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS ref_write  ON %I', tbl);

    EXECUTE format(
      'CREATE POLICY ref_select ON %I FOR SELECT TO authenticated USING (true)', tbl);
    EXECUTE format(
      'CREATE POLICY ref_write ON %I FOR ALL TO authenticated
         USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()))', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 4. Store-scoped entity tables
--    SELECT: store_id (or id) IN app_store_scope()
--    WRITE : same scope AND NOT view-only (SPD blocked)
--    DELETE: admin only
-- ============================================================

-- ── stores ────────────────────────────────────────────────────
CREATE POLICY stores_select ON stores FOR SELECT TO authenticated
  USING (id = ANY(public.app_store_scope()));
-- Reviewers create stores when approving applications.
CREATE POLICY stores_insert ON stores FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_is_reviewer()));
-- Owner/ops update any in-scope store; scoped roles update their own
-- (e.g. delivery_status via requestStopDelivery). SPD cannot write.
CREATE POLICY stores_update ON stores FOR UPDATE TO authenticated
  USING (id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  WITH CHECK (id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));
CREATE POLICY stores_delete ON stores FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ── deliveries ────────────────────────────────────────────────
CREATE POLICY deliveries_select ON deliveries FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()));
CREATE POLICY deliveries_write ON deliveries FOR ALL TO authenticated
  USING (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  WITH CHECK (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));

-- ── beginning_inventories ─────────────────────────────────────
CREATE POLICY bi_select ON beginning_inventories FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()));
CREATE POLICY bi_write ON beginning_inventories FOR ALL TO authenticated
  USING (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  WITH CHECK (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));

-- ── ending_inventories ────────────────────────────────────────
CREATE POLICY ei_select ON ending_inventories FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()));
CREATE POLICY ei_write ON ending_inventories FOR ALL TO authenticated
  USING (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  WITH CHECK (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));

-- ── packaging_orders ──────────────────────────────────────────
CREATE POLICY po_select ON packaging_orders FOR SELECT TO authenticated
  USING (store_id = ANY(public.app_store_scope()));
CREATE POLICY po_write ON packaging_orders FOR ALL TO authenticated
  USING (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()))
  WITH CHECK (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));

-- ── special_orders ────────────────────────────────────────────
CREATE POLICY so_select ON special_orders FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin()) OR store_id = ANY(public.app_store_scope()));
CREATE POLICY so_write ON special_orders FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())))
  WITH CHECK ((SELECT public.app_is_admin())
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())));

-- ── payments — billing_user sees & verifies ALL (matches PaymentsPage) ─
CREATE POLICY payments_select ON payments FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin())
         OR public.app_role() = 'billing_user'
         OR store_id = ANY(public.app_store_scope()));
CREATE POLICY payments_insert ON payments FOR INSERT TO authenticated
  WITH CHECK (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly()));
CREATE POLICY payments_update ON payments FOR UPDATE TO authenticated
  USING ((SELECT public.app_is_admin()) OR public.app_role() = 'billing_user'
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())))
  WITH CHECK ((SELECT public.app_is_admin()) OR public.app_role() = 'billing_user'
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())));
CREATE POLICY payments_delete ON payments FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ── forecasts — forecaster works across all stores (ForecastingPage) ──
CREATE POLICY forecasts_select ON forecasts FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin()) OR public.app_role() = 'forecaster'
         OR store_id = ANY(public.app_store_scope()));
CREATE POLICY forecasts_write ON forecasts FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin()) OR public.app_role() = 'forecaster'
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())))
  WITH CHECK ((SELECT public.app_is_admin()) OR public.app_role() = 'forecaster'
         OR (store_id = ANY(public.app_store_scope()) AND NOT (SELECT public.app_is_viewonly())));

-- ── sales_metrics — analytics; forecaster/admin read all, others scoped ─
CREATE POLICY sm_select ON sales_metrics FOR SELECT TO authenticated
  USING ((SELECT public.app_is_admin()) OR public.app_role() = 'forecaster'
         OR store_id = ANY(public.app_store_scope()));
CREATE POLICY sm_write ON sales_metrics FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));

-- ============================================================
-- 5. applications — reviewer-scoped
-- ============================================================
-- Owner/ops see all; PD sees its assigned applications; area_manager sees
-- applications routed to its supervisors. Public /apply is mock-only today,
-- so internal INSERTs come from reviewers.
CREATE POLICY apps_select ON applications FOR SELECT TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (public.app_role() = 'area_manager' AND assigned_area_supervisor_id = ANY(public.app_area_ids()))
  );
CREATE POLICY apps_insert ON applications FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_is_reviewer()));
CREATE POLICY apps_update ON applications FOR UPDATE TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (public.app_role() = 'area_manager' AND assigned_area_supervisor_id = ANY(public.app_area_ids()))
  )
  WITH CHECK (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (public.app_role() = 'area_manager' AND assigned_area_supervisor_id = ANY(public.app_area_ids()))
  );
CREATE POLICY apps_delete ON applications FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ============================================================
-- 6. notifications — broadcast or targeted by role / store
-- ============================================================
CREATE POLICY notif_select ON notifications FOR SELECT TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR target_role IS NULL
    OR target_role = public.app_role()
    OR target_store_id = ANY(public.app_store_scope())
  );
-- Many mutations fire notifications; any authenticated session may create one.
CREATE POLICY notif_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY notif_update ON notifications FOR UPDATE TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR target_role IS NULL
    OR target_role = public.app_role()
    OR target_store_id = ANY(public.app_store_scope())
  )
  WITH CHECK (
    (SELECT public.app_is_admin())
    OR target_role IS NULL
    OR target_role = public.app_role()
    OR target_store_id = ANY(public.app_store_scope())
  );
CREATE POLICY notif_delete ON notifications FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ============================================================
-- 7. Verify
-- ============================================================
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- REVERT BLOCK (uncomment + run, then re-run 002_permissive_rls.sql)
-- ============================================================
-- DO $$
-- DECLARE tbl TEXT; tables TEXT[] := ARRAY[
--   'plants','skus','packaging_catalog','distributors','sub_partner_distributors',
--   'area_supervisors','users','stores','applications','deliveries',
--   'beginning_inventories','ending_inventories','payments','packaging_orders',
--   'forecasts','referral_codes','sales_metrics','notifications','special_orders'];
-- pol RECORD;
-- BEGIN
--   FOREACH tbl IN ARRAY tables LOOP
--     FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
--     END LOOP;
--   END LOOP;
-- END $$;
-- DROP FUNCTION IF EXISTS public.app_store_scope, public.app_is_reviewer,
--   public.app_is_viewonly, public.app_is_admin, public.app_store_ids,
--   public.app_area_ids, public.app_spd, public.app_distributor,
--   public.app_plant, public.app_role;
