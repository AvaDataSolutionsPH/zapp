-- ============================================================
-- 044_public_referral_validation.sql
-- ============================================================
-- ⚠️ MUST BE RUN IN SUPABASE. Pairs with the client change in the same commit.
--
-- 🔴 THE BUG THIS FIXES: **no real franchisee could apply at all.**
--
-- `/apply` validated the referral code against `src/data/mockData.ts` — the
-- hardcoded seed array — not against the database:
--
--     const ref = referralCodes.find((r) => r.code === code && r.status === 'active');
--
-- So the form accepted only the old demo codes (BICOL-MARCO, ZAPP-INT-001 …)
-- and REJECTED every code the business actually created through New Account
-- (MARX-CERILLANO-1SR, CHARISSE-JOYCE-C-ABF, JOSE-RAYMUNDO-BE-XTF) as "Invalid
-- or inactive referral code". The entire intake funnel was dead for real data.
--
-- It also hid a second, worse failure: the demo codes still VALIDATE from that
-- array even though the operational reset deleted them, so an application filed
-- under BICOL-MARCO would be stamped with `dist-01`, a distributor that no
-- longer exists.
--
-- ── WHY A FUNCTION AND NOT A POLICY ───────────────────────────────────────
-- Simply reading the table client-side is not possible for an applicant: 003's
-- `ref_select` is `TO authenticated`, so anon currently gets `[]` (verified).
-- The obvious fix — grant anon SELECT on referral_codes — would let anyone
-- enumerate EVERY partner's channel code, which is exactly the secret a code is
-- meant to be.
--
-- So validation is a lookup of ONE exact code, server-side. You must already
-- know the code to learn anything, and nothing can be listed. Same precedent as
-- `next_application_number()` in 036: SECURITY DEFINER, granted to anon,
-- because /apply is public by design.
--
-- Returns only what the form needs to route the application — no emails, no
-- phone numbers, no counts.
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'referral', jsonb_build_object(
      'id',                        r.id,
      'code',                      r.code,
      'type',                      r.type,
      'distributorId',             r.distributor_id,
      'subPartnerDistributorId',   r.sub_partner_distributor_id,
      'areaSupervisorId',          r.area_supervisor_id,
      'plantId',                   r.plant_id,
      'status',                    r.status,
      'createdAt',                 r.created_at,
      'usageCount',                r.usage_count
    ),
    'distributor', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id, 'name', d.name, 'plantId', d.plant_id, 'referralCode', d.referral_code
    ) END,
    'subPartnerDistributor', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'name', s.name, 'plantId', s.plant_id
    ) END,
    'areaSupervisor', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', a.id, 'name', a.name, 'plantId', a.plant_id
    ) END,
    'plant', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id, 'name', p.name, 'code', p.code, 'region', p.region, 'location', p.location
    ) END
  )
  FROM public.referral_codes r
  LEFT JOIN public.distributors              d ON d.id = r.distributor_id
  LEFT JOIN public.sub_partner_distributors  s ON s.id = r.sub_partner_distributor_id
  LEFT JOIN public.area_supervisors          a ON a.id = r.area_supervisor_id
  LEFT JOIN public.plants                    p ON p.id = r.plant_id
  -- Codes are dictated by phone and retyped, so match case-insensitively and
  -- ignore stray whitespace. The client normalises too; this is the backstop.
  WHERE upper(btrim(r.code)) = upper(btrim(p_code))
    AND r.status = 'active'
  LIMIT 1
$$;

-- /apply is public: an applicant is anon until their account is approved.
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ── REVERT (manual) ────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.validate_referral_code(text);
