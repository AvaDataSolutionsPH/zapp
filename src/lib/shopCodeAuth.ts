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
// Why a subdomain: `@zappdonuts.ph` is where real staff mail lives, so a shop
// login must never be able to collide with (or shadow) a real person's address.
// `shop.zappdonuts.ph` is a namespace nothing else uses.
//
// ⚠️ Requires Supabase "Confirm email" to stay OFF (Authentication → Sign In /
// Providers → User Signups). These addresses receive no mail — a confirmation
// step would make every generated account unusable. That toggle is already off
// for the existing temp-password account creation; keep it off.

/** Namespace for generated shop logins. Never a deliverable mailbox. */
export const SHOP_LOGIN_DOMAIN = 'shop.zappdonuts.ph';

/**
 * Shop Code → the email Supabase actually authenticates.
 * "MD 1234" and "md-1234" must resolve to the SAME login, so the code is
 * lowercased and any run of non-alphanumerics collapses to a single dash.
 * Returns null for a blank/unusable code — the caller must not invent a login.
 */
export const shopCodeToEmail = (shopCode: string | undefined): string | null => {
  const slug = shopCode
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${slug}@${SHOP_LOGIN_DOMAIN}` : null;
};

/** True when an email is a generated shop login rather than a real address. */
export const isShopLoginEmail = (email: string | undefined): boolean =>
  !!email?.trim().toLowerCase().endsWith(`@${SHOP_LOGIN_DOMAIN}`);

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
