import { useState, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  Image as ImageIcon,
  ShieldCheck,
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
import PaymentSubmitModal from './PaymentSubmitModal';
import PaymentVerifyModal from './PaymentVerifyModal';

const PAGE_SIZE = 10;

const tabDefs: Tab[] = [
  { key: 'all', label: 'All Payments', icon: <CreditCard size={14} /> },
  { key: 'submitted', label: 'Pending Verification', icon: <Clock size={14} /> },
  { key: 'verified', label: 'Verified', icon: <CheckCircle size={14} /> },
  { key: 'rejected', label: 'Rejected', icon: <XCircle size={14} /> },
];

// ── Roles ────────────────────────────────────────────────────────────────

const canSubmitPayment = (role?: string) =>
  role === 'franchisee_direct' ||
  role === 'franchisee_distributor' ||
  role === 'owner';

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
  } = useStore();

  const [activeTab, setActiveTab] = useState('all');
  const [storeSearch, setStoreSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [verifyPayment, setVerifyPayment] = useState<Payment | null>(null);

  // Filter payments based on user role
  const userPayments = useMemo(() => {
    if (!currentUser) return [];
    const role = currentUser.role;

    if (role === 'owner' || role === 'operations_manager' || role === 'billing_user') {
      return payments;
    }

    // Franchisees see only their store payments
    const userStoreIds = currentUser.assignedStoreIds ?? [];
    return payments.filter((p) => userStoreIds.includes(p.storeId));
  }, [payments, currentUser]);

  // Filter and search
  const filtered = useMemo(() => {
    let result = [...userPayments];

    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter((p) => p.status === activeTab);
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

    result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return result;
  }, [userPayments, activeTab, statusFilter, storeSearch, dateFrom, dateTo, stores]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Stats
  const stats = useMemo(() => ({
    total: userPayments.length,
    pending: userPayments.filter((p) => p.status === 'submitted').length,
    verified: userPayments.filter((p) => p.status === 'verified').length,
    rejected: userPayments.filter((p) => p.status === 'rejected').length,
    totalAmount: userPayments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0),
  }), [userPayments]);

  // Helpers
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const verifierName = (id?: string) => {
    if (!id) return '-';
    const user = demoUsers.find((u) => u.id === id);
    return user?.name ?? id;
  };
  const formatCurrency = (n: number) => `P${n.toLocaleString()}`;

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'submitted', label: 'Pending' },
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
      header: 'Verified By',
      render: (row) => (
        <span className="text-sm text-gray-600">{verifierName(row.verifiedBy)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'submitted' && canVerifyPayment(currentUser?.role) && (
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
              setVerifyPayment(row);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-zapp-orange hover:bg-orange-50 transition-colors"
            title="View Details"
          >
            <Eye size={15} />
          </button>
        </div>
      ),
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
        <Stat icon={<Clock size={18} />} label="Pending Verification" value={stats.pending} />
        <Stat icon={<CheckCircle size={18} />} label="Verified" value={stats.verified} />
        <Stat
          icon={<CreditCard size={18} />}
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
          </CardContent>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setVerifyPayment(row)}
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

      {/* Verify Payment Modal */}
      <PaymentVerifyModal
        open={!!verifyPayment}
        onClose={() => setVerifyPayment(null)}
        payment={verifyPayment}
      />
    </div>
  );
}
