// ============================================================
// ZAPP Donuts ERP — external link helpers (pure, no React)
// ============================================================

/**
 * Make a user-supplied link safe to use as an `href`.
 *
 * Applicants routinely paste a bare host ("facebook.com/juandelacruz") with no
 * protocol. A protocol-less href is resolved as a RELATIVE path by the browser
 * — `/applications/facebook.com/juandelacruz` — so the link silently 404s
 * inside the app instead of opening the external site. Prefixing https:// when
 * no scheme is present fixes that.
 *
 * Returns null for blank input so callers can render a placeholder.
 */
export const ensureHttpUrl = (link: string | undefined): string | null => {
  const trimmed = link?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
