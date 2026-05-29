import { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertOctagon,
  Image as ImageIcon,
  Bot,
  History,
  DollarSign,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Drawer,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  StatusBadge,
  ConfirmDialog,
  Modal,
  useToast,
} from '@/components/ui';
import type { EndingInventory, EndingInventoryCorrectionItem } from '@/types';
import {
  computeEndingInventory,
  type EndingInventoryComputation,
} from '@/lib/inventoryComputations';
import { useStorageUrl } from '@/lib/useStorageUrl';
import { CorrectionRequestForm } from './CorrectionRequestForm';

// Small wrapper so each crate ref can have its own useStorageUrl
// call without breaking the hook-rules constraint that hooks can't
// run inside a loop. Renders the resolved image or a placeholder
// tile while the signed URL is being fetched / if it fails.
function CrateImageTile({ refOrUrl, label }: { refOrUrl: string; label: string }) {
  const resolved = useStorageUrl(refOrUrl);
  return (
    <div className="aspect-square rounded-lg border border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center">
      {resolved ? (
        <img
          src={resolved}
          alt={label}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="text-center px-2 text-xs text-gray-500">
          <ImageIcon size={20} className="mx-auto mb-1 text-gray-400" />
          {label}
        </div>
      )}
    </div>
  );
}

interface Props {
  ei: EndingInventory | null;
  open: boolean;
  onClose: () => void;
}

const peso = (n: number): string =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const confidenceVariant = (
  level?: 'high' | 'medium' | 'low',
): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (level === 'high') return 'success';
  if (level === 'medium') return 'warning';
  if (level === 'low') return 'danger';
  return 'neutral';
};

const isTerminal = (status: EndingInventory['status']): boolean =>
  status === 'approved' || status === 'confirmed';

export function InventoryReviewDetailDrawer({ ei, open, onClose }: Props) {
  const stores = useStore((s) => s.stores);
  const deliveries = useStore((s) => s.deliveries);
  const demoUsers = useStore((s) => s.demoUsers);
  const currentUser = useStore((s) => s.currentUser);
  const approveEI = useStore((s) => s.approveEndingInventory);
  const flagEI = useStore((s) => s.markEndingInventoryNeedsReview);
  const requestCorrection = useStore((s) => s.requestEndingInventoryCorrection);
  const { addToast } = useToast();

  const [showApprove, setShowApprove] = useState(false);
  const [showNeedsReview, setShowNeedsReview] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [needsReviewComment, setNeedsReviewComment] = useState('');

  const store = ei ? stores.find((s) => s.id === ei.storeId) : null;
  const delivery = ei ? deliveries.find((d) => d.id === ei.deliveryId) : null;

  const computation: EndingInventoryComputation | null = useMemo(() => {
    if (!ei || !delivery || !store) return null;
    return computeEndingInventory(delivery.items, ei.unsoldItems, store.franchiseType);
  }, [ei, delivery, store]);

  const canAct =
    !!currentUser &&
    !!ei &&
    !isTerminal(ei.status) &&
    ['owner', 'partner_distributor', 'area_manager'].includes(currentUser.role);

  const onApprove = async () => {
    if (!ei || !currentUser) return;
    try {
      await approveEI(ei.id, currentUser.id);
      setShowApprove(false);
      addToast('success', `Approved: ${store?.name ?? 'inventory'} reconciled.`);
    } catch {
      addToast('error', 'Failed to approve inventory. Please try again.');
    }
  };

  const onFlagNeedsReview = async () => {
    if (!ei || !currentUser) return;
    const comment = needsReviewComment.trim();
    if (!comment) return;
    try {
      await flagEI(ei.id, currentUser.id, comment);
      setShowNeedsReview(false);
      setNeedsReviewComment('');
      addToast('success', 'Store notified for clarification.');
    } catch {
      addToast('error', 'Failed to flag inventory. Please try again.');
    }
  };

  const onSubmitCorrection = async (
    corrections: EndingInventoryCorrectionItem[],
    reason: string,
  ) => {
    if (!ei || !currentUser) return;
    try {
      await requestCorrection(ei.id, currentUser.id, corrections, reason);
      setShowCorrection(false);
      addToast(
        'success',
        `${corrections.length} correction${corrections.length === 1 ? '' : 's'} sent to store.`,
      );
    } catch {
      addToast('error', 'Failed to send correction request. Please try again.');
    }
  };

  const title = delivery ? `Inventory Review · ${delivery.drNumber}` : 'Inventory Review';

  return (
    <Drawer open={open} onClose={onClose} title={title} width="max-w-3xl">
      {ei && (
        <div className="space-y-5 pb-4">
          {/* Header strip */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Store</p>
              <p className="text-base font-semibold text-gray-900 truncate">
                {store?.name ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {store?.area || '—'}
                {' · '}
                {store?.franchiseType === 'distributor' ? 'Distributor Network' : 'Direct-to-Zapp'}
              </p>
            </div>
            <StatusBadge category="inventory_review" status={ei.status} />
          </div>

          {/* Quick info */}
          <Card>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase">EI Date</p>
                  <p className="font-medium text-gray-900">{ei.date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Submitted</p>
                  <p className="font-medium text-gray-900">
                    {ei.submittedAt
                      ? new Date(ei.submittedAt).toLocaleString('en-PH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">DR Number</p>
                  <p className="font-mono text-xs font-medium text-gray-900">
                    {delivery?.drNumber ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Last Reviewer</p>
                  <p className="font-medium text-gray-900">
                    {ei.reviewedBy
                      ? demoUsers.find((u) => u.id === ei.reviewedBy)?.name ?? ei.reviewedBy
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial preview */}
          {computation && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign size={16} /> Computed Financials
                  <span className="text-xs font-normal text-gray-500">
                    ({store?.franchiseType === 'direct' ? 'Direct franchise' : 'Distributor network'})
                  </span>
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase">Gross Sales</p>
                    <p className="font-semibold text-gray-900">{peso(computation.totals.grossSales)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase">DR Sold</p>
                    <p className="font-semibold text-gray-900">{peso(computation.totals.drSold)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase">DR Unsold</p>
                    <p className="font-semibold text-gray-900">{peso(computation.totals.drUnsold)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-700 uppercase">Store Profit</p>
                    <p className="font-semibold text-green-800">{peso(computation.storeProfit)}</p>
                  </div>
                  {computation.franchiseType === 'distributor' && (
                    <>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-700 uppercase">Remit to PD</p>
                        <p className="font-semibold text-orange-800">{peso(computation.remitToPD)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-xs text-amber-700 uppercase">PD Profit</p>
                        <p className="font-semibold text-amber-800">{peso(computation.pdProfit)}</p>
                      </div>
                      <div
                        className={
                          computation.packagingAllocation < 0
                            ? 'bg-red-50 rounded-lg p-3'
                            : 'bg-blue-50 rounded-lg p-3'
                        }
                      >
                        <p
                          className={
                            computation.packagingAllocation < 0
                              ? 'text-xs text-red-700 uppercase'
                              : 'text-xs text-blue-700 uppercase'
                          }
                        >
                          Packaging Allocation
                        </p>
                        <p
                          className={
                            computation.packagingAllocation < 0
                              ? 'font-semibold text-red-800'
                              : 'font-semibold text-blue-800'
                          }
                        >
                          {peso(computation.packagingAllocation)}
                          {computation.packagingAllocation < 0 && (
                            <span className="text-xs ml-1 font-normal">(overage)</span>
                          )}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-700 uppercase">Zapp Billing</p>
                    <p className="font-semibold text-purple-800">{peso(computation.zappBilling)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 italic">
                  Derived live from delivery items × unsold using spec formulas. Packaging cost not yet linked to this EI.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Per-SKU breakdown */}
          {computation && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Package size={16} /> Per-SKU Breakdown
                </h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-center">Delivered</th>
                        <th className="px-3 py-2 text-center">Unsold</th>
                        <th className="px-3 py-2 text-center">Sold</th>
                        <th className="px-3 py-2 text-right">Gross</th>
                        <th className="px-3 py-2 text-right">DR Sold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {computation.perSku.map((r) => (
                        <tr key={r.skuId}>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.skuName}</td>
                          <td className="px-3 py-2 text-center">{r.deliveredQty}</td>
                          <td className="px-3 py-2 text-center text-amber-700">{r.unsoldQty}</td>
                          <td className="px-3 py-2 text-center text-green-700">{r.soldQty}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(r.grossSales)}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(r.drValueSold)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Crate images */}
          {ei.crateImageUrls.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ImageIcon size={16} /> Crate Images ({ei.crateImageUrls.length})
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ei.crateImageUrls.map((url, idx) => (
                    <CrateImageTile
                      key={url}
                      refOrUrl={url}
                      label={`Crate ${idx + 1}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI audit log */}
          {ei.aiResults.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Bot size={16} /> AI Audit Log
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs">
                  {ei.aiResults.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 border-l-2 border-gray-200 pl-3 py-1"
                    >
                      <Badge variant={confidenceVariant(r.confidence)} size="sm">
                        {r.confidence}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {r.type === 'crate_estimate'
                            ? 'Crate Estimation'
                            : r.type === 'ocr_dr'
                              ? 'DR OCR Scan'
                              : 'Discrepancy Check'}
                          {r.skuName && (
                            <span className="text-gray-500 font-normal"> · {r.skuName}</span>
                          )}
                        </p>
                        <p className="text-gray-600">
                          {r.estimatedValue !== undefined && `Estimated: ${r.estimatedValue}`}
                          {r.extractedValue !== undefined && `Extracted: ${r.extractedValue}`}
                        </p>
                        {r.warning && (
                          <p className="text-amber-700 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={10} /> {r.warning}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Revision history */}
          {ei.revisions && ei.revisions.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <History size={16} /> Revision History
                </h3>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-xs">
                  {ei.revisions.map((rev) => (
                    <li key={rev.id} className="flex gap-3">
                      <div className="w-1 bg-gray-200 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">
                            {rev.action === 'submitted' && 'Submitted'}
                            {rev.action === 'resubmitted' && 'Resubmitted'}
                            {rev.action === 'approved' && 'Approved'}
                            {rev.action === 'needs_review' && 'Flagged for Review'}
                            {rev.action === 'correction_requested' && 'Correction Requested'}
                          </p>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-600">
                            {demoUsers.find((u) => u.id === rev.performedBy)?.name ??
                              rev.performedBy}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">
                            {new Date(rev.performedAt).toLocaleString('en-PH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        {rev.comment && <p className="text-gray-600 mt-1">{rev.comment}</p>}
                        {rev.reason && (
                          <p className="text-red-700 bg-red-50 rounded px-2 py-1 mt-1">
                            <span className="font-medium">Reason:</span> {rev.reason}
                          </p>
                        )}
                        {rev.corrections && rev.corrections.length > 0 && (
                          <div className="mt-2 bg-amber-50 rounded p-2">
                            <p className="text-amber-900 font-medium mb-1">
                              Requested corrections:
                            </p>
                            <table className="w-full">
                              <thead>
                                <tr className="text-amber-800">
                                  <th className="text-left font-medium">SKU</th>
                                  <th className="text-center font-medium">Submitted</th>
                                  <th className="text-center font-medium">Correct</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rev.corrections.map((c) => (
                                  <tr key={c.skuId}>
                                    <td className="text-amber-900">{c.skuName}</td>
                                    <td className="text-center text-amber-700">{c.submittedQty}</td>
                                    <td className="text-center font-bold text-amber-900">
                                      {c.correctedQty}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          {canAct && (
            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-white border-t border-gray-200 flex gap-3 justify-end flex-wrap">
              <Button
                variant="outline"
                iconLeft={<AlertCircle size={14} />}
                onClick={() => setShowNeedsReview(true)}
              >
                Mark Needs Review
              </Button>
              <Button
                variant="danger"
                iconLeft={<AlertOctagon size={14} />}
                onClick={() => setShowCorrection(true)}
              >
                Request Correction
              </Button>
              <Button
                variant="primary"
                iconLeft={<CheckCircle size={14} />}
                onClick={() => setShowApprove(true)}
              >
                Approve
              </Button>
            </div>
          )}

          {isTerminal(ei.status) && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle size={16} />
              This ending inventory has been approved. Approved submissions are final and feed
              downstream billing.
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showApprove}
        onClose={() => setShowApprove(false)}
        onConfirm={onApprove}
        title="Approve Ending Inventory"
        message={`Approve ending inventory for ${store?.name ?? 'this store'}? This action is final — approved inventories feed downstream billing and cannot be reverted.`}
        confirmLabel="Approve"
      />

      <CorrectionRequestForm
        open={showCorrection}
        onClose={() => setShowCorrection(false)}
        ei={ei}
        deliveryItems={delivery?.items ?? []}
        onSubmit={onSubmitCorrection}
      />

      <Modal open={showNeedsReview} onClose={() => setShowNeedsReview(false)} title="Mark as Needs Review">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Send the store a clarification request. They will be notified and can resubmit photos
            or quantities.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment for store <span className="text-red-500">*</span>
            </label>
            <textarea
              value={needsReviewComment}
              onChange={(e) => setNeedsReviewComment(e.target.value)}
              rows={4}
              placeholder="What needs clarification or additional verification?"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowNeedsReview(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!needsReviewComment.trim()}
              onClick={onFlagNeedsReview}
            >
              Send to Store
            </Button>
          </div>
        </div>
      </Modal>
    </Drawer>
  );
}
