-- ============================================================
-- 040_province_canonical_match.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE. It pairs with a client change in the same commit
-- (`canonicalProvince` in src/lib/phRegions.ts, used by
-- resolveAreaSupervisorForProvince + provincesClaimedByOthers in
-- src/lib/applicationMonitoring.ts). Run it BEFORE/ALONGSIDE that deploy —
-- otherwise Postgres and the client go back to disagreeing on ownership, which
-- is the exact class of bug 029 fixed.
--
-- BUG: assigning "Metro Manila" to an Area Supervisor can NEVER match a Metro
-- Manila application.
--
-- ROOT CAUSE: the same province is stored under TWO spellings.
--   • The public /apply PSGC cascade injects NCR as **"Metro Manila (NCR)"**
--     (NCR_PROVINCE in src/services/phLocations.ts). NCR is a REGION, so the
--     PSGC /provinces/ endpoint omits it and we merge it in by hand — with the
--     "(NCR)" suffix so the applicant recognises it in the dropdown.
--   • The admin's Assign-Provinces master list writes **"Metro Manila"** (from
--     OPERATING_PROVINCES in src/lib/phRegions.ts).
--   Province matching — here and on the client — is an EXACT compare after
--   trim+lower, so "metro manila (ncr)" <> "metro manila" and the coverage row
--   never matches. Silent: no error, the AS just sees an empty queue.
--
-- WHY IT MATTERS AT THE DB LAYER: RLS RUNS FIRST. 029's
-- app_area_owns_application() decides whether the AS may even SELECT the row. If
-- Postgres drops it, no amount of client-side canonicalisation can bring it
-- back. The DB and the client must canonicalise IDENTICALLY.
--
-- FIX: one small helper, app_province_key(), that strips a single trailing
-- parenthetical suffix and then lower(btrim(...)) — the exact mirror of the
-- client's canonicalProvince(). app_area_owns_application() is redefined to
-- compare through it on BOTH sides (the application's province AND each entry of
-- area_supervisors.assigned_provinces).
--
-- REGRESSION-SAFE: app_province_key() is a pure no-op for every province name
-- WITHOUT a parenthetical — i.e. every Bicol province and every other entry of
-- OPERATING_PROVINCES. lower(btrim(x)) is preserved verbatim from 029, so for
-- all live data today this migration changes NOTHING; it only stops NCR from
-- silently failing when the business expands there. The regexp anchors on `$`
-- and forbids nested parens ([^()]*), so a name that merely CONTAINS parentheses
-- mid-string is untouched.
--
-- Function signature and behaviour of app_area_owns_application(text, text) are
-- unchanged, so the apps_select / apps_update policies created by 029 keep
-- working as-is and are NOT recreated here. CREATE OR REPLACE only.
--
-- Idempotent.
-- ============================================================

-- ── Canonical province comparison key (mirrors client canonicalProvince) ────
-- Strip ONE trailing "(...)" suffix, then trim + lowercase.
--   'Metro Manila (NCR)' -> 'metro manila'
--   'Metro Manila'       -> 'metro manila'
--   'Albay'              -> 'albay'          (no-op path)
CREATE OR REPLACE FUNCTION public.app_province_key(p_province text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(regexp_replace(COALESCE(p_province, ''), '\s*\([^()]*\)\s*$', '')))
$$;

-- ── Does the caller own this application? (mirrors effectiveAreaSupervisorId)
-- Identical to 029 except that the province compare now goes through
-- app_province_key() on both sides.
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
  key      text := public.app_province_key(p_province);
BEGIN
  IF me IS NULL THEN
    RETURN false;
  END IF;

  -- resolveAreaSupervisorForProvince: first AS whose assigned_provinces contains
  -- the province, compared on the canonical key (same as the client).
  IF key <> '' THEN
    SELECT s.id INTO resolved
    FROM public.area_supervisors s
    WHERE EXISTS (
      SELECT 1 FROM unnest(s.assigned_provinces) prov
      WHERE public.app_province_key(prov) = key
    )
    LIMIT 1;
  END IF;

  -- effectiveAreaSupervisorId = resolved ?? frozen; owned iff it is me.
  RETURN COALESCE(resolved, p_frozen_as) = me;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) — restore 029's raw lower(btrim(...)) compare ───────────
-- CREATE OR REPLACE FUNCTION public.app_area_owns_application(p_province text, p_frozen_as text)
-- RETURNS boolean
-- LANGUAGE plpgsql
-- STABLE
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   me       text := public.app_area_supervisor_id();
--   resolved text;
-- BEGIN
--   IF me IS NULL THEN RETURN false; END IF;
--   IF p_province IS NOT NULL AND btrim(p_province) <> '' THEN
--     SELECT s.id INTO resolved
--     FROM public.area_supervisors s
--     WHERE EXISTS (
--       SELECT 1 FROM unnest(s.assigned_provinces) prov
--       WHERE lower(btrim(prov)) = lower(btrim(p_province))
--     )
--     LIMIT 1;
--   END IF;
--   RETURN COALESCE(resolved, p_frozen_as) = me;
-- END;
-- $$;
-- DROP FUNCTION IF EXISTS public.app_province_key(text);
