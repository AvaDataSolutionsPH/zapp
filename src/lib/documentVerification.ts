// ============================================================
// ZAPP Donuts ERP — document verification (pure)
// ============================================================
//
// "Each document should display its verification status: Not Uploaded /
// Uploaded / Verified / Rejected... Once all documents have been verified:
// Account Status → Active."
//
// The account gate hangs off this, so the rule for "all verified" lives in one
// tested place rather than being re-derived in the UI.

import type {
  Application,
  ApplicationDocumentKey,
  DocumentReview,
  DocumentStatus,
  UserRole,
} from '@/types';

/** The four documents, in the order the Documents section shows them. */
export const DOCUMENT_KEYS: ApplicationDocumentKey[] = [
  'storePhoto',
  'govId',
  'proofOfBilling',
  'selfie',
];

export const DOCUMENT_LABELS: Record<ApplicationDocumentKey, string> = {
  storePhoto: 'Store Picture',
  govId: 'Government-issued ID',
  proofOfBilling: 'Proof of Billing',
  selfie: 'Selfie Verification',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  not_uploaded: 'Not Uploaded',
  uploaded: 'Uploaded',
  verified: 'Verified',
  rejected: 'Rejected',
};

/** Where each document's file reference lives on the application. */
export const documentUrl = (
  app: Application,
  key: ApplicationDocumentKey,
): string | undefined => {
  switch (key) {
    case 'storePhoto':
      return app.storePhotoUrl;
    case 'govId':
      return app.govIdUrl;
    case 'proofOfBilling':
      return app.proofOfBillingUrl;
    case 'selfie':
      return app.selfieUrl;
  }
};

/**
 * A document's status.
 *
 * Presence is derived from the URL rather than stored: /apply writes '' for
 * documents it doesn't collect, and a stored "uploaded" flag would drift the
 * moment a file changed. Only verified/rejected are persisted.
 */
export const documentStatus = (
  app: Application,
  key: ApplicationDocumentKey,
): DocumentStatus => {
  if (!documentUrl(app, key)?.trim()) return 'not_uploaded';
  const review: DocumentReview | undefined = app.documentReviews?.[key];
  return review?.status ?? 'uploaded';
};

/** True only when every document has been verified — the gate to `active`. */
export const allDocumentsVerified = (app: Application): boolean =>
  DOCUMENT_KEYS.every((k) => documentStatus(app, k) === 'verified');

/** Documents still blocking activation, for the UI to name them. */
export const unverifiedDocuments = (app: Application): ApplicationDocumentKey[] =>
  DOCUMENT_KEYS.filter((k) => documentStatus(app, k) !== 'verified');

/**
 * Who may verify/reject a document and thereby activate an account.
 *
 * The spec's authorized list is "Partner Distributor, Sub Partner Distributor,
 * Area Supervisor, Area Manager, and Admin" — note Area Supervisor and Area
 * Manager are the same role here (`area_manager`, displayed as "Area
 * Supervisor"); the boss listed both names for the same person. Ops is included
 * as the Operations Supervisor of the module's RBAC table.
 *
 * A franchisee is deliberately absent: they must never verify their own
 * documents. RLS + 025's trigger enforce that server-side too.
 */
export const canVerifyDocuments = (role: UserRole | undefined): boolean =>
  role === 'owner' ||
  role === 'operations_manager' ||
  role === 'area_manager' ||
  role === 'partner_distributor' ||
  role === 'sub_partner_distributor';
