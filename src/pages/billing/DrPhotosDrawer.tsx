// ============================================================
// DR Photos drawer (billing — view-only report verification +
// PD Request Revision — Phase B)
// ============================================================
// Opened from a per-DR row on the Billing page. Two audiences:
//   * billing_user — pulls up the Beginning DR slip + Beginning/Ending
//     donut-crate photos to double-check the store's reported inventory
//     (view-only, unchanged).
//   * partner_distributor — same photos PLUS a "Request Revision" section
//     where the PD enters the CORRECT beginning / ending donut counts for the
//     DR when the store's report looks wrong (Phase B). The corrected counts +
//     reason persist as a BillingRevision; once filed they show as a read-only
//     "Revision Requested" panel (also the foundation for the franchisee
//     dispute view in Phase D).

import { useState } from 'react';
import { ImageOff, PencilLine, Send } from 'lucide-react';
import { Drawer, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { useStorageUrl } from '@/lib/useStorageUrl';
import { computeRevisionBilling } from '@/lib/revisionBilling';
import type { BillingRevision, BillingRevisionItem } from '@/types';

const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// View-only thumbnail for a stored photo ref (private-bucket refs are re-signed
// on render via useStorageUrl). Its own component so the hook runs once per
// image instead of inside a bare .map(). Click opens the full-size image.
function StoragePhoto({ imageRef, alt }: { imageRef: string; alt: string }) {
  const url = useStorageUrl(imageRef);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
      title={alt}
    >
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <ImageOff size={20} />
        </div>
      )}
    </a>
  );
}

export interface DrPhotoTarget {
  deliveryId: string;
  drNumber: string;
  date: string;      // pre-formatted display string
  shopName: string;
}

// One editable SKU row in the revision form.
interface RevisionRow {
  skuId: string;
  skuName: string;
  begin: number;
  end: number;
}

// PD-only form: edit the corrected beginning / ending counts per SKU + a
// reason, then file a BillingRevision. Its own component (keyed on deliveryId
// by the parent) so its local state resets cleanly between DRs and there are no
// hook-ordering concerns with the parent's early return.
function RevisionForm({
  prefill,
  onSubmit,
}: {
  prefill: RevisionRow[];
  onSubmit: (rows: RevisionRow[], reason: string) => void;
}) {
  const [rows, setRows] = useState<RevisionRow[]>(prefill);
  const [reason, setReason] = useState('');

  const setQty = (skuId: string, field: 'begin' | 'end', value: string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setRows((rs) => rs.map((r) => (r.skuId === skuId ? { ...r, [field]: n } : r)));
  };

  const canSubmit = reason.trim().length > 0 && rows.length > 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Beginning</th>
              <th className="px-3 py-2 text-right font-medium">Ending (Unsold)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.skuId}>
                <td className="px-3 py-2 text-gray-900">{r.skuName}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.begin}
                    onChange={(e) => setQty(r.skuId, 'begin', e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.end}
                    onChange={(e) => setQty(r.skuId, 'end', e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Reason for revision <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Bakit mali ang report? (hal. hindi tugma ang bilang sa larawan / DR)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <Button
        variant="primary"
        iconLeft={<Send size={16} />}
        disabled={!canSubmit}
        onClick={() => onSubmit(rows, reason.trim())}
      >
        Submit Revision
      </Button>
    </div>
  );
}

interface DrPhotosDrawerProps {
  target: DrPhotoTarget | null;
  onClose: () => void;
}

export default function DrPhotosDrawer({ target, onClose }: DrPhotosDrawerProps) {
  const {
    beginningInventories,
    endingInventories,
    deliveries,
    skus,
    currentUser,
    billingRevisions,
    requestBillingRevision,
  } = useStore();
  const { addToast } = useToast();

  if (!target) {
    return <Drawer open={false} onClose={onClose} />;
  }

  // Evidence captured during inventory for this delivery. DR slip + crate photos
  // live on the Beginning Inventory; the Ending Inventory adds its own crates.
  const beginningInv = beginningInventories.find((bi) => bi.deliveryId === target.deliveryId);
  const endingInv = endingInventories.find((ei) => ei.deliveryId === target.deliveryId);
  const delivery = deliveries.find((d) => d.id === target.deliveryId);
  const drSlipRef = beginningInv?.drImageUrl;
  const beginningCratePhotos = beginningInv?.crateImageUrls ?? [];
  const endingCratePhotos = endingInv?.crateImageUrls ?? [];
  const hasPhotos =
    !!drSlipRef || beginningCratePhotos.length > 0 || endingCratePhotos.length > 0;

  // Revision state for this DR.
  const existingRevision = billingRevisions.find((r) => r.deliveryId === target.deliveryId);
  const canRevise = currentUser?.role === 'partner_distributor';

  // Prefill the form with the store's currently-reported counts: beginning
  // defaults to the confirmed beginning count (else the delivered DR qty), and
  // ending from the unsold count (else 0). Mirrors drReviewComputations so the
  // PD edits from the same numbers shown on the per-DR table.
  const nameOf = new Map<string, string>();
  for (const it of delivery?.items ?? []) nameOf.set(it.skuId, it.skuName);
  for (const it of beginningInv?.confirmedItems ?? []) if (it.skuName) nameOf.set(it.skuId, it.skuName);
  for (const it of endingInv?.unsoldItems ?? []) if (it.skuName) nameOf.set(it.skuId, it.skuName);

  const beginQty = new Map<string, number>();
  if (beginningInv) {
    for (const it of beginningInv.confirmedItems) {
      beginQty.set(it.skuId, (beginQty.get(it.skuId) ?? 0) + it.quantity);
    }
  } else {
    for (const it of delivery?.items ?? []) {
      beginQty.set(it.skuId, (beginQty.get(it.skuId) ?? 0) + it.quantity);
    }
  }
  const endQty = new Map<string, number>();
  for (const it of endingInv?.unsoldItems ?? []) {
    endQty.set(it.skuId, (endQty.get(it.skuId) ?? 0) + it.quantity);
  }

  const skuIds = new Set<string>([...beginQty.keys(), ...endQty.keys()]);
  const prefill: RevisionRow[] = [...skuIds].map((skuId) => ({
    skuId,
    skuName: nameOf.get(skuId) ?? skus.find((s) => s.id === skuId)?.name ?? skuId,
    begin: beginQty.get(skuId) ?? 0,
    end: endQty.get(skuId) ?? 0,
  }));

  const handleSubmitRevision = (rows: RevisionRow[], reason: string) => {
    if (!currentUser || !delivery) return;
    const toItems = (field: 'begin' | 'end'): BillingRevisionItem[] =>
      rows.map((r) => ({ skuId: r.skuId, skuName: r.skuName, quantity: field === 'begin' ? r.begin : r.end }));
    const correctedBeginning = toItems('begin');
    const correctedEnding = toItems('end');
    // Phase C — the positive DR-Sold-Value delta the store additionally owes.
    const { additionalAmount } = computeRevisionBilling(delivery, beginningInv, endingInv, {
      correctedBeginning,
      correctedEnding,
    });
    // id + requestedAt are stamped by the store action (keeps this component pure).
    try {
      requestBillingRevision({
        deliveryId: target.deliveryId,
        storeId: delivery.storeId,
        requestedBy: currentUser.id,
        reason,
        correctedBeginning,
        correctedEnding,
        status: 'requested',
        additionalAmount,
      });
      addToast('success', `Na-file ang revision para sa ${target.drNumber}.`);
    } catch {
      addToast('error', 'Hindi na-file ang revision. Pakisubukan ulit.');
    }
  };

  return (
    <Drawer open={!!target} onClose={onClose} title={`DR Photos — ${target.drNumber}`} width="max-w-xl">
      <div className="space-y-6">
        {/* Context header */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">DR Number</p>
            <p className="font-medium text-gray-900 font-mono">{target.drNumber}</p>
          </div>
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-900">{target.date}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">Shop</p>
            <p className="font-medium text-gray-900">{target.shopName}</p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          View-only evidence captured by the store for this DR. Use it to
          double-check that the store's reported inventory is correct.
        </p>

        {hasPhotos ? (
          <div className="space-y-4">
            {drSlipRef && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Beginning DR Slip</p>
                <div className="grid grid-cols-3 gap-2">
                  <StoragePhoto imageRef={drSlipRef} alt="Beginning DR slip" />
                </div>
              </div>
            )}

            {beginningCratePhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Beginning Crate Photos ({beginningCratePhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {beginningCratePhotos.map((ref, i) => (
                    <StoragePhoto key={`bi-${i}`} imageRef={ref} alt={`Beginning crate photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}

            {endingCratePhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Ending Crate Photos ({endingCratePhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {endingCratePhotos.map((ref, i) => (
                    <StoragePhoto key={`ei-${i}`} imageRef={ref} alt={`Ending crate photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
            <ImageOff size={22} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              Wala pang naka-upload na photo para sa DR na ito.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Lalabas dito ang Beginning DR slip at donut-crate photos kapag nag-submit
              na ng inventory ang store.
            </p>
          </div>
        )}

        {/* ── Request Revision (Phase B) ─────────────────────────── */}
        {(canRevise || existingRevision) && (
          <div className="border-t border-gray-200 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <PencilLine size={16} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Request Revision</h3>
            </div>

            {existingRevision ? (
              // Already filed → read-only panel (also the Phase D franchisee view).
              // Derive the additional amount live so pre-migration rows (no stored
              // snapshot) still show a correct figure.
              <RevisionSummary
                revision={existingRevision}
                additionalAmount={
                  existingRevision.additionalAmount ??
                  (delivery
                    ? computeRevisionBilling(delivery, beginningInv, endingInv, existingRevision)
                        .additionalAmount
                    : 0)
                }
              />
            ) : canRevise ? (
              <>
                <p className="mb-3 text-xs text-gray-500">
                  Kapag mali ang report ng store, ilagay dito ang TAMANG beginning /
                  ending na bilang ng donut para sa DR na ito. Ang correction ay
                  itatala bilang revision (hindi babaguhin ang orihinal na billing —
                  para may audit trail).
                </p>
                <RevisionForm
                  key={target.deliveryId}
                  prefill={prefill}
                  onSubmit={handleSubmitRevision}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// Read-only view of a filed revision — the corrected counts + reason + the
// additional amount due (Phase C). Shown to the PD after filing and (Phase D)
// to the franchisee whose report was revised.
function RevisionSummary({
  revision,
  additionalAmount,
}: {
  revision: BillingRevision;
  additionalAmount: number;
}) {
  const endBy = new Map(revision.correctedEnding.map((i) => [i.skuId, i.quantity]));
  const isDisputed = revision.status === 'disputed';
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {isDisputed ? 'Disputed by Store' : 'Revision Requested'}
        </span>
        <span className="text-xs text-amber-700">
          {new Date(revision.requestedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-xs text-amber-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Beginning</th>
              <th className="px-3 py-2 text-right font-medium">Ending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {revision.correctedBeginning.map((b) => (
              <tr key={b.skuId}>
                <td className="px-3 py-2 text-gray-900">{b.skuName}</td>
                <td className="px-3 py-2 text-right">{b.quantity}</td>
                <td className="px-3 py-2 text-right">{endBy.get(b.skuId) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2">
        <span className="text-xs font-medium text-amber-700">Additional Amount Due</span>
        <span className="text-sm font-semibold text-gray-900">{peso(additionalAmount)}</span>
      </div>
      <div>
        <p className="text-xs font-medium text-amber-700">Reason</p>
        <p className="text-sm text-gray-800">{revision.reason}</p>
      </div>
      {isDisputed && revision.disputeNote && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">Store's Dispute</p>
          <p className="text-sm text-gray-800">{revision.disputeNote}</p>
        </div>
      )}
    </div>
  );
}
