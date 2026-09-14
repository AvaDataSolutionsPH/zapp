// ============================================================
// ZAPP Donuts ERP — display-name shortening, pure
// ============================================================
//
// Boss: "Dito naman ilagay mo lang sa distributor is First Name tapos Surname
// initials lang. Example Jose B."
//
// A Partner Distributor's full legal name is not something every reader of a
// list needs. It identifies the channel well enough as "Jose B." — and on the
// store list, where the OWNER column often carries the very same person, the
// full name twice on one row was just noise.
//
// ⚠️ This is a DISPLAY transform only. Never store, search, or match on the
// result: two distributors called "Jose Benitua" and "Jose Bautista" both
// shorten to "Jose B." Anything that has to be unique must keep using the
// referral code or the id.

/**
 * "Jose Raymundo Benitua" → "Jose B."
 *
 * First given name plus the initial of the LAST name part. Middle names are
 * dropped — they are the part nobody reads.
 *
 * Degrades rather than mangles: a single-word name ("Zapp") comes back whole,
 * and blank input comes back blank, so a caller can still fall back to "-".
 *
 * ⚠️ It assumes a PERSON. A distributor registered under a company name
 * ("MM Foods Inc.") would shorten to "MM I.", which reads wrong — if the
 * business starts encoding company names, gate this on a name-kind flag rather
 * than trying to guess from the string.
 */
export const shortName = (full: string | undefined): string => {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const surname = parts[parts.length - 1];
  return `${parts[0]} ${surname[0].toUpperCase()}.`;
};
