import { useState, useMemo } from 'react';
import {
  Truck,
  Package,
  Eye,
  AlertTriangle,
  Ban,
  Play,
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
import type { Delivery } from '@/types';
import DeliveryDetailDrawer from './DeliveryDetailDrawer';

const PAGE_SIZE = 10;

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
    stores,
    plants,
    billingRecords,
    currentUser,
    requestStopDelivery,
    resumeDelivery,
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
  const [plantFilter, setPlantFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '-';
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';

  const filtered = useMemo(() => {
    let result = [...allDeliveries];
    if (activeTab !== 'all') result = result.filter((d) => d.status === activeTab);
    if (plantFilter) result = result.filter((d) => d.plantId === plantFilter);
    if (storeFilter) result = result.filter((d) => d.storeId === storeFilter);
    if (dateFrom) result = result.filter((d) => d.date >= dateFrom);
    if (dateTo) result = result.filter((d) => d.date <= dateTo);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [allDeliveries, activeTab, plantFilter, storeFilter, dateFrom, dateTo]);

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

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const storeOptions: SelectOption[] = [
    { value: '', label: 'All Stores' },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ];

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage all store deliveries</p>
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
        {/* Filters */}
        <Card className="mb-4">
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select options={plantOptions} value={plantFilter} onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }} />
              <Select options={storeOptions} value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="From Date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="To Date"
              />
            </div>
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
    </div>
  );
}
