import { useState } from 'react';
import {
  Truck,
  CheckCircle2,
  ClipboardList,
  ImageOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import {
  Drawer,
  Button,
  StatusBadge,
  Table,
  ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStorageUrl } from '@/lib/useStorageUrl';
import type { TableColumn } from '@/components/ui';
import type { Delivery, DeliveryItem } from '@/types';

// View-only thumbnail for a stored photo ref (private-bucket refs are
// re-signed on render via useStorageUrl). Kept as its own component so the
// hook runs once per image instead of inside a bare .map(). Clicking opens
// the full-size image in a new tab so franchisees can inspect the slip.
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

interface DeliveryDetailDrawerProps {
  delivery: Delivery | null;
  onClose: () => void;
}

export default function DeliveryDetailDrawer({ delivery, onClose }: DeliveryDetailDrawerProps) {
  const navigate = useNavigate();
  const { stores, plants, updateDelivery, beginningInventories, endingInventories } = useStore();
  const { addToast } = useToast();
  const [showMarkDelivered, setShowMarkDelivered] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!delivery) {
    return <Drawer open={false} onClose={onClose} />;
  }

  const store = stores.find((s) => s.id === delivery.storeId);
  const plant = plants.find((p) => p.id === delivery.plantId);

  // Evidence photos captured during inventory for this delivery (view-only
  // recall for franchisees). DR slip + crate photos live on the Beginning
  // Inventory; the Ending Inventory adds its own crate photos.
  const beginningInv = beginningInventories.find((bi) => bi.deliveryId === delivery.id);
  const endingInv = endingInventories.find((ei) => ei.deliveryId === delivery.id);
  const drSlipRef = beginningInv?.drImageUrl;
  const beginningCratePhotos = beginningInv?.crateImageUrls ?? [];
  const endingCratePhotos = endingInv?.crateImageUrls ?? [];
  const hasPhotos =
    !!drSlipRef || beginningCratePhotos.length > 0 || endingCratePhotos.length > 0;

  const handleMarkDelivered = async () => {
    setActionLoading(true);
    try {
      await updateDelivery(delivery.id, { status: 'delivered' });
      addToast(
        'success',
        `DR ${delivery.drNumber} marked as delivered to ${store?.name ?? 'store'}.`,
      );
      setShowMarkDelivered(false);
    } catch {
      addToast('error', 'Failed to mark delivery as delivered. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const itemColumns: TableColumn<DeliveryItem>[] = [
    {
      key: 'skuName',
      header: 'SKU',
      render: (row) => <span className="font-medium">{row.skuName}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (row) => row.quantity,
    },
    {
      key: 'drPrice',
      header: 'DR Price',
      render: (row) => `P${row.drPrice.toLocaleString()}`,
    },
    {
      key: 'srpPrice',
      header: 'SRP Price',
      render: (row) => `P${row.srpPrice.toLocaleString()}`,
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      render: (row) => `P${(row.quantity * row.drPrice).toLocaleString()}`,
    },
  ];

  // Timeline events based on status
  const timeline = [
    { label: 'Scheduled', completed: true, date: delivery.date },
    {
      label: 'In Transit',
      completed: ['in_transit', 'delivered', 'reconciled'].includes(delivery.status),
      date: delivery.status !== 'scheduled' ? delivery.date : undefined,
    },
    {
      label: 'Delivered',
      completed: ['delivered', 'reconciled'].includes(delivery.status),
      date: delivery.status === 'delivered' || delivery.status === 'reconciled' ? delivery.date : undefined,
    },
    {
      label: 'Reconciled',
      completed: delivery.status === 'reconciled',
      date: delivery.status === 'reconciled' ? delivery.date : undefined,
    },
  ];

  return (
    <>
      <Drawer
        open={!!delivery}
        onClose={onClose}
        title={`Delivery ${delivery.drNumber}`}
        width="max-w-xl"
      >
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Store</p>
              <p className="font-medium text-gray-900">{store?.name ?? '-'}</p>
            </div>
            <StatusBadge category="delivery" status={delivery.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Plant</p>
              <p className="font-medium text-gray-900">{plant?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-medium text-gray-900">{new Date(delivery.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500">DR Number</p>
              <p className="font-mono font-medium text-gray-900">{delivery.drNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">Items</p>
              <p className="font-medium text-gray-900">{delivery.items.length} SKUs</p>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h3>
            <Table
              columns={itemColumns}
              data={delivery.items}
              keyExtractor={(row) => row.skuId}
              emptyMessage="No items."
            />
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gray-50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">DR Total</span>
              <span className="font-semibold text-gray-900">P{delivery.totalDRCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">SRP Total</span>
              <span className="font-semibold text-gray-900">P{delivery.totalSRP.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-600">Margin</span>
              <span className="font-semibold text-green-700">
                P{(delivery.totalSRP - delivery.totalDRCost).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Delivery Photos (view-only evidence recall) */}
          {hasPhotos && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Delivery Photos</h3>

              {drSlipRef && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">DR Slip</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StoragePhoto imageRef={drSlipRef} alt="DR slip" />
                  </div>
                </div>
              )}

              {beginningCratePhotos.length > 0 && (
                <div className="mb-4">
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
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Status Timeline</h3>
            <div className="space-y-3">
              {timeline.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.completed
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <span className="text-xs font-medium">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${step.completed ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {step.date && step.completed && (
                      <p className="text-xs text-gray-500">{new Date(step.date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            {(delivery.status === 'scheduled' || delivery.status === 'in_transit') && (
              <Button
                variant="primary"
                iconLeft={<Truck size={16} />}
                onClick={() => setShowMarkDelivered(true)}
                fullWidth
              >
                Mark as Delivered
              </Button>
            )}
            {delivery.status === 'delivered' && (
              <Button
                variant="primary"
                iconLeft={<ClipboardList size={16} />}
                onClick={() => {
                  onClose();
                  navigate('/inventory/beginning');
                }}
                fullWidth
              >
                Begin Inventory Check
              </Button>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={showMarkDelivered}
        onClose={() => setShowMarkDelivered(false)}
        onConfirm={handleMarkDelivered}
        title="Mark as Delivered"
        message={`Mark delivery ${delivery.drNumber} to ${store?.name ?? 'store'} as delivered?`}
        confirmLabel="Confirm Delivery"
        loading={actionLoading}
      />
    </>
  );
}
