// ============================================================
// ZAPP Donuts ERP — "Endorsed to others", pure rules
// ============================================================
//
// Boss: a Partner Distributor gets an inquiry through their own referral code
// for somewhere they do not serve ("metro manila ang location"), and wants to
// pass it to the channel that does — "ang makakagawa lang nyan is yung PD lang
// mismo at applications na nakuha nya mismo", with sub-partners added to the
// list of possible recipients.
//
// Every permission decision lives here rather than in the page, so the store
// action and the UI cannot disagree about who may do what. Migration 048 is
// the third copy of these rules and the only one that actually enforces them —
// these two are the courtesy, RLS is the guarantee.
//
// ⚠️ AN ENDORSEMENT IS NOT A STATUS. The application stays `pending` the whole
// time: it has not been decided, only offered elsewhere. See EndorsementStatus
// in types for why folding the two together would have broken every status
// filter and left a declined endorsement nowhere to return to.

import type {
  Application,
  Distributor,
  SubPartnerDistributor,
  User,
} from '@/types';

/** Where an application sits in the hand-over dance. */
export type EndorsementState = 'none' | 'pending' | 'accepted' | 'declined';

export const endorsementState = (app: Application): EndorsementState =>
  app.endorsementStatus ?? 'none';

/**
 * Only a Partner Distributor, only on applications that came through their own
 * channel, and only while the application is still undecided.
 *
 * A declined endorsement deliberately does NOT block a new one — the sender
 * should be able to try a different channel rather than being stuck with an
 * inquiry nobody wanted. An accepted one does block it: the application is no
 * longer theirs to give away.
 */
export const canEndorse = (
  user: User | null | undefined,
  app: Application,
): boolean => {
  if (!user || user.role !== 'partner_distributor') return false;
  if (!user.distributorId || app.assignedDistributorId !== user.distributorId) return false;
  // Approving creates the store and the login; declining closes the inquiry.
  // Neither can be handed on afterwards.
  if (app.status !== 'pending' && app.status !== 'needs_more_info') return false;
  const state = endorsementState(app);
  return state === 'none' || state === 'declined';
};

/** The channel currently being asked to take an application on. */
export const isEndorsementTarget = (
  user: User | null | undefined,
  app: Application,
): boolean => {
  if (!user || app.endorsementStatus !== 'pending') return false;
  if (user.role === 'partner_distributor') {
    return !!user.distributorId && app.endorsedToDistributorId === user.distributorId;
  }
  if (user.role === 'sub_partner_distributor') {
    return (
      !!user.subPartnerDistributorId &&
      app.endorsedToSubPartnerDistributorId === user.subPartnerDistributorId
    );
  }
  return false;
};

/**
 * The PD who passed it on. True even after acceptance — that is the whole
 * point of keeping `endorsedByDistributorId`: the sender keeps a read-only
 * record instead of the application silently disappearing on them.
 */
export const isEndorsementSender = (
  user: User | null | undefined,
  app: Application,
): boolean =>
  !!user &&
  user.role === 'partner_distributor' &&
  !!user.distributorId &&
  app.endorsedByDistributorId === user.distributorId;

/**
 * The sender may withdraw an offer that nobody has answered yet.
 * Once accepted there is nothing to cancel — it belongs to someone else.
 */
export const canCancelEndorsement = (
  user: User | null | undefined,
  app: Application,
): boolean =>
  app.endorsementStatus === 'pending' &&
  isEndorsementSender(user, app) &&
  app.assignedDistributorId === user?.distributorId;

/**
 * ⚠️ Approving while an offer is outstanding would create the store and the
 * franchisee login under the SENDER's channel while the recipient is still
 * looking at it as theirs to take. Blocked until the endorsement resolves.
 */
export const blocksReview = (app: Application): boolean =>
  app.endorsementStatus === 'pending';

/** One option in the "Endorse to" dropdown. */
export interface EndorsementTarget {
  /** `pd:<id>` or `spd:<id>` — the dropdown's value. */
  key: string;
  kind: 'pd' | 'spd';
  id: string;
  name: string;
  /** Plant names, so the sender can pick the channel that serves the area. */
  plantNames: string[];
  /** For an SPD, the PD it sits under — shown so the sender knows the chain. */
  parentName?: string;
}

/**
 * Every channel an application can be passed to: other active Partner
 * Distributors, and active sub-partners (including the sender's own — handing
 * work down to your own SPD is a normal thing to want).
 *
 * The sender's own distributor is excluded: endorsing to yourself is a no-op
 * that would still consume the one-endorsement-at-a-time slot.
 */
export const endorsementTargets = (
  user: User | null | undefined,
  distributors: Distributor[],
  subPartners: SubPartnerDistributor[],
  plantName: (id: string) => string,
): EndorsementTarget[] => {
  const mine = user?.distributorId;
  const isActive = (s: string | undefined) => s !== 'inactive' && s !== 'suspended';

  const pds: EndorsementTarget[] = distributors
    .filter((d) => d.id !== mine && isActive(d.status))
    .map((d) => ({
      key: `pd:${d.id}`,
      kind: 'pd' as const,
      id: d.id,
      name: d.name,
      plantNames: plantsOf(d).map(plantName).filter(Boolean),
    }));

  const spds: EndorsementTarget[] = subPartners
    .filter((s) => isActive(s.status))
    .map((s) => ({
      key: `spd:${s.id}`,
      kind: 'spd' as const,
      id: s.id,
      name: s.name,
      plantNames: plantsOf(s).map(plantName).filter(Boolean),
      parentName: distributors.find((d) => d.id === s.parentDistributorId)?.name,
    }));

  return [...pds, ...spds].sort((a, b) => a.name.localeCompare(b.name));
};

/** Mirrors plantsServed() without importing it, to keep this module dependency-free. */
const plantsOf = (d: { plantId: string; plantIds?: string[] }): string[] =>
  d.plantIds && d.plantIds.length > 0 ? d.plantIds : [d.plantId];

/** Human label for a resolved endorsement, for banners and the audit trail. */
export const describeTarget = (
  app: Application,
  distributors: Distributor[],
  subPartners: SubPartnerDistributor[],
): string => {
  if (app.endorsedToSubPartnerDistributorId) {
    const s = subPartners.find((x) => x.id === app.endorsedToSubPartnerDistributorId);
    return s ? `${s.name} (Sub-Partner)` : 'Sub-Partner';
  }
  if (app.endorsedToDistributorId) {
    const d = distributors.find((x) => x.id === app.endorsedToDistributorId);
    return d?.name ?? 'Partner Distributor';
  }
  return '—';
};
