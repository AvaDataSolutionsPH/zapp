import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Truck,
  AlertTriangle,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  StatusBadge,
  Table,
  EmptyState,
  Stat,
} from '@/components/ui';
import type { TableColumn } from '@/components/ui';
import type { Delivery } from '@/types';

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    stores,
    plants,
    distributors,
    areaSupervisors,
    deliveries,
    billingRecords,
    salesMetrics,
  } = useStore();

  const store = useMemo(() => stores.find((s) => s.id === id), [stores, id]);

  const plant = store ? plants.find((p) => p.id === store.plantId) : null;
  const distributor = store?.distributorId
    ? distributors.find((d) => d.id === store.distributorId)
    : null;
  const areaSupervisor = store
    ? areaSupervisors.find((a) => a.id === store.areaSupervisorId)
    : null;

  const storeDeliveries = useMemo(
    () =>
      store
        ? deliveries
            .filter((d) => d.storeId === store.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
        : [],
    [store, deliveries],
  );

  const storeBilling = useMemo(
    () =>
      store
        ? billingRecords
            .filter((b) => b.storeId === store.id)
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
        : [],
    [store, billingRecords],
  );

  const storeMetrics = useMemo(
    () => (store ? salesMetrics.filter((m) => m.storeId === store.id) : []),
    [store, salesMetrics],
  );

  if (!store) {
    return (
      <div className="p-6">
        <EmptyState
          title="Store Not Found"
          description="The store you are looking for does not exist."
          actionLabel="Back to Stores"
          onAction={() => navigate('/stores-management')}
        />
      </div>
    );
  }

  const totalSRP = storeMetrics.reduce((s, m) => s + m.srpSales, 0);
  const avgDaily = storeMetrics.length > 0 ? Math.round(totalSRP / Math.max(storeMetrics.length, 1)) : 0;

  // Dual billing financials
  const billingSRP = storeBilling.reduce((s, b) => s + b.srpTotal, 0);
  const billingFranchiseeProfit = storeBilling.reduce((s, b) => s + b.franchiseeProfit, 0);
  const billingRemitToPD = storeBilling.reduce((s, b) => s + b.remitToPD, 0);
  const billingDRTotal = storeBilling.reduce((s, b) => s + b.drTotal, 0);
  const billingPackaging = storeBilling.reduce((s, b) => s + b.packagingTotal, 0);
  const billingPayable = storeBilling.reduce((s, b) => s + b.totalPayable, 0);

  const latestBilling = storeBilling[0];
  const isBlocked = store.status === 'blocked';

  // Check 48hr payment compliance
  const hasOverdue = storeBilling.some((b) => b.status === 'overdue');

  const deliveryColumns: TableColumn<Delivery>[] = [
    { key: 'drNumber', header: 'DR Number', render: (row) => <span className="font-mono text-sm">{row.drNumber}</span> },
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge category="delivery" status={row.status} /> },
    { key: 'items', header: 'Items', render: (row) => row.items.length },
    { key: 'totalDRCost', header: 'DR Total', render: (row) => `P${row.totalDRCost.toLocaleString()}` },
    { key: 'totalSRP', header: 'SRP Total', render: (row) => `P${row.totalSRP.toLocaleString()}` },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={16} />} onClick={() => navigate('/stores-management')}>
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
            <StatusBadge category="store" status={store.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{store.businessName}</p>
        </div>
      </div>

      {/* Blocked Banner */}
      {isBlocked && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <ShieldAlert size={24} className="text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">DELIVERY BLOCKED</p>
            <p className="text-sm text-red-700">
              This store is currently blocked from receiving deliveries. Please resolve outstanding issues.
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<DollarSign size={18} />} label="Total SRP Sales" value={`P${billingSRP.toLocaleString()}`} />
        <Stat icon={<DollarSign size={18} />} label="Total DR Sales (ref)" value={`P${billingDRTotal.toLocaleString()}`} />
        <Stat icon={<Calendar size={18} />} label="Avg Daily SRP" value={`P${avgDaily.toLocaleString()}`} />
        <Stat icon={<Truck size={18} />} label="Total Deliveries" value={storeDeliveries.length} />
      </div>

      {/* Dual Billing Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Store Remittance (SRP-Based)</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total SRP Sales</span>
                <span className="font-semibold text-gray-900">P{billingSRP.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">15% Franchisee Profit</span>
                <span className="font-semibold text-green-600">P{billingFranchiseeProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="font-bold text-gray-900">Remit to PD (85%)</span>
                <span className="font-bold text-indigo-600">P{billingRemitToPD.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Zapp Billing (DR-Based)</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">DR Total</span>
                <span className="font-semibold text-gray-900">P{billingDRTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Packaging Charges</span>
                <span className="font-semibold text-blue-600">P{billingPackaging.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="font-bold text-gray-900">Zapp Billing Total</span>
                <span className="font-bold text-zapp-orange">P{billingPayable.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 size={18} /> Store Information
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{store.ownerName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <Phone size={14} className="text-gray-400" /> {store.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <Mail size={14} className="text-gray-400" /> {store.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Province</dt>
                <dd className="mt-1 text-sm text-gray-700">{store.province}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" /> {store.address}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Area</dt>
                <dd className="mt-1 text-sm text-gray-700">{store.area}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</dt>
                <dd className="mt-1 text-sm text-gray-700">{new Date(store.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Assignment Card */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Assignment Details</h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Plant</dt>
                <dd className="mt-1 text-sm text-gray-700">{plant?.name ?? '-'} ({plant?.code ?? '-'})</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</dt>
                <dd className="mt-1 text-sm text-gray-700">{distributor?.name ?? 'N/A (Direct)'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Area Supervisor</dt>
                <dd className="mt-1 text-sm text-gray-700">{areaSupervisor?.name ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Franchise Type</dt>
                <dd className="mt-1">
                  <Badge variant={store.franchiseType === 'distributor' ? 'info' : 'orange'} size="sm">
                    {store.franchiseType === 'distributor' ? 'Distributor' : 'Direct'}
                  </Badge>
                </dd>
              </div>
            </dl>

            {/* Billing Status */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing Status</h3>
              {latestBilling ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Period: {latestBilling.period}</p>
                    <p className="text-sm text-gray-600">Payable: P{latestBilling.totalPayable.toLocaleString()}</p>
                  </div>
                  <StatusBadge category="billing" status={latestBilling.status} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">No billing records yet.</p>
              )}
            </div>

            {/* Payment Compliance */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">48hr Payment Compliance</h3>
              {hasOverdue ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">Non-compliant - Overdue payments detected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Compliant</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
        </CardHeader>
        {storeDeliveries.length > 0 ? (
          <Table
            columns={deliveryColumns}
            data={storeDeliveries}
            keyExtractor={(row) => row.id}
            emptyMessage="No deliveries found."
          />
        ) : (
          <CardContent>
            <p className="text-sm text-gray-500 text-center py-8">No deliveries recorded for this store yet.</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
