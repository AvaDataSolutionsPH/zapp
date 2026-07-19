// ============================================================
// ZAPP Donuts ERP — Documents + verification
// ============================================================
//
// The spec is explicit: "Do not create a new page. Use the existing Documents
// section inside the Application Details page." So the four documents, their
// status and the verify/reject actions all live here, and the franchisee's
// first-login uploads simply appear as their URLs land on the application.
//
// Verifying the LAST document activates the account — that is the moment the
// franchisee gains ERP access, so the button says so.

import { useState } from 'react';
import {
  FileImage, IdCard, Receipt, Camera, CheckCircle2, XCircle, ImageOff, ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { useStorageUrl } from '@/lib/useStorageUrl';
import {
  DOCUMENT_KEYS,
  DOCUMENT_LABELS,
  DOCUMENT_STATUS_LABELS,
  allDocumentsVerified,
  canVerifyDocuments,
  documentStatus,
  documentUrl,
  unverifiedDocuments,
} from '@/lib/documentVerification';
import type { Application, ApplicationDocumentKey, DocumentStatus } from '@/types';

const ICONS: Record<ApplicationDocumentKey, React.ReactNode> = {
  storePhoto: <FileImage size={20} />,
  govId: <IdCard size={20} />,
  proofOfBilling: <Receipt size={20} />,
  selfie: <Camera size={20} />,
};

const STATUS_VARIANT: Record<DocumentStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  not_uploaded: 'neutral',
  uploaded: 'info',
  verified: 'success',
  rejected: 'danger',
};

/** One document. Private-bucket refs need re-signing, hence the per-tile hook. */
function DocumentTile({
  app,
  docKey,
  canVerify,
  onVerify,
  onReject,
  onPreview,
}: {
  app: Application;
  docKey: ApplicationDocumentKey;
  canVerify: boolean;
  onVerify: (k: ApplicationDocumentKey) => void;
  onReject: (k: ApplicationDocumentKey) => void;
  onPreview: (url: string, label: string) => void;
}) {
  const ref = documentUrl(app, docKey);
  const url = useStorageUrl(ref);
  const status = documentStatus(app, docKey);
  const review = app.documentReviews?.[docKey];
  const label = DOCUMENT_LABELS[docKey];
  const uploaded = status !== 'not_uploaded';

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        disabled={!url}
        onClick={() => url && onPreview(url, label)}
        className="group relative flex aspect-video w-full items-center justify-center bg-gray-50 transition-colors hover:border-zapp-orange disabled:cursor-default"
      >
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            {uploaded ? <ImageOff size={20} /> : ICONS[docKey]}
            <span className="text-xs">{uploaded ? 'Loading…' : 'Not uploaded'}</span>
          </div>
        )}
      </button>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          <Badge variant={STATUS_VARIANT[status]} size="sm">
            {DOCUMENT_STATUS_LABELS[status]}
          </Badge>
        </div>

        {/* A rejection is useless to the franchisee without the reason. */}
        {status === 'rejected' && review?.remarks && (
          <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {review.remarks}
          </p>
        )}
        {review?.reviewedByName && (
          <p className="text-[11px] text-gray-400">
            {status === 'verified' ? 'Verified' : 'Rejected'} by {review.reviewedByName}
          </p>
        )}

        {canVerify && uploaded && status !== 'verified' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onVerify(docKey)} iconLeft={<CheckCircle2 size={13} />}>
              Verify
            </Button>
            {status !== 'rejected' && (
              <Button variant="ghost" size="sm" onClick={() => onReject(docKey)} iconLeft={<XCircle size={13} />}>
                Reject
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentsSection({ application }: { application: Application }) {
  const { currentUser, reviewDocument } = useStore();
  const { addToast } = useToast();
  const [rejecting, setRejecting] = useState<ApplicationDocumentKey | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const canVerify = canVerifyDocuments(currentUser?.role);
  const allVerified = allDocumentsVerified(application);
  const pendingDocs = unverifiedDocuments(application);
  const verifiedCount = DOCUMENT_KEYS.length - pendingDocs.length;
  // "Verify all" only makes sense once there is something to look at in every
  // slot — it must never be a way to wave through missing documents.
  const allUploaded = DOCUMENT_KEYS.every((k) => !!documentUrl(application, k));

  const handleVerifyAll = async () => {
    setBusy(true);
    try {
      // Sequential, not Promise.all: each call re-reads the store to decide
      // whether THIS is the document that activates the account, and they would
      // race on that decision if fired together.
      for (const key of pendingDocs) {
        await reviewDocument(application.id, key, 'verified');
      }
      addToast('success', 'Na-verify lahat ng dokumento — aktibo na ang account.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not verify.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (key: ApplicationDocumentKey) => {
    setBusy(true);
    try {
      await reviewDocument(application.id, key, 'verified');
      addToast('success', `${DOCUMENT_LABELS[key]} verified.`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not verify.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting || !remarks.trim()) return;
    setBusy(true);
    try {
      await reviewDocument(application.id, rejecting, 'rejected', remarks);
      addToast('info', `${DOCUMENT_LABELS[rejecting]} rejected.`);
      setRejecting(null);
      setRemarks('');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not reject.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          {allVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
              <ShieldCheck size={14} /> All verified — account active
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOCUMENT_KEYS.map((key) => (
            <DocumentTile
              key={key}
              app={application}
              docKey={key}
              canVerify={canVerify && !busy}
              onVerify={handleVerify}
              onReject={setRejecting}
              onPreview={(url, label) => setPreview({ url, label })}
            />
          ))}
        </div>

        {/* Say exactly what is still blocking activation, rather than leaving
            the verifier to compare four badges.

            This block is deliberately loud. The per-document Verify button IS
            the activation trigger, but a reviewer looking at four uploaded
            documents asked "ano dapat mag trigger dito para ma-approve? wala na
            ibang button" — they were hunting for a single Approve control that
            does not exist. So: state the count, name what is left, and offer the
            one-click path when every document is at least uploaded. */}
        {canVerify && !allVerified && application.accountUserId && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {verifiedCount}/{DOCUMENT_KEYS.length} na-verify — hindi pa aktibo ang account.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              I-click ang <strong>Verify</strong> sa bawat dokumento. Awtomatikong mag-a-activate
              ang account (at magbubukas ang store) kapag na-verify na lahat. Natitira:{' '}
              <strong>{pendingDocs.map((k) => DOCUMENT_LABELS[k]).join(', ')}</strong>.
            </p>
            {allUploaded && (
              <Button
                className="mt-3"
                size="sm"
                variant="primary"
                loading={busy}
                iconLeft={<ShieldCheck size={15} />}
                onClick={handleVerifyAll}
              >
                I-verify lahat at i-activate
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Modal
        open={!!rejecting}
        onClose={() => !busy && setRejecting(null)}
        title={rejecting ? `Reject ${DOCUMENT_LABELS[rejecting]}` : ''}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tell the franchisee why this was rejected so they know what to re-submit.
          </p>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="e.g. Blurred photo — the ID number is unreadable."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-zapp-orange focus:outline-none focus:ring-2 focus:ring-zapp-orange/30"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busy}>
              Cancel
            </Button>
            {/* Remarks are mandatory — the spec requires a reason on rejection. */}
            <Button variant="danger" onClick={handleReject} loading={busy} disabled={!remarks.trim()}>
              Reject Document
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.label ?? ''} size="lg">
        {preview && <img src={preview.url} alt={preview.label} className="w-full rounded-lg" />}
      </Modal>
    </Card>
  );
}
