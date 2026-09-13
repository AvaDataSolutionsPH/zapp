// ============================================================
// ZAPP Donuts ERP — referral code validation against the LIVE database
// ============================================================
//
// 🔴 Replaces `referralService.validate` in services/api.ts, which matched the
// code against `src/data/mockData.ts` — the hardcoded seed array. That meant
// `/apply` accepted only the old demo codes and REJECTED every code the
// business actually created, so no real franchisee could apply. It also kept
// accepting demo codes that the operational reset had already deleted, which
// would stamp an application with a distributor that no longer exists.
//
// Validation goes through the `validate_referral_code` RPC (migration 044)
// rather than reading the table, for two reasons:
//   · an applicant is ANON, and 003's `ref_select` is `TO authenticated`, so a
//     direct read returns [] for exactly the people who need it;
//   · granting anon SELECT would let anyone enumerate every partner's channel
//     code — the one thing a referral code is supposed to keep private. The RPC
//     answers about ONE exact code you already know, and lists nothing.

import { supabase } from '@/lib/supabase';
import type { AreaSupervisor, Distributor, Plant, ReferralCode } from '@/types';

export interface ReferralValidation {
  valid: boolean;
  referral?: ReferralCode;
  distributor?: Distributor;
  subPartnerDistributor?: { id: string; name: string; plantId: string };
  areaSupervisor?: AreaSupervisor;
  plant?: Plant;
}

/** Codes are dictated by phone and retyped — be forgiving about case/spacing. */
const normalize = (code: string): string => code.trim().toUpperCase();

export async function validateReferralCodeLive(code: string): Promise<ReferralValidation> {
  const cleaned = normalize(code);
  if (!cleaned) return { valid: false };

  const { data, error } = await supabase.rpc('validate_referral_code', { p_code: cleaned });

  if (error) {
    // A missing function (migration 044 not run) must not read as "invalid
    // code" — that would send the applicant off to re-check a code that is
    // perfectly fine.
    throw new Error(
      `Hindi ma-verify ang referral code ngayon (${error.message}). Subukan ulit mamaya o kontakin ang ZAPP representative.`,
    );
  }

  if (!data) return { valid: false };

  const payload = data as {
    referral?: ReferralCode;
    distributor?: Distributor | null;
    subPartnerDistributor?: { id: string; name: string; plantId: string } | null;
    areaSupervisor?: AreaSupervisor | null;
    plant?: Plant | null;
  };
  if (!payload.referral) return { valid: false };

  return {
    valid: true,
    referral: payload.referral,
    distributor: payload.distributor ?? undefined,
    subPartnerDistributor: payload.subPartnerDistributor ?? undefined,
    areaSupervisor: payload.areaSupervisor ?? undefined,
    plant: payload.plant ?? undefined,
  };
}
