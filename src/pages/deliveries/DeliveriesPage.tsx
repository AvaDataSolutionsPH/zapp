import { useState, useMemo } from 'react';
import {
  Truck,
  Package,
  Eye,
  AlertTriangle,
  Ban,
  Play,
  Plus,
  X,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  Select,
  Table,
  Tabs,
  StatusBadge,
  Stat,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { TableColumn, SelectOption, Tab } from '@/components/ui';
import type { Delivery, DeliveryItem, DeliveryStatus } from '@/types';
import DeliveryDetailDrawer from './DeliveryDetailDrawer';

const PAGE_SIZE = 10;

// YYYY-MM-DD for `n` days before today (local time) — used by the
// "Last 7 / 30 days" delivery date presets. Delivery.date is stored as a
// plain YYYY-MM-DD string, so we compare lexicographically against this.
const daysAgoISO = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const datePresetChips: { key: 'all' | '7d' | '30d' | 'custom'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

// Roles allowed to create a delivery (plant dispatch + ops/owner + PD).
const canCreateDelivery = (role?: string) =>
  role === 'plant_manager' ||
  role === 'operations_manager' ||
  role === 'owner' ||
  role === 'partner_distributor';

const PLANT_CODE: Record<string, string> = {
  'plant-01': 'DRG',
  'plant-02': 'MNL',
  'plant-03': 'CEB',
};

const newDeliveryStatusOptions: SelectOption[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered (ready for Beginning Inventory)' },
];

const statusTabs: Tab[] = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'reconciled', label: 'Reconciled' },
];

export default function DeliveriesPage() {
  const {
    getDeliveriesForCurrentUser,
    getStoresForCurrentUser,
    stores,
    plants,
    skus,
    billingRecords,
    currentUser,
    requestStopDelivery,
    resumeDelivery,
    addDelivery,
  } = useStore();
  const { addToast } = useToast();

  const allDeliveries = getDeliveriesForCurrentUser();

  // ── Delivery Enforcement: compute store payment issues ──
  const enforcementRoles = ['partner_distributor', 'area_manager', 'operations_manager', 'owner'];
  const canViewEnforcement = currentUser && enforcementRoles.includes(currentUser.role);
  const canManageEnforcement = currentUser && ['area_manager', 'operations_manager', 'owner'].includes(currentUser.role);

  const storesWithIssues = useMemo(() => {
    if (!canViewEnforcement) return [];

    // Group billing records by store, sorted by period descending
    const storeMap = new Map<string, { unpaidCount: number; storeName: string; deliveryStatus?: string }>();

    for (const store of stores) {
      const storeRecords = billingRecords
        .filter((b) => b.storeId === store.id)
        .sort((a, b) => b.period.localeCompare(a.period));

      // Count consecutive unpaid billing cycles from most recent
      let unpaidCount = 0;
      for (const record of storeRecords) {
        if (record.status !== 'paid') {
          unpaidCount++;
        } else {
          break;
        }
      }

      if (unpaidCount >= 1) {
        storeMap.set(store.id, {
          unpaidCount,
          storeName: store.name,
          deliveryStatus: store.deliveryStatus,
        });
      }
    }

    return Array.from(storeMap.entries()).map(([storeId, data]) => ({
      storeId,
      storeName: data.storeName,
      unpaidCount: data.unpaidCount,
      level: data.unpaidCount >= 2 ? 'hold' as const : 'warning' as const,
      deliveryStatus: data.deliveryStatus,
    }));
  }, [canViewEnforcement, stores, billingRecords]);

  const [activeTab, setActiveTab] = useState('all');
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | 'custom'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // ── New Delivery form state ──
  const [showCreate, setShowCreate] = useState(false);
  const [formStoreId, setFormStoreId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStatus, setFormStatus] = useState<DeliveryStatus>('delivered');
  const [formItems, setFormItems] = useState<{ skuId: string; quantity: number }[]>([
    { skuId: '', quantity: 0 },
  ]);

  // Stores the signed-in user may create a delivery for (role-scoped).
  //
  // ⚠️ Depends on `stores`, NOT on the getter. Zustand hands back the SAME
  // function identity forever, so memoising on it computed this list once at
  // mount — before hydrateFromDB replaced the mock slice — and never again. The
  // dropdown then offered mock stores (store-01, store-02…) that do not exist
  // in the database: picking one built a delivery whose store_id violated the
  // FK, so the write was rejected and rolled back and the delivery simply
  // vanished, with nothing on screen saying why.
  // Derived inline, like BeginningInventoryPage: the list is small, and the
  // no-selector useStore() subscription already re-renders this component
  // whenever the stores slice changes.
  const creatableStores = getStoresForCurrentUser().filter((s) => s.status === 'active');

  const createStoreOptions: SelectOption[] = [
    { value: '', label: 'Select Store' },
    ...creatableStores.map((s) => ({ value: s.id, label: s.name })),
  ];

  const createSkuOptions: SelectOption[] = [
    { value: '', label: 'Select SKU' },
    ...skus.map((s) => ({
      value: s.id,
      label: `${s.name} (DR: P${s.drPrice} / SRP: P${s.srpPrice})`,
    })),
  ];

  const addCreateItem = () =>
    setFormItems((prev) => [...prev, { skuId: '', quantity: 0 }]);
  const removeCreateItem = (i: number) =>
    setFormItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateCreateItem = (
    i: number,
    field: 'skuId' | 'quantity',
    value: string | number,
  ) =>
    setFormItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)),
    );

  const resetCreateForm = () => {
    setShowCreate(false);
    setFormStoreId('');
    setFormDate('');
    setFormStatus('delivered');
    setFormItems([{ skuId: '', quantity: 0 }]);
  };

  const handleCreateDelivery = () => {
    const store = creatableStores.find((s) => s.id === formStoreId);
    if (!store || !formDate) return;
    const validItems = formItems.filter((it) => it.skuId && it.quantity > 0);
    if (validItems.length === 0) return;

    const items: DeliveryItem[] = validItems.map((it) => {
      const sku = skus.find((s) => s.id === it.skuId)!;
      return {
        skuId: sku.id,
        skuName: sku.name,
        quantity: it.quantity,
        drPrice: sku.drPrice,
        srpPrice: sku.srpPrice,
      };
    });
    const totalDRCost = items.reduce((sum, it) => sum + it.drPrice * it.quantity, 0);
    const totalSRP = items.reduce((sum, it) => sum + it.srpPrice * it.quantity, 0);

    // Deterministic-ish DR number: plant code + date + short suffix.
    const code = PLANT_CODE[store.plantId] ?? 'DRG';
    const dateCompact = formDate.replace(/-/g, '');
    const suffix = String(
      getDeliveriesForCurrentUser().filter((d) => d.plantId === store.plantId).length + 1,
    ).padStart(3, '0');

    addDelivery({
      id: `del-new-${Date.now().toString(36)}`,
      storeId: store.id,
      plantId: store.plantId,
      date: formDate,
      status: formStatus,
      drNumber: `DR-${code}-${dateCompact}-${suffix}`,
      items,
      totalDRCost,
      totalSRP,
    });

    addToast(
      'success',
      `Delivery created for ${store.name} (${formStatus.replace('_', ' ')}).`,
    );
    resetCreateForm();
  };

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '-';
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';

  // Preset chips drive dateFrom/dateTo. "Custom" reveals the manual inputs
  // and keeps whatever range is currently set; the others compute a rolling
  // window ending today (open-ended "to").
  const applyDatePreset = (preset: 'all' | '7d' | '30d' | 'custom') => {
    setDatePreset(preset);
    setPage(1);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === '7d') {
      setDateFrom(daysAgoISO(7));
      setDateTo('');
    } else if (preset === '30d') {
      setDateFrom(daysAgoISO(30));
      setDateTo('');
    }
    // 'custom' → leave dateFrom/dateTo as-is, show inputs
  };

  const filtered = useMemo(() => {
    let result = [...allDeliveries];
    if (activeTab !== 'all') result = result.filter((d) => d.status === activeTab);
    if (dateFrom) result = result.filter((d) => d.date >= dateFrom);
    if (dateTo) result = result.filter((d) => d.date <= dateTo);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [allDeliveries, activeTab, dateFrom, dateTo]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Stats
  const counts = useMemo(() => ({
    total: allDeliveries.length,
    scheduled: allDeliveries.filter((d) => d.status === 'scheduled').length,
    in_transit: allDeliveries.filter((d) => d.status === 'in_transit').length,
    delivered: allDeliveries.filter((d) => d.status === 'delivered').length,
  }), [allDeliveries]);

  const columns: TableColumn<Delivery>[] = [
    {
      key: 'drNumber',
      header: 'DR Number',
      sortable: true,
      render: (row) => <span className="font-mono text-sm font-medium text-gray-900">{row.drNumber}</span>,
    },
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => storeName(row.storeId),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.plantId),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="delivery" status={row.status} />,
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => row.items.length,
    },
    {
      key: 'totalDRCost',
      header: 'DR Total',
      render: (row) => `P${row.totalDRCost.toLocaleString()}`,
    },
    {
      key: 'totalSRP',
      header: 'SRP Total',
      render: (row) => `P${row.totalSRP.toLocaleString()}`,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDelivery(row);
          }}
          className="inline-flex items-center gap-1 text-sm text-zapp-orange hover:text-zapp-orange-dark transition-colors"
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage all store deliveries</p>
        </div>
        {canCreateDelivery(currentUser?.role) && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none"
          >
            <Plus size={16} /> New Delivery
          </button>
        )}
      </div>

      {/* Delivery Enforcement Section */}
      {canViewEnforcement && storesWithIssues.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-900">
                Delivery Enforcement - Stores with Payment Issues ({storesWithIssues.length})
              </h2>
            </div>
            <div className="space-y-2">
              {storesWithIssues.map((issue) => (
                <div
                  key={issue.storeId}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    issue.level === 'hold'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {issue.level === 'hold' ? (
                      <Ban size={16} className="text-red-600" />
                    ) : (
                      <AlertTriangle size={16} className="text-yellow-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{issue.storeName}</p>
                      <p className="text-xs text-gray-500">
                        {issue.unpaidCount} unpaid billing cycle{issue.unpaidCount > 1 ? 's' : ''} -{' '}
                        {issue.level === 'hold' ? (
                          <span className="text-red-600 font-medium">Hold (delivery stop recommended)</span>
                        ) : (
                          <span className="text-yellow-600 font-medium">Warning</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {canManageEnforcement && (
                    <div>
                      {issue.deliveryStatus === 'hold' ? (
                        <button
                          onClick={() => {
                            resumeDelivery(issue.storeId);
                            addToast('success', `Delivery resumed for ${issue.storeName}.`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors cursor-pointer border-none"
                        >
                          <Play size={12} /> Resume Delivery
                        </button>
                      ) : issue.level === 'hold' ? (
                        <button
                          onClick={() => {
                            requestStopDelivery(issue.storeId);
                            addToast('warning', `Delivery placed on hold for ${issue.storeName}.`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors cursor-pointer border-none"
                        >
                          <Ban size={12} /> Request Stop Delivery
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<Truck size={18} />} label="Total Deliveries" value={counts.total} />
        <Stat icon={<Package size={18} />} label="Scheduled" value={counts.scheduled} />
        <Stat icon={<Truck size={18} />} label="In Transit" value={counts.in_transit} />
        <Stat icon={<Package size={18} />} label="Delivered" value={counts.delivered} />
      </div>

      {/* Status Tabs */}
      <Tabs
        tabs={statusTabs}
        activeTab={activeTab}
        onChange={(key) => { setActiveTab(key); setPage(1); }}
      >
        {/* Filters — date only */}
        <Card className="mb-4">
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {datePresetChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => applyDatePreset(chip.key)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer border ${
                    datePreset === chip.key
                      ? 'bg-zapp-orange text-white border-zapp-orange'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedDelivery(row)}
          emptyMessage="No deliveries found matching your filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onPageChange: setPage,
          }}
        />
      </Tabs>

      {/* Delivery Detail Drawer */}
      <DeliveryDetailDrawer
        delivery={selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
      />

      {/* New Delivery Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New Delivery</h2>
              <button
                onClick={resetCreateForm}
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
                  options={createStoreOptions}
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                />
              </div>

              {/* Date + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <Select
                    options={newDeliveryStatusOptions}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as DeliveryStatus)}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                {formItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <Select
                        options={createSkuOptions}
                        value={item.skuId}
                        onChange={(e) => updateCreateItem(index, 'skuId', e.target.value)}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity || ''}
                      onChange={(e) =>
                        updateCreateItem(index, 'quantity', parseInt(e.target.value) || 0)
                      }
                      placeholder="Qty"
                      className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                    />
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeCreateItem(index)}
                        className="p-2 rounded hover:bg-red-50 text-red-500 cursor-pointer bg-transparent border-none"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addCreateItem}
                  className="text-sm text-zapp-orange hover:text-zapp-orange-dark font-medium cursor-pointer bg-transparent border-none"
                >
                  + Add Item
                </button>
              </div>

              {/* Preview totals */}
              {formItems.some((it) => it.skuId && it.quantity > 0) && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Delivery Preview</p>
                  {(() => {
                    const valid = formItems.filter((it) => it.skuId && it.quantity > 0);
                    const dr = valid.reduce((sum, it) => {
                      const sku = skus.find((s) => s.id === it.skuId);
                      return sum + (sku ? sku.drPrice * it.quantity : 0);
                    }, 0);
                    const srp = valid.reduce((sum, it) => {
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
                onClick={resetCreateForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDelivery}
                disabled={
                  !formStoreId ||
                  !formDate ||
                  !formItems.some((it) => it.skuId && it.quantity > 0)
                }
                className="rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
