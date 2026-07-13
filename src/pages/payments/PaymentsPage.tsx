import { useState, useMemo, useCallback } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  Image as ImageIcon,
  ShieldCheck,
  HandCoins,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  CardHeader,
  SearchInput,
  Select,
  Table,
  Tabs,
  StatusBadge,
  Stat,
  Badge,
  Button,
} from '@/components/ui';
import type { TableColumn, SelectOption, Tab } from '@/components/ui';
import type { Payment } from '@/types';
import { getCutoffRangeForDate } from '@/lib/billingComputations';
import PaymentSubmitModal from './PaymentSubmitModal';
import PaymentVerifyModal from './PaymentVerifyModal';
import PaymentCollectModal from './PaymentCollectModal';

const PAGE_SIZE = 10;

const tabDefs: Tab[] = [
  { key: 'all', label: 'All Payments', icon: <CreditCard size={14} /> },
  { key: 'collection', label: 'Pending Collection', icon: <HandCoins size={14} /> },
  { key: 'verification', label: 'Pending Verification', icon: <Clock size={14} /> },
  { key: 'verified', label: 'Verified', icon: <CheckCircle size={14} /> },
  { key: 'rejected', label: 'Rejected', icon: <XCircle size={14} /> },
];

// ── Roles ────────────────────────────────────────────────────────────────
// Payment flow: franchisee submits → PD/SPD collects → billing verifies.

const canSubmitPayment = (role?: string) =>
  role === 'franchisee_direct' ||
  role === 'franchisee_distributor' ||
  role === 'owner';

// PD / SPD collect their stores' remittances before forwarding to billing.
// owner / ops can collect too (oversight). SPD collects here even though it is
// view-only elsewhere — this is the one action a sub-partner performs.
const canCollectPayment = (role?: string) =>
  role === 'partner_distributor' ||
  role === 'sub_partner_distributor' ||
  role === 'owner' ||
  role === 'operations_manager';

const canVerifyPayment = (role?: string) =>
  role === 'billing_user' ||
  role === 'owner' ||
  role === 'operations_manager';

// ── Main Component ──────────────────────────────────────────────────────

export default function PaymentsPage() {
  const {
    payments,
    stores,
    currentUser,
    demoUsers,
    getStoresForCurrentUser,
    distributors,
    subPartnerDistributors,
    plants,
  } = useStore();

  // The billing user gets a payer-oriented filter set (Plant → Distributor/SPD/
  // Franchisee → cutoff) instead of the generic search/status/date range — a
  // distributor's remittance is one payment per cutoff per plant covering all
  // its stores (boss).
  const isBillingUser = currentUser?.role === 'billing_user';

  const [activeTab, setActiveTab] = useState('all');
  const [storeSearch, setStoreSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Billing-user payer filters.
  const [plantFilter, setPlantFilter] = useState('');
  const [payerType, setPayerType] = useState<'' | 'distributor' | 'spd' | 'franchisee'>('');
  const [payerEntity, setPayerEntity] = useState('');
  const [cutoffFilter, setCutoffFilter] = useState('');
  const [page, setPage] = useState(1);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [verifyPayment, setVerifyPayment] = useState<Payment | null>(null);
  const [collectPaymentTarget, setCollectPaymentTarget] = useState<Payment | null>(null);

  // A store "has a PD" when it belongs to a distributor (or sub-partner).
  // These go through the PD/SPD collection step. Direct franchisees have no
  // distributor, so their payments skip collection and go straight to billing.
  const storeHasPd = useCallback(
    (storeId: string) => {
      const store = stores.find((s) => s.id === storeId);
      return !!(store?.distributorId || store?.subPartnerDistributorId);
    },
    [stores],
  );

  // Derived workflow stage (independent of the raw status enum) used for tabs,
  // stats and action routing.
  const paymentStage = useCallback(
    (
      p: Payment,
    ): 'awaiting_collection' | 'awaiting_verification' | 'verified' | 'rejected' => {
      if (p.status === 'verified') return 'verified';
      if (p.status === 'rejected') return 'rejected';
      if (p.status === 'collected') return 'awaiting_verification';
      // status === 'submitted'
      return storeHasPd(p.storeId) ? 'awaiting_collection' : 'awaiting_verification';
    },
    [storeHasPd],
  );

  // Filter payments based on user role
  const userPayments = useMemo(() => {
    if (!currentUser) return [];
    const role = currentUser.role;

    if (role === 'owner' || role === 'operations_manager' || role === 'billing_user') {
      return payments;
    }

    // PD / SPD see the payments of the stores in their distributor scope.
    if (role === 'partner_distributor' || role === 'sub_partner_distributor') {
      const scoped = new Set(getStoresForCurrentUser().map((s) => s.id));
      return payments.filter((p) => scoped.has(p.storeId));
    }

    // Franchisees see only their store payments
    const userStoreIds = currentUser.assignedStoreIds ?? [];
    return payments.filter((p) => userStoreIds.includes(p.storeId));
  }, [payments, currentUser, getStoresForCurrentUser]);

  // Filter and search
  const filtered = useMemo(() => {
    let result = [...userPayments];

    // Tab filter (stage-based: pending tabs split by collection vs verification)
    if (activeTab === 'collection') {
      result = result.filter((p) => paymentStage(p) === 'awaiting_collection');
    } else if (activeTab === 'verification') {
      result = result.filter((p) => paymentStage(p) === 'awaiting_verification');
    } else if (activeTab === 'verified') {
      result = result.filter((p) => p.status === 'verified');
    } else if (activeTab === 'rejected') {
      result = result.filter((p) => p.status === 'rejected');
    }

    // Status filter (for "all" tab)
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Store search
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      result = result.filter((p) => {
        const store = stores.find((s) => s.id === p.storeId);
        return store?.name.toLowerCase().includes(q);
      });
    }

    // Date range
    if (dateFrom) result = result.filter((p) => p.datePaid >= dateFrom);
    if (dateTo) result = result.filter((p) => p.datePaid <= dateTo);

    // Billing-user payer filters: Plant → Distributor / SPD / Franchisee (direct)
    // → cutoff. A store's payer type is derived from its distributor/SPD links;
    // the cutoff is derived from the payment's paid date (all stores share the
    // same cutoff windows, so a single selector replaces the date range).
    if (isBillingUser) {
      if (plantFilter) {
        result = result.filter((p) => stores.find((s) => s.id === p.storeId)?.plantId === plantFilter);
      }
      if (payerType) {
        result = result.filter((p) => {
          const s = stores.find((st) => st.id === p.storeId);
          if (!s) return false;
          if (payerType === 'distributor') return !!s.distributorId && !s.subPartnerDistributorId;
          if (payerType === 'spd') return !!s.subPartnerDistributorId;
          return !s.distributorId && !s.subPartnerDistributorId; // franchisee (direct)
        });
        if (payerEntity) {
          result = result.filter((p) => {
            const s = stores.find((st) => st.id === p.storeId);
            if (!s) return false;
            if (payerType === 'distributor') return s.distributorId === payerEntity;
            if (payerType === 'spd') return s.subPartnerDistributorId === payerEntity;
            return s.id === payerEntity; // franchisee (direct) → store id
          });
        }
      }
      if (cutoffFilter) {
        result = result.filter((p) => getCutoffRangeForDate(p.datePaid) === cutoffFilter);
      }
    }

    result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return result;
  }, [userPayments, activeTab, statusFilter, storeSearch, dateFrom, dateTo, stores, paymentStage,
      isBillingUser, plantFilter, payerType, payerEntity, cutoffFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Stats
  const stats = useMemo(() => ({
    total: userPayments.length,
    pendingCollection: userPayments.filter((p) => paymentStage(p) === 'awaiting_collection').length,
    pendingVerification: userPayments.filter((p) => paymentStage(p) === 'awaiting_verification').length,
    verified: userPayments.filter((p) => p.status === 'verified').length,
    totalAmount: userPayments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0),
  }), [userPayments, paymentStage]);

  // Helpers
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const verifierName = (id?: string) => {
    if (!id) return '-';
    const user = demoUsers.find((u) => u.id === id);
    return user?.name ?? id;
  };
  const formatCurrency = (n: number) => `P${n.toLocaleString()}`;
  const distributorName = (id?: string) => distributors.find((d) => d.id === id)?.name ?? id ?? '-';
  const spdName = (id?: string) => subPartnerDistributors.find((s) => s.id === id)?.name ?? id ?? '-';

  // ── Billing-user payer filter options ───────────────────────────────────
  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const payerTypeOptions: SelectOption[] = [
    { value: '', label: 'All Payers' },
    { value: 'distributor', label: 'Distributor (PD)' },
    { value: 'spd', label: 'Sub-Partner (SPD)' },
    { value: 'franchisee', label: 'Franchisee (Direct)' },
  ];
  const cutoffOptions: SelectOption[] = [
    { value: '', label: 'All Cutoffs' },
    { value: '1-7', label: '1-7' },
    { value: '8-14', label: '8-14' },
    { value: '15-21', label: '15-21' },
    { value: '22-EOM', label: '22-EOM' },
  ];
  // Dependent entity list — only the payers of that type that actually have
  // payments (optionally within the chosen plant), so "available distri" is real.
  const payerEntityOptions: SelectOption[] = useMemo(() => {
    const storeIdsWithPayments = new Set(userPayments.map((p) => p.storeId));
    const relevant = stores.filter(
      (s) => storeIdsWithPayments.has(s.id) && (!plantFilter || s.plantId === plantFilter),
    );
    if (payerType === 'distributor') {
      const ids = [...new Set(relevant.filter((s) => s.distributorId && !s.subPartnerDistributorId).map((s) => s.distributorId!))];
      return [{ value: '', label: 'All Distributors' }, ...ids.map((id) => ({ value: id, label: distributorName(id) }))];
    }
    if (payerType === 'spd') {
      const ids = [...new Set(relevant.filter((s) => s.subPartnerDistributorId).map((s) => s.subPartnerDistributorId!))];
      return [{ value: '', label: 'All Sub-Partners' }, ...ids.map((id) => ({ value: id, label: spdName(id) }))];
    }
    if (payerType === 'franchisee') {
      const direct = relevant.filter((s) => !s.distributorId && !s.subPartnerDistributorId);
      return [{ value: '', label: 'All Direct Franchisees' }, ...direct.map((s) => ({ value: s.id, label: s.name }))];
    }
    return [{ value: '', label: 'Select payer type first' }];
    // distributorName/spdName are stable lookups over the closure slices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPayments, stores, plantFilter, payerType]);

  // Route a row click / "view" to the modal appropriate for the viewer's role
  // and the payment's current stage.
  const openDetail = (row: Payment) => {
    const role = currentUser?.role;
    const stage = paymentStage(row);
    if (stage === 'awaiting_collection' && canCollectPayment(role)) {
      setCollectPaymentTarget(row);
      return;
    }
    if (canVerifyPayment(role)) {
      setVerifyPayment(row);
      return;
    }
    if (canCollectPayment(role)) {
      setCollectPaymentTarget(row);
      return;
    }
    // Franchisees / others: read-only detail via the verify modal.
    setVerifyPayment(row);
  };

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'collected', label: 'Collected' },
    { value: 'verified', label: 'Verified' },
    { value: 'rejected', label: 'Rejected' },
  ];

  // Group by store for the history view
  const groupedByStore = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of userPayments) {
      const list = map.get(p.storeId) ?? [];
      list.push(p);
      map.set(p.storeId, list);
    }
    return map;
  }, [userPayments]);

  // Table columns
  const columns: TableColumn<Payment>[] = [
    {
      key: 'referenceNumber',
      header: 'Reference #',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900">{row.referenceNumber}</span>
      ),
    },
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => (
        <span className="text-sm text-gray-900">{storeName(row.storeId)}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="text-sm font-bold text-gray-900">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => (
        <Badge variant={row.method === 'gateway' ? 'info' : 'neutral'} size="sm">
          {row.method === 'gateway' ? 'Gateway' : 'Manual'}
        </Badge>
      ),
    },
    {
      key: 'datePaid',
      header: 'Date Paid',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-gray-700">{new Date(row.datePaid).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'proofUrl',
      header: 'Proof',
      render: (row) => row.proofUrl ? (
        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
          <ImageIcon size={12} /> Uploaded
        </span>
      ) : (
        <span className="text-xs text-gray-400">N/A</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="payment" status={row.status} />,
    },
    {
      key: 'verifiedBy',
      header: 'Handled By',
      render: (row) => {
        if (row.verifiedBy) {
          return <span className="text-sm text-gray-600">{verifierName(row.verifiedBy)}</span>;
        }
        if (row.collectedBy) {
          return (
            <span className="text-sm text-blue-600">
              {verifierName(row.collectedBy)}
              <span className="text-xs text-gray-400"> (collected)</span>
            </span>
          );
        }
        return <span className="text-sm text-gray-600">-</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const stage = paymentStage(row);
        return (
          <div className="flex items-center gap-1">
            {stage === 'awaiting_collection' && canCollectPayment(currentUser?.role) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCollectPaymentTarget(row);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Collect Payment"
              >
                <HandCoins size={15} />
              </button>
            )}
            {stage === 'awaiting_verification' && canVerifyPayment(currentUser?.role) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVerifyPayment(row);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Verify / Reject"
              >
                <ShieldCheck size={15} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDetail(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-zapp-orange hover:bg-orange-50 transition-colors"
              title="View Details"
            >
              <Eye size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track, submit, and verify store payments</p>
        </div>
        {canSubmitPayment(currentUser?.role) && (
          <Button
            variant="primary"
            iconLeft={<Plus size={16} />}
            onClick={() => setSubmitModalOpen(true)}
          >
            Submit Payment
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<CreditCard size={18} />} label="Total Payments" value={stats.total} />
        <Stat icon={<HandCoins size={18} />} label="Pending Collection" value={stats.pendingCollection} />
        <Stat icon={<Clock size={18} />} label="Pending Verification" value={stats.pendingVerification} />
        <Stat
          icon={<CheckCircle size={18} />}
          label="Total Verified Amount"
          value={formatCurrency(stats.totalAmount)}
        />
      </div>

      {/* Tabs with content */}
      <Tabs
        tabs={tabDefs}
        activeTab={activeTab}
        onChange={(key) => { setActiveTab(key); setPage(1); }}
      >
        {/* Filters */}
        <Card className="mb-4">
          <CardContent>
            {isBillingUser ? (
              // Payer-oriented filters: Plant → Distributor/SPD/Franchisee →
              // dependent entity → cutoff (one payment per cutoff per plant).
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Select
                  options={plantOptions}
                  value={plantFilter}
                  onChange={(e) => { setPlantFilter(e.target.value); setPayerEntity(''); setPage(1); }}
                />
                <Select
                  options={payerTypeOptions}
                  value={payerType}
                  onChange={(e) => {
                    setPayerType(e.target.value as typeof payerType);
                    setPayerEntity('');
                    setPage(1);
                  }}
                />
                <Select
                  options={payerEntityOptions}
                  value={payerEntity}
                  onChange={(e) => { setPayerEntity(e.target.value); setPage(1); }}
                  disabled={!payerType}
                />
                <Select
                  options={cutoffOptions}
                  value={cutoffFilter}
                  onChange={(e) => { setCutoffFilter(e.target.value); setPage(1); }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <SearchInput
                  value={storeSearch}
                  onChange={(val) => { setStoreSearch(val); setPage(1); }}
                  placeholder="Search by store..."
                />
                {activeTab === 'all' && (
                  <Select
                    options={statusOptions}
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  />
                )}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => openDetail(row)}
          emptyMessage="No payments found matching your filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onPageChange: setPage,
          }}
        />
      </Tabs>

      {/* Payment History Grouped by Store */}
      {groupedByStore.size > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment History by Store</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from(groupedByStore.entries())
              .sort(([, a], [, b]) => b.length - a.length)
              .slice(0, 6)
              .map(([storeId, storePayments]) => (
                <Card key={storeId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{storeName(storeId)}</h3>
                      <Badge variant="neutral" size="sm">{storePayments.length} payment{storePayments.length !== 1 ? 's' : ''}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {storePayments
                        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
                        .slice(0, 3)
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-500">{p.referenceNumber}</span>
                              <Badge variant={p.method === 'gateway' ? 'info' : 'neutral'} size="sm">
                                {p.method === 'gateway' ? 'GW' : 'Manual'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900">{formatCurrency(p.amount)}</span>
                              <StatusBadge category="payment" status={p.status} size="sm" />
                            </div>
                          </div>
                        ))}
                      {storePayments.length > 3 && (
                        <p className="text-xs text-gray-400 text-center pt-1">
                          +{storePayments.length - 3} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Submit Payment Modal */}
      <PaymentSubmitModal
        open={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
      />

      {/* Collect Payment Modal (PD / SPD) */}
      <PaymentCollectModal
        open={!!collectPaymentTarget}
        onClose={() => setCollectPaymentTarget(null)}
        payment={collectPaymentTarget}
      />

      {/* Verify Payment Modal */}
      <PaymentVerifyModal
        open={!!verifyPayment}
        onClose={() => setVerifyPayment(null)}
        payment={verifyPayment}
      />
    </div>
  );
}
