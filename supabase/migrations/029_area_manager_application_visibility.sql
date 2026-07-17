-- ============================================================
-- 029_area_manager_application_visibility.sql
-- ============================================================
-- BUG: an Area Supervisor sees ZERO applications ("wala nalabas na new
-- application sa area supv"), even ones in a province they cover.
--
-- ROOT CAUSE (two compounding faults, both confirmed against live data):
--
--   1. apps_select (003) scoped area_manager by
--        assigned_area_supervisor_id = ANY(app_area_ids())
--      where app_area_ids() is users.area_ids. But the seeded AS user carries
--      area_ids = {area-albay-01, area-albay-02} — those are NOT
--      area_supervisors ids (which are am-01, am-02, …), so the membership test
--      matches NOTHING for anyone.
--
--   2. Even with correct ids it would still be wrong: the client decides an
--      application's supervisor at READ time from the province master list
--      (effectiveAreaSupervisorId = resolveByProvince(province) ?? frozen id,
--      migration 023). A Sorsogon application with a NULL assigned_area_
--      supervisor_id resolves to the Sorsogon AS on the client — but RLS only
--      ever saw the frozen NULL column and filtered the row out before the
--      client could resolve it. The DB and the client disagreed on ownership,
--      and the DB (RLS) runs first, so the row never arrived.
--
-- FIX: make RLS compute ownership the SAME way the client does.
--
--   app_area_supervisor_id()      — the caller's area_supervisors row, matched
--                                    the way the client matches it: by id OR by
--                                    name (the users.id and area_supervisors.id
--                                    are different id spaces — user-09 vs am-01
--                                    — so name is the working link). ⚠️ Fragile
--                                    if two supervisors share a name; a real
--                                    users→area_supervisors FK is the proper
--                                    long-term fix.
--
--   app_area_owns_application()   — mirrors effectiveAreaSupervisorId exactly:
--                                    resolved := first AS whose assigned_provinces
--                                                covers the application's province;
--                                    owns     := COALESCE(resolved, frozen) = me.
--                                    So province coverage WINS over the frozen id
--                                    (re-pointing coverage re-scopes instantly),
--                                    and the frozen id is the fallback only when
--                                    no province coverage matches — identical to
--                                    the `??` on the client.
--
-- The old area_ids clause is left OR'd in (additive / regression-safe): it is
-- dead for the current data but would still honour any AS whose area_ids were
-- correctly seeded with am-* ids.
--
-- SELECT and UPDATE both move to the new test so an AS can also SAVE the
-- evaluation fields on the applications it can now see (otherwise it would read
-- a row it cannot write — a fresh inconsistency).
--
-- Idempotent. Run in Supabase BEFORE relying on AS visibility.
-- ============================================================

-- ── Which area_supervisor is the caller? (mirrors the client's id||name match)
CREATE OR REPLACE FUNCTION public.app_area_supervisor_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.area_supervisors s, public.users u
  WHERE u.email = (auth.jwt() ->> 'email')
    AND (s.id = u.id OR s.name = u.name)
  LIMIT 1
$$;

-- ── Does the caller own this application? (mirrors effectiveAreaSupervisorId)
CREATE OR REPLACE FUNCTION public.app_area_owns_application(p_province text, p_frozen_as text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me       text := public.app_area_supervisor_id();
  resolved text;
BEGIN
  IF me IS NULL THEN
    RETURN false;
  END IF;

  -- resolveAreaSupervisorForProvince: first AS whose assigned_provinces contains
  -- the province (case/whitespace-insensitive, same as the client).
  IF p_province IS NOT NULL AND btrim(p_province) <> '' THEN
    SELECT s.id INTO resolved
    FROM public.area_supervisors s
    WHERE EXISTS (
      SELECT 1 FROM unnest(s.assigned_provinces) prov
      WHERE lower(btrim(prov)) = lower(btrim(p_province))
    )
    LIMIT 1;
  END IF;

  -- effectiveAreaSupervisorId = resolved ?? frozen; owned iff it is me.
  RETURN COALESCE(resolved, p_frozen_as) = me;
END;
$$;

-- ── Recreate the two policies with the province-aware area_manager clause ────
DROP POLICY IF EXISTS apps_select ON applications;
CREATE POLICY apps_select ON applications FOR SELECT TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (
      public.app_role() = 'area_manager'
      AND (
        assigned_area_supervisor_id = ANY(public.app_area_ids())
        OR public.app_area_owns_application(province, assigned_area_supervisor_id)
      )
    )
  );

DROP POLICY IF EXISTS apps_update ON applications;
CREATE POLICY apps_update ON applications FOR UPDATE TO authenticated
  USING (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (
      public.app_role() = 'area_manager'
      AND (
        assigned_area_supervisor_id = ANY(public.app_area_ids())
        OR public.app_area_owns_application(province, assigned_area_supervisor_id)
      )
    )
  )
  WITH CHECK (
    (SELECT public.app_is_admin())
    OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
    OR (
      public.app_role() = 'area_manager'
      AND (
        assigned_area_supervisor_id = ANY(public.app_area_ids())
        OR public.app_area_owns_application(province, assigned_area_supervisor_id)
      )
    )
  );

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) — restore the 003 area_ids-only clause ─────────────────
-- DROP POLICY IF EXISTS apps_select ON applications;
-- CREATE POLICY apps_select ON applications FOR SELECT TO authenticated
--   USING (
--     (SELECT public.app_is_admin())
--     OR (public.app_role() = 'partner_distributor' AND assigned_distributor_id = public.app_distributor())
--     OR (public.app_role() = 'area_manager' AND assigned_area_supervisor_id = ANY(public.app_area_ids()))
--   );
-- (…same for apps_update…)
-- DROP FUNCTION IF EXISTS public.app_area_owns_application(text, text);
-- DROP FUNCTION IF EXISTS public.app_area_supervisor_id();
