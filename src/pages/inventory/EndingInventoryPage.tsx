import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Camera,
  Save,
  CheckSquare,
  History,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Select,
  FileUpload,
  ConfirmDialog,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { uploadFile, buildObjectPath, deleteFile, parseStorageRef } from '@/services/storage';
import type { SelectOption, UploadedFile } from '@/components/ui';
import type { EndingInventory, InventoryItem } from '@/types';
import { InventoryReviewDetailDrawer } from './InventoryReviewDetailDrawer';

interface UnsoldRow {
  skuId: string;
  skuName: string;
  deliveredQty: number;
  unsoldQty: number;
  soldQty: number;
}

export default function EndingInventoryPage() {
  const {
    deliveries,
    stores,
    addEndingInventory,
    endingInventories,
    currentUser,
    resubmitEndingInventory,
  } = useStore();
  const { addToast } = useToast();

  // Deliveries eligible for a NEW ending inventory: delivered/reconciled AND
  // not already ended. Once an EI exists for a delivery it drops out of this
  // dropdown and lives in the "Ending Inventory History" table instead
  // (resubmits happen from there, not by re-selecting the delivery).
  const endedDeliveryIds = useMemo(
    () => new Set(endingInventories.map((ei) => ei.deliveryId)),
    [endingInventories],
  );

  const eligibleDeliveries = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          (d.status === 'delivered' || d.status === 'reconciled') &&
          !endedDeliveryIds.has(d.id),
      ),
    [deliveries, endedDeliveryIds],
  );

  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [unsoldRows, setUnsoldRows] = useState<UnsoldRow[]>([]);
  const [crateFiles, setCrateFiles] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resubmittingEI, setResubmittingEI] = useState<EndingInventory | null>(null);
  const [viewingEI, setViewingEI] = useState<EndingInventory | null>(null);

  const isFranchisee =
    currentUser?.role === 'franchisee_distributor' ||
    currentUser?.role === 'franchisee_direct';

  const myStoreIds = useMemo(
    () => currentUser?.assignedStoreIds ?? [],
    [currentUser],
  );

  const myEIs = useMemo(
    () =>
      endingInventories
        .filter((ei) => myStoreIds.includes(ei.storeId))
        .slice()
        .sort((a, b) =>
          (b.submittedAt ?? b.date).localeCompare(a.submittedAt ?? a.date),
        ),
    [endingInventories, myStoreIds],
  );

  // Look up from the full deliveries list — the "eligibleDeliveries" filter only
  // gates the new-submission dropdown. Once an EI exists (e.g. during resubmit),
  // the delivery's tracking status (in_transit / scheduled) is irrelevant.
  const delivery = deliveries.find((d) => d.id === selectedDeliveryId);
  const store = delivery ? stores.find((s) => s.id === delivery.storeId) : null;

  const deliveryOptions: SelectOption[] = [
    { value: '', label: 'Select a delivery...' },
    ...eligibleDeliveries.map((d) => ({
      value: d.id,
      label: `${d.drNumber} - ${stores.find((s) => s.id === d.storeId)?.name ?? d.storeId} (${d.date})`,
    })),
  ];

  // Initialize rows when delivery selected
  const handleDeliveryChange = (id: string) => {
    setSelectedDeliveryId(id);
    setCrateFiles([]);
    const del = eligibleDeliveries.find((d) => d.id === id);
    if (del) {
      setUnsoldRows(
        del.items.map((item) => ({
          skuId: item.skuId,
          skuName: item.skuName,
          deliveredQty: item.quantity,
          unsoldQty: 0,
          soldQty: item.quantity,
        })),
      );
    }
  };

  const updateUnsold = (skuId: string, unsold: number) => {
    setUnsoldRows((prev) =>
      prev.map((r) => {
        if (r.skuId !== skuId) return r;
        const clamped = Math.max(0, Math.min(unsold, r.deliveredQty));
        return {
          ...r,
          unsoldQty: clamped,
          soldQty: r.deliveredQty - clamped,
        };
      }),
    );
  };

  // Enter resubmit mode: pre-fill rows with reviewer's correctedQty when available.
  const enterResubmitMode = (ei: EndingInventory) => {
    const del = deliveries.find((d) => d.id === ei.deliveryId);
    if (!del) return;
    const latestCorrection = ei.revisions
      ?.slice()
      .reverse()
      .find((r) => r.action === 'correction_requested');
    const correctionsBySku = new Map<string, number>(
      latestCorrection?.corrections?.map((c) => [c.skuId, c.correctedQty]) ?? [],
    );

    setResubmittingEI(ei);
    setSelectedDeliveryId(del.id);
    setUnsoldRows(
      del.items.map((item) => {
        const submittedUnsold =
          ei.unsoldItems.find((u) => u.skuId === item.skuId)?.quantity ?? 0;
        const targetUnsold = correctionsBySku.get(item.skuId) ?? submittedUnsold;
        const clamped = Math.max(0, Math.min(targetUnsold, item.quantity));
        return {
          skuId: item.skuId,
          skuName: item.skuName,
          deliveredQty: item.quantity,
          unsoldQty: clamped,
          soldQty: item.quantity - clamped,
        };
      }),
    );
    setCrateFiles([]);
    setNotes('');
  };

  const cancelResubmit = () => {
    setResubmittingEI(null);
    setSelectedDeliveryId('');
    setUnsoldRows([]);
    setCrateFiles([]);
    setNotes('');
  };

  // Save (new submission or resubmit)
  const handleSave = async () => {
    if (!delivery || !currentUser) return;
    setSaveLoading(true);

    const uploadedRefs: string[] = [];

    try {
      const items: InventoryItem[] = unsoldRows.map((r) => ({
        skuId: r.skuId,
        skuName: r.skuName,
        quantity: r.unsoldQty,
        manualOverride: true,
      }));

      if (resubmittingEI) {
        // Resubmit only updates unsoldItems + status; the original
        // crate photos stay attached. No uploads needed here.
        await resubmitEndingInventory(
          resubmittingEI.id,
          items,
          currentUser.id,
          notes || undefined,
        );
        addToast('success', 'Ending inventory resubmitted for review.');
      } else {
        const id = `ei-${Date.now().toString(36)}`;
        const now = new Date().toISOString();

        // Upload crate photos to the private bucket before persisting
        // the EI row. Storage refs are stored in crate_image_urls;
        // the reviewer drawer resolves them to signed URLs at render
        // time via useStorageUrl.
        const crateUploads = await Promise.all(
          crateFiles
            .filter((f) => !!f.file)
            .map((f) =>
              uploadFile(
                'zapp-private',
                buildObjectPath('ei-crate', id, f.file),
                f.file,
              ),
            ),
        );
        for (const upload of crateUploads) uploadedRefs.push(upload.storageRef);

        addEndingInventory({
          id,
          deliveryId: delivery.id,
          storeId: delivery.storeId,
          date: now.slice(0, 10),
          crateImageUrls: crateUploads.map((u) => u.storageRef),
          unsoldItems: items,
          aiResults: [],
          status: 'pending_review',
          notes: notes || undefined,
          submittedAt: now,
          originalUnsoldItems: items,
          revisions: [
            {
              id: `eir-${Date.now().toString(36)}`,
              action: 'submitted',
              performedBy: currentUser.id,
              performedAt: now,
              comment: notes || undefined,
            },
          ],
        });
        addToast('success', 'Ending inventory submitted for review.');
      }

      setShowSave(false);
      setSubmitted(true);
    } catch {
      // Clean up any orphaned uploads from the new-submission path
      // so the bucket doesn't accumulate dead files.
      for (const ref of uploadedRefs) {
        const parsed = parseStorageRef(ref);
        if (parsed) {
          deleteFile(parsed.bucket, parsed.path).catch(() => undefined);
        }
      }
      addToast('error', 'Failed to save ending inventory. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Summaries
  const totalSold = unsoldRows.reduce((s, r) => s + r.soldQty, 0);
  const totalUnsold = unsoldRows.reduce((s, r) => s + r.unsoldQty, 0);
  const totalDelivered = unsoldRows.reduce((s, r) => s + r.deliveredQty, 0);

  if (submitted) {
    const wasResubmit = resubmittingEI !== null;
    return (
      <div className="p-6">
        <EmptyState
          icon={<CheckSquare size={28} />}
          title={wasResubmit ? 'Resubmitted for Review' : 'Submitted for Review'}
          description={
            wasResubmit
              ? `Your corrections for ${delivery?.drNumber} are now back in your reviewer's queue.`
              : `Your ending inventory for ${delivery?.drNumber} has been sent to your reviewer.`
          }
          actionLabel="Process Another"
          onAction={() => {
            setSubmitted(false);
            setResubmittingEI(null);
            setSelectedDeliveryId('');
            setUnsoldRows([]);
            setCrateFiles([]);
            setNotes('');
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ending Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Record unsold quantities and reconcile end-of-day inventory</p>
      </div>

      {/* My Submission History — franchisee-only */}
      {isFranchisee && myEIs.length > 0 && !resubmittingEI && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <History size={18} /> Ending Inventory History
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">EI Date</th>
                    <th className="px-3 py-2 text-left">DR Number</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myEIs.slice(0, 10).map((ei) => {
                    const drNumber = deliveries.find((d) => d.id === ei.deliveryId)?.drNumber;
                    const canResubmit = ei.status === 'correction_required';
                    return (
                      <tr key={ei.id}>
                        <td className="px-3 py-2 text-gray-900">{ei.date}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">
                          {drNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge category="inventory_review" status={ei.status} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-4">
                            <button
                              onClick={() => setViewingEI(ei)}
                              className="text-xs text-zapp-orange hover:underline inline-flex items-center gap-1"
                            >
                              <Eye size={12} /> View
                            </button>
                            {canResubmit && (
                              <button
                                onClick={() => enterResubmitMode(ei)}
                                className="text-xs text-red-700 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <RotateCcw size={12} /> Resubmit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resubmit banner */}
      {resubmittingEI && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
          <RotateCcw size={18} className="text-red-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm min-w-0">
            <p className="font-medium text-red-900">
              Resubmitting EI {resubmittingEI.id} ({delivery?.drNumber ?? '—'})
            </p>
            <p className="text-red-800 mt-0.5">
              Your reviewer's suggested quantities are pre-filled below. Adjust as needed, then submit for re-review. Original crate photos are preserved.
            </p>
          </div>
          <button
            onClick={cancelResubmit}
            className="text-xs text-red-700 hover:text-red-900 font-medium underline shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Select Delivery — hidden in resubmit mode (locked to existing) */}
      {!resubmittingEI && (
        <Card>
          <CardContent>
            <Select
              label="Select Delivery"
              options={deliveryOptions}
              value={selectedDeliveryId}
              onChange={(e) => handleDeliveryChange(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {delivery && unsoldRows.length > 0 && (
        <>
          {/* Delivery Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">DR Number</p>
              <p className="text-sm font-mono font-bold text-gray-900 mt-1">{delivery.drNumber}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Store</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{store?.name ?? '-'}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Total Delivered</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{totalDelivered}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">SKU Count</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{unsoldRows.length}</p>
            </div>
          </div>

          {/* Unsold Input Table */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardCheck size={18} /> Unsold Quantities
              </h2>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU Name</th>
                      <th className="px-3 py-2 text-center">Delivered</th>
                      <th className="px-3 py-2 text-center">Unsold</th>
                      <th className="px-3 py-2 text-center">Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unsoldRows.map((row) => (
                      <tr key={row.skuId} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {row.skuName}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{row.deliveredQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={row.deliveredQty}
                            value={row.unsoldQty}
                            onChange={(e) => updateUnsold(row.skuId, parseInt(e.target.value) || 0)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-zapp-orange"
                          />
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-green-700">{row.soldQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Upload Crate Images — hidden in resubmit mode; original photos preserved */}
          {!resubmittingEI && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Camera size={18} /> Upload End-of-Day Crate Images
                </h2>
              </CardHeader>
              <CardContent>
                <FileUpload
                  accept="image/*"
                  multiple
                  maxSizeMB={10}
                  camera
                  onChange={setCrateFiles}
                />
                {crateFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {crateFiles.map((f) =>
                      f.preview ? (
                        <img key={f.id} src={f.preview} alt="Crate" className="h-20 w-full object-cover rounded-lg border border-gray-200" />
                      ) : null,
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reconciliation Summary */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Save size={18} /> Save Reconciliation
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 uppercase">Total Delivered</p>
                  <p className="text-lg font-bold text-gray-900">{totalDelivered}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 uppercase">Total Sold</p>
                  <p className="text-lg font-bold text-green-700">{totalSold}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600 uppercase">Total Unsold</p>
                  <p className="text-lg font-bold text-amber-700">{totalUnsold}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this ending inventory..."
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                />
              </div>

              <Button
                variant="primary"
                iconLeft={resubmittingEI ? <RotateCcw size={16} /> : <Save size={16} />}
                onClick={() => setShowSave(true)}
                fullWidth
              >
                {resubmittingEI ? 'Resubmit Corrected Quantities' : 'Save Ending Inventory'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={showSave}
        onClose={() => setShowSave(false)}
        onConfirm={handleSave}
        title={resubmittingEI ? 'Resubmit Ending Inventory' : 'Save Ending Inventory'}
        message={
          resubmittingEI
            ? `Resubmit corrected quantities (${totalSold} sold / ${totalUnsold} unsold) back to your reviewer's queue?`
            : `Save ending inventory with ${totalSold} sold and ${totalUnsold} unsold items?`
        }
        confirmLabel={resubmittingEI ? 'Resubmit' : 'Save'}
        loading={saveLoading}
      />

      <InventoryReviewDetailDrawer
        ei={viewingEI}
        open={viewingEI !== null}
        onClose={() => setViewingEI(null)}
      />
    </div>
  );
}
