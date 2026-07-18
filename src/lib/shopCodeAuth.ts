// ============================================================
// ZAPP Donuts ERP — Shop Code as a login username (pure)
// ============================================================
//
// The spec says a franchisee's Username IS the Shop Code. Supabase Auth has no
// username login — it is email + password only (`signInWithPassword({ email,
// password })`). So we map the Shop Code onto a SYNTHETIC email in a namespace
// we own, and the login form converts whatever the franchisee typed before
// calling Supabase. The franchisee only ever sees/types the Shop Code.
//
// Why a subdomain: `@zappdonuts.com` is where real staff mail lives, so a shop
// login must never be able to collide with (or shadow) a real person's address.
// `shop.zappdonuts.com` is a namespace nothing else uses.
//
// ⚠️ Requires Supabase "Confirm email" to stay OFF (Authentication → Sign In /
// Providers → User Signups). These addresses receive no mail — a confirmation
// step would make every generated account unusable. That toggle is already off
// for the existing temp-password account creation; keep it off.
//
// ⚠️ CHANGING THIS CONSTANT DOES NOT RENAME EXISTING LOGINS. The address is
// stored inside Supabase `auth.users` at signUp time, so every account minted
// before a domain change keeps its OLD address forever — and since login maps
// Shop Code → email on the fly, the new mapping would miss those rows and the
// franchisee would be locked out with a plain "invalid credentials". That is why
// LEGACY_SHOP_LOGIN_DOMAINS exists and why `login` retries against it: the
// franchisee keeps typing the same Shop Code and neither knows nor cares which
// domain their account was created under.

/** Namespace for generated shop logins. Never a deliverable mailbox. */
export const SHOP_LOGIN_DOMAIN = 'shop.zappdonuts.com';

/**
 * Domains this namespace used BEFORE the current one, newest first. Accounts
 * created under these still authenticate — never delete an entry unless every
 * account minted under it is gone from `auth.users`.
 *
 * `shop.zappdonuts.ph` — used until 2026-07-19. Renamed to `.com` to match the
 * real ZAPP domain; staff kept reading the `.ph` address as a typo (or as a
 * link the applicant should visit, which it never was).
 */
export const LEGACY_SHOP_LOGIN_DOMAINS = ['shop.zappdonuts.ph'] as const;

/**
 * Shop Code → the email Supabase actually authenticates.
 * "MD 1234" and "md-1234" must resolve to the SAME login, so the code is
 * lowercased and any run of non-alphanumerics collapses to a single dash.
 * Returns null for a blank/unusable code — the caller must not invent a login.
 */
export const shopCodeToEmail = (shopCode: string | undefined): string | null => {
  const slug = shopCodeSlug(shopCode);
  return slug ? `${slug}@${SHOP_LOGIN_DOMAIN}` : null;
};

/** Shop Code → its normalized local part, or null when unusable. */
const shopCodeSlug = (shopCode: string | undefined): string | null =>
  shopCode
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;

/**
 * Every address one Shop Code could have been minted under — current domain
 * first, then each legacy domain. `login` tries them in order so an account
 * created before a domain rename still authenticates.
 */
export const shopCodeToEmailCandidates = (shopCode: string | undefined): string[] => {
  const slug = shopCodeSlug(shopCode);
  if (!slug) return [];
  return [SHOP_LOGIN_DOMAIN, ...LEGACY_SHOP_LOGIN_DOMAINS].map((d) => `${slug}@${d}`);
};

/**
 * True when an email is a generated shop login rather than a real address.
 * Legacy domains count — an account minted under the old namespace is still a
 * shop login, and callers use this to decide whether to show a Shop Code UI.
 */
export const isShopLoginEmail = (email: string | undefined): boolean => {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return [SHOP_LOGIN_DOMAIN, ...LEGACY_SHOP_LOGIN_DOMAINS].some((d) =>
    normalized.endsWith(`@${d}`),
  );
};

/**
 * What the user typed on the login form → the email to authenticate with.
 *
 * A franchisee types a Shop Code; staff type an email. They are told apart by
 * the "@": anything without one is treated as a Shop Code. This keeps ONE login
 * form for everyone, and means /onboarding partners — who created their account
 * with their own real email and chose their own password — keep signing in
 * exactly as before.
 */
export const resolveLoginEmail = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return shopCodeToEmail(trimmed) ?? trimmed.toLowerCase();
};

/**
 * Same as `resolveLoginEmail` but returns EVERY address worth trying, in order.
 *
 * A typed email is taken literally (one candidate) — staff know their own
 * address. A Shop Code fans out across the current + legacy domains, because
 * the franchisee cannot know which one their account was minted under.
 */
export const resolveLoginEmailCandidates = (input: string): string[] => {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return [trimmed.toLowerCase()];
  const candidates = shopCodeToEmailCandidates(trimmed);
  return candidates.length ? candidates : [trimmed.toLowerCase()];
};
