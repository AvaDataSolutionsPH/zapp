import { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  X,
  Info,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Table,
  Stat,
  Select,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { SpecialOrder } from '@/types';

const PAGE_SIZE = 10;

export default function SpecialOrdersPage() {
  const {
    specialOrders,
    stores,
    skus,
    addSpecialOrder,
    currentUser,
  } = useStore();
  const { addToast } = useToast();

  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formStoreId, setFormStoreId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<
    { skuId: string; quantity: number }[]
  >([{ skuId: '', quantity: 0 }]);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '-';

  const sorted = useMemo(() => {
    return [...specialOrders].sort((a, b) => b.date.localeCompare(a.date));
  }, [specialOrders]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const totalDR = useMemo(
    () => specialOrders.reduce((sum, o) => sum + o.totalDR, 0),
    [specialOrders],
  );
  const totalSRP = useMemo(
    () => specialOrders.reduce((sum, o) => sum + o.totalSRP, 0),
    [specialOrders],
  );

  const storeOptions: SelectOption[] = [
    { value: '', label: 'Select Store' },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ];

  const skuOptions: SelectOption[] = [
    { value: '', label: 'Select SKU' },
    ...skus.map((s) => ({ value: s.id, label: `${s.name} (DR: P${s.drPrice} / SRP: P${s.srpPrice})` })),
  ];

  const addItemRow = () => {
    setFormItems((prev) => [...prev, { skuId: '', quantity: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: 'skuId' | 'quantity', value: string | number) => {
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = () => {
    if (!formStoreId || !formDate || formItems.length === 0) return;
    const validItems = formItems.filter((it) => it.skuId && it.quantity > 0);
    if (validItems.length === 0) return;

    const orderItems = validItems.map((it) => {
      const sku = skus.find((s) => s.id === it.skuId)!;
      return {
        skuId: it.skuId,
        skuName: sku.name,
        quantity: it.quantity,
        drPrice: sku.drPrice,
        srpPrice: sku.srpPrice,
      };
    });

    const totalDRVal = orderItems.reduce((sum, it) => sum + it.drPrice * it.quantity, 0);
    const totalSRPVal = orderItems.reduce((sum, it) => sum + it.srpPrice * it.quantity, 0);

    addSpecialOrder({
      storeId: formStoreId,
      date: formDate,
      items: orderItems,
      totalDR: totalDRVal,
      totalSRP: totalSRPVal,
      status: 'sold',
      notes: formNotes || undefined,
      createdAt: new Date().toISOString(),
    });
    addToast(
      'success',
      `Special order recorded. SRP total: P${totalSRPVal.toLocaleString()}.`,
    );

    // Reset form
    setShowForm(false);
    setFormStoreId('');
    setFormDate('');
    setFormNotes('');
    setFormItems([{ skuId: '', quantity: 0 }]);
  };

  const columns: TableColumn<SpecialOrder>[] = [
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => (
        <span className="font-medium text-gray-900">{storeName(row.storeId)}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <div className="text-sm">
          {row.items.map((it, i) => (
            <div key={i} className="text-gray-600">
              {it.skuName} x{it.quantity}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'totalDR',
      header: 'Total DR',
      render: (row) => `P${row.totalDR.toLocaleString()}`,
    },
    {
      key: 'totalSRP',
      header: 'Total SRP',
      render: (row) => `P${row.totalSRP.toLocaleString()}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Sold
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="text-sm text-gray-500">{row.notes ?? '-'}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Special Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage special/bulk orders that are always fully sold
          </p>
        </div>
        {currentUser && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none"
          >
            <Plus size={16} /> New Special Order
          </button>
        )}
      </div>

      {/* Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Special Orders are always counted as fully sold and excluded from 14-day forecast baseline.
          They are not part of regular inventory but are included in billing and sales.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Package size={18} />} label="Total Orders" value={specialOrders.length} />
        <Stat icon={<Package size={18} />} label="Total DR Value" value={`P${totalDR.toLocaleString()}`} />
        <Stat icon={<Package size={18} />} label="Total SRP Value" value={`P${totalSRP.toLocaleString()}`} />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        emptyMessage="No special orders yet."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: sorted.length,
          onPageChange: setPage,
        }}
      />

      {/* New Special Order Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New Special Order</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded hover:bg-gray-100 cursor-pointer bg-transparent border-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Store */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <Select
                  options={storeOptions}
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                />
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                {formItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <Select
                        options={skuOptions}
                        value={item.skuId}
                        onChange={(e) => updateItemRow(index, 'skuId', e.target.value)}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity || ''}
                      onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qty"
                      className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                    />
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeItemRow(index)}
                        className="p-2 rounded hover:bg-red-50 text-red-500 cursor-pointer bg-transparent border-none"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addItemRow}
                  className="text-sm text-zapp-orange hover:text-zapp-orange-dark font-medium cursor-pointer bg-transparent border-none"
                >
                  + Add Item
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                  placeholder="e.g. Bulk order for corporate event"
                />
              </div>

              {/* Preview totals */}
              {formItems.some((it) => it.skuId && it.quantity > 0) && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Order Preview</p>
                  {(() => {
                    const validItems = formItems.filter((it) => it.skuId && it.quantity > 0);
                    const dr = validItems.reduce((sum, it) => {
                      const sku = skus.find((s) => s.id === it.skuId);
                      return sum + (sku ? sku.drPrice * it.quantity : 0);
                    }, 0);
                    const srp = validItems.reduce((sum, it) => {
                      const sku = skus.find((s) => s.id === it.skuId);
                      return sum + (sku ? sku.srpPrice * it.quantity : 0);
                    }, 0);
                    return (
                      <div className="flex gap-6 mt-1">
                        <span className="text-sm text-gray-600">DR Total: <strong>P{dr.toLocaleString()}</strong></span>
                        <span className="text-sm text-gray-600">SRP Total: <strong>P{srp.toLocaleString()}</strong></span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formStoreId || !formDate || !formItems.some((it) => it.skuId && it.quantity > 0)}
                className="rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Special Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
