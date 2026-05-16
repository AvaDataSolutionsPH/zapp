import { useState, useMemo, useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type {
  DeliveryItem,
  EndingInventory,
  EndingInventoryCorrectionItem,
} from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  ei: EndingInventory | null;
  deliveryItems: DeliveryItem[];
  onSubmit: (corrections: EndingInventoryCorrectionItem[], reason: string) => void;
}

interface Row {
  skuId: string;
  skuName: string;
  deliveredQty: number;
  submittedQty: number;
  correctedQty: number;
}

export function CorrectionRequestForm({
  open,
  onClose,
  ei,
  deliveryItems,
  onSubmit,
}: Props) {
  const initialRows: Row[] = useMemo(() => {
    if (!ei) return [];
    return deliveryItems.map((d) => {
      const unsold = ei.unsoldItems.find((u) => u.skuId === d.skuId);
      const submitted = unsold?.quantity ?? 0;
      return {
        skuId: d.skuId,
        skuName: d.skuName,
        deliveredQty: d.quantity,
        submittedQty: submitted,
        correctedQty: submitted,
      };
    });
  }, [ei, deliveryItems]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setRows(initialRows);
      setReason('');
    }
  }, [open, initialRows]);

  const updateRow = (skuId: string, value: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.skuId === skuId
          ? { ...r, correctedQty: Math.max(0, Math.min(value, r.deliveredQty)) }
          : r,
      ),
    );
  };

  const changedRows = rows.filter((r) => r.correctedQty !== r.submittedQty);
  const canSubmit = changedRows.length > 0 && reason.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const corrections: EndingInventoryCorrectionItem[] = changedRows.map((r) => ({
      skuId: r.skuId,
      skuName: r.skuName,
      submittedQty: r.submittedQty,
      correctedQty: r.correctedQty,
    }));
    onSubmit(corrections, reason.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Request Correction" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Enter the correct unsold quantities for any SKUs that differ from the store's
          submission. Only changed rows will be sent to the store.
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-center">Delivered</th>
                <th className="px-3 py-2 text-center">Submitted</th>
                <th className="px-3 py-2 text-center">Correct</th>
                <th className="px-3 py-2 text-center">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const diff = r.correctedQty - r.submittedQty;
                const changed = diff !== 0;
                return (
                  <tr key={r.skuId} className={changed ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.skuName}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{r.deliveredQty}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{r.submittedQty}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={r.deliveredQty}
                        value={r.correctedQty}
                        onChange={(e) =>
                          updateRow(r.skuId, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-zapp-orange"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {changed && (
                        <span
                          className={
                            diff > 0
                              ? 'font-medium text-amber-700'
                              : 'font-medium text-blue-700'
                          }
                        >
                          {diff > 0 ? '+' : ''}
                          {diff}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
          <p className="font-medium text-amber-900 flex items-center gap-1">
            <AlertOctagon size={12} /> {changedRows.length} correction
            {changedRows.length === 1 ? '' : 's'} will be sent.
          </p>
          <p className="text-amber-800 mt-0.5">
            Store will receive a notification and must resubmit to return the EI to Pending Review.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for correction <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why the corrections are needed (e.g. 'Physical recount with store shows different figures')."
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!canSubmit} onClick={handleSubmit}>
            Send Corrections
          </Button>
        </div>
      </div>
    </Modal>
  );
}
