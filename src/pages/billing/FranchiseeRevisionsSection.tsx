// ============================================================
// Franchisee billing — "Revision Requested" section + Dispute (Phase D)
// ============================================================
// Shown on the Billing page for a franchisee whose Partner Distributor filed a
// BillingRevision against one of their DRs. The franchisee can review the PD's
// corrected beginning/ending counts + the Additional Amount Due (Phase C), read
// the PD's reason, and — if they disagree — DISPUTE it with an explanation
// (status → 'disputed'). Self-contained (own store/toast hooks) so BillingPage
// only renders <FranchiseeRevisionsSection /> without extra wiring.

import { useState } from 'react';
import { AlertTriangle, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { computeRevisionBilling } from '@/lib/revisionBilling';
import type { BillingRevision } from '@/types';

const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function RevisionCard({ revision }: { revision: BillingRevision }) {
  const { deliveries, beginningInventories, endingInventories, disputeBillingRevision } = useStore();
  const { addToast } = useToast();
  const [showDispute, setShowDispute] = useState(false);
  const [note, setNote] = useState('');

  const delivery = deliveries.find((d) => d.id === revision.deliveryId);
  const beginningInv = beginningInventories.find((b) => b.deliveryId === revision.deliveryId);
  const endingInv = endingInventories.find((e) => e.deliveryId === revision.deliveryId);
  const additionalAmount =
    revision.additionalAmount ??
    (delivery ? computeRevisionBilling(delivery, beginningInv, endingInv, revision).additionalAmount : 0);

  const endBy = new Map(revision.correctedEnding.map((i) => [i.skuId, i.quantity]));
  const isDisputed = revision.status === 'disputed';

  const submitDispute = () => {
    if (!note.trim()) return;
    try {
      disputeBillingRevision(revision.id, note.trim());
      addToast('success', 'Na-submit ang iyong dispute. Ipapaalam sa distributor.');
      setShowDispute(false);
    } catch {
      addToast('error', 'Hindi na-submit ang dispute. Pakisubukan ulit.');
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-gray-900">
            {delivery?.drNumber ?? revision.deliveryId}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isDisputed ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isDisputed ? 'Disputed' : 'Revision Requested'}
          </span>
        </div>
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

      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
        <span className="text-xs font-medium text-amber-700">Additional Amount Due</span>
        <span className="text-sm font-semibold text-gray-900">{peso(additionalAmount)}</span>
      </div>

      <div>
        <p className="text-xs font-medium text-amber-700">Reason mula sa Distributor</p>
        <p className="text-sm text-gray-800">{revision.reason}</p>
      </div>

      {isDisputed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">Ang iyong dispute</p>
          <p className="text-sm text-gray-800">{revision.disputeNote}</p>
        </div>
      ) : showDispute ? (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ipaliwanag kung bakit hindi tama ang revision (hal. tama ang orihinal kong bilang, may resibo/larawan ako)."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={submitDispute} disabled={!note.trim()}>
              Submit Dispute
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDispute(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          iconLeft={<MessageSquareWarning size={16} />}
          onClick={() => setShowDispute(true)}
        >
          Dispute Billing
        </Button>
      )}
    </div>
  );
}

export default function FranchiseeRevisionsSection() {
  const { billingRevisions, currentUser } = useStore();
  const storeIds = new Set(currentUser?.assignedStoreIds ?? []);
  const myRevisions = billingRevisions.filter((r) => storeIds.has(r.storeId));

  if (myRevisions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-100/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">Revision mula sa Distributor</h2>
      </div>
      <p className="text-xs text-gray-600">
        Nag-file ang iyong distributor ng pagwawasto sa iyong report para sa mga DR na ito.
        Suriin ang tamang bilang at ang karagdagang babayaran. Kung hindi ka sang-ayon,
        maaari kang mag-dispute na may paliwanag.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {myRevisions.map((r) => (
          <RevisionCard key={r.id} revision={r} />
        ))}
      </div>
    </div>
  );
}
