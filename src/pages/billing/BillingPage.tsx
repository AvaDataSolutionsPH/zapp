import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Eye,
  Upload,
  Download,
  Clock,
  CheckCircle,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  SearchInput,
  Select,
  Table,
  Stat,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { BillingRecord, Delivery } from '@/types';
import { billingService } from '@/services/api';
import { getBillingBreakdown } from '@/lib/billingComputations';
import BillingDetailDrawer from './BillingDetailDrawer';

const PAGE_SIZE = 10;

const statusOptions: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const cutoffOptions: SelectOption[] = [
  { value: '', label: 'All Cutoffs' },
  { value: '1-7', label: '1-7' },
  { value: '8-14', label: '8-14' },
  { value: '15-21', label: '15-21' },
  { value: '22-EOM', label: '22-EOM' },
];

// ── Due label helper ─────────────────────────────────────────────────────

function DueLabel({ dueAt, status }: { dueAt: string; status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
        <CheckCircle size={12} /> Paid
      </span>
    );
  }

  // Date.now() is intentionally non-deterministic here; the BillingPage
  // already re-renders every 60s via a setInterval tick so the label
  // refreshes deterministically per render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;

  if (diff <= 0) {
    const overdueDays = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold">
        <AlertTriangle size={12} /> OVERDUE ({overdueDays}d)
      </span>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = days <= 2;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`}>
      <Clock size={12} /> {days}d {hours}h
    </span>
  );
}

// ── Payment status helper ────────────────────────────────────────────────

function PaymentStatusLabel({ billingId, payments }: { billingId: string; payments: { billingId: string; status: string }[] }) {
  const payment = payments.find((p) => p.billingId === billingId);
  if (!payment) {
    return <span className="text-xs text-gray-400">No payment</span>;
  }
  return <StatusBadge category="payment" status={payment.status} size="sm" />;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function BillingPage() {
  const {
    getBillingForCurrentUser,
    stores,
    distributors,
    plants,
    currentUser,
    payments,
    updateBillingRecord,
    deliveries,
    endingInventories,
    specialOrders,
    packagingOrders,
  } = useStore();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const allBilling = getBillingForCurrentUser();

  // The consolidated printable statement is a billing-back-office tool.
  const canGenerateStatement =
    currentUser?.role === 'billing_user' ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'operations_manager';

  // Franchisees get a simplified, sales-focused billing view (no DR/packaging
  // internals — those are distributor/billing concerns). Per boss: DR number,
  // date, total sales, profit 15%, remit 85%, status, issued, due, Pay Now.
  const isFranchisee =
    currentUser?.role === 'franchisee_distributor' ||
    currentUser?.role === 'franchisee_direct';

  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [cutoffFilter, setCutoffFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBilling, setSelectedBilling] = useState<BillingRecord | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Re-render every minute to update due timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Helpers
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const distributorName = (id?: string) => {
    if (!id) return 'Direct (ZAPP)';
    return distributors.find((d) => d.id === id)?.name ?? id;
  };
  // Check if user has multi-plant access
  const hasMultiplePlants = currentUser?.role === 'owner' || currentUser?.role === 'operations_manager';

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  // Filter billing records
  const filtered = useMemo(() => {
    let result = [...allBilling];
    if (plantFilter) result = result.filter((b) => b.plantId === plantFilter);
    if (statusFilter) result = result.filter((b) => b.status === statusFilter);
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      result = result.filter((b) => {
        const name = storeName(b.storeId).toLowerCase();
        return name.includes(q);
      });
    }
    if (cutoffFilter) result = result.filter((b) => b.cutoffPeriod === cutoffFilter);
    if (dateFrom) result = result.filter((b) => b.issuedAt >= dateFrom);
    if (dateTo) result = result.filter((b) => b.issuedAt <= dateTo + 'T23:59:59Z');
    result.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return result;
    // storeName is a stable lookup over the closure's `stores` slice;
    // including it would re-run the memo every render without semantic change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBilling, plantFilter, statusFilter, storeSearch, cutoffFilter, dateFrom, dateTo]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // KPI stats
  const stats = useMemo(() => {
    const source = plantFilter ? allBilling.filter((b) => b.plantId === plantFilter) : allBilling;
    return {
      totalPayable: source.reduce((s, b) => s + b.totalPayable, 0),
      totalPaid: source.filter((b) => b.status === 'paid').reduce((s, b) => s + b.totalPayable, 0),
      overdueCount: source.filter((b) => b.status === 'overdue').length,
      totalRecords: source.length,
      totalRemittance: source.reduce((s, b) => s + b.remitToPD, 0),
      totalSRP: source.reduce((s, b) => s + b.srpTotal, 0),
      totalProfit: source.reduce((s, b) => s + b.franchiseeProfit, 0),
    };
  }, [allBilling, plantFilter]);

  // Franchisee view: resolve each billing's contributing DR number(s) + date.
  // A billing aggregates a store's deliveries in one cutoff, so there can be
  // more than one DR — we join them; date is the earliest contributing delivery.
  const billingMeta = useMemo(() => {
    const map = new Map<string, { drNumbers: string; date: string }>();
    if (!isFranchisee) return map;
    const ctx = { endingInventories, specialOrders, packagingOrders, deliveries, stores, payments };
    for (const b of allBilling) {
      const bd = getBillingBreakdown(b.id, ctx);
      const dels = (bd?.contributingEis ?? [])
        .map((ei) => deliveries.find((d) => d.id === ei.deliveryId))
        .filter((d): d is Delivery => !!d);
      const drNumbers = Array.from(new Set(dels.map((d) => d.drNumber)));
      const dates = dels.map((d) => d.date).sort();
      map.set(b.id, {
        drNumbers: drNumbers.length ? drNumbers.join(', ') : '—',
        date: dates[0] ?? b.issuedAt.slice(0, 10),
      });
    }
    return map;
  }, [isFranchisee, allBilling, endingInventories, specialOrders, packagingOrders, deliveries, stores, payments]);

  const formatCurrency = (n: number) => `P${n.toLocaleString()}`;

  // Pay Now — NextPay integration is not wired yet (boss: "coconnect natin yan
  // kay NextPay"). For now the button acknowledges the intent.
  const handlePayNow = (b: BillingRecord) => {
    addToast('info', `Pay Now for ${b.id.toUpperCase()} — NextPay integration coming soon.`);
  };

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const plantId = plantFilter || (plants[0]?.id ?? '');
      const blob = await billingService.exportToExcel(plantId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Handle error silently in demo
    } finally {
      setExporting(false);
    }
  }, [plantFilter, plants]);

  // Upload handler (simulated)
  const handleUpload = useCallback(async (billingId: string) => {
    setUploadingId(billingId);
    try {
      // Simulate file selection + upload
      await billingService.uploadFile(billingId, new File([], 'invoice.pdf'));
      updateBillingRecord(billingId, { invoiceFileUrl: `/invoices/${billingId}.pdf` });
    } catch {
      // Handle error
    } finally {
      setUploadingId(null);
    }
  }, [updateBillingRecord]);

  // Table columns
  const columns: TableColumn<BillingRecord>[] = [
    {
      key: 'id',
      header: 'Invoice #',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900">{row.id.toUpperCase()}</span>
      ),
    },
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => (
        <span className="text-sm text-gray-900 truncate max-w-[120px] block">{storeName(row.storeId)}</span>
      ),
    },
    {
      key: 'distributorId',
      header: 'Distributor',
      render: (row) => (
        <span className="text-sm text-gray-600 truncate max-w-[120px] block">{distributorName(row.distributorId)}</span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row) => <span className="text-sm text-gray-700">{row.period}</span>,
    },
    {
      key: 'drTotal',
      header: 'DR Total',
      render: (row) => <span className="text-sm font-medium">{formatCurrency(row.drTotal)}</span>,
    },
    {
      key: 'unsoldDeduction',
      header: 'Unsold',
      render: (row) => (
        <span className="text-sm text-red-600">-{formatCurrency(row.unsoldDeduction)}</span>
      ),
    },
    {
      key: 'packagingTotal',
      header: 'Packaging',
      render: (row) => (
        <span className="text-sm text-blue-600">+{formatCurrency(row.packagingTotal)}</span>
      ),
    },
    {
      key: 'totalPayable',
      header: 'Total Payable',
      sortable: true,
      render: (row) => (
        <span className="text-sm font-bold text-zapp-orange">{formatCurrency(row.totalPayable)}</span>
      ),
    },
    {
      key: 'srpTotal',
      header: 'SRP Total',
      render: (row) => <span className="text-sm font-medium text-purple-600">{formatCurrency(row.srpTotal)}</span>,
    },
    {
      key: 'franchiseeProfit',
      header: 'Profit (15%)',
      render: (row) => <span className="text-sm text-green-600">{formatCurrency(row.franchiseeProfit)}</span>,
    },
    {
      key: 'remitToPD',
      header: 'Remit to PD (85%)',
      render: (row) => <span className="text-sm font-medium text-indigo-600">{formatCurrency(row.remitToPD)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="billing" status={row.status} />,
    },
    {
      key: 'issuedAt',
      header: 'Issued',
      render: (row) => (
        <span className="text-xs text-gray-500">{new Date(row.issuedAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'dueAt',
      header: 'Due',
      render: (row) => <DueLabel dueAt={row.dueAt} status={row.status} />,
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (row) => <PaymentStatusLabel billingId={row.id} payments={payments} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBilling(row);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-zapp-orange hover:bg-orange-50 transition-colors"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUpload(row.id);
            }}
            disabled={uploadingId === row.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
            title="Upload Billing File"
          >
            <Upload size={15} />
          </button>
        </div>
      ),
    },
  ];

  // Simplified, sales-focused columns for the franchisee.
  const franchiseeColumns: TableColumn<BillingRecord>[] = [
    {
      key: 'drNumber',
      header: 'DR Number',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900">
          {billingMeta.get(row.id)?.drNumbers ?? '—'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => {
        const d = billingMeta.get(row.id)?.date;
        return <span className="text-sm text-gray-700">{d ? new Date(d).toLocaleDateString() : '—'}</span>;
      },
    },
    {
      key: 'srpTotal',
      header: 'Total Sales',
      render: (row) => <span className="text-sm font-semibold text-purple-600">{formatCurrency(row.srpTotal)}</span>,
    },
    {
      key: 'franchiseeProfit',
      header: 'Profit (15%)',
      render: (row) => <span className="text-sm font-medium text-green-600">{formatCurrency(row.franchiseeProfit)}</span>,
    },
    {
      key: 'remitToPD',
      header: 'Remit to Distributor (85%)',
      render: (row) => <span className="text-sm font-medium text-indigo-600">{formatCurrency(row.remitToPD)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="billing" status={row.status} />,
    },
    {
      key: 'issuedAt',
      header: 'Issued',
      render: (row) => (
        <span className="text-xs text-gray-500">{new Date(row.issuedAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'dueAt',
      header: 'Due',
      render: (row) => <DueLabel dueAt={row.dueAt} status={row.status} />,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) =>
        row.status === 'paid' ? (
          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle size={12} /> Paid
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePayNow(row);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-zapp-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none"
          >
            <CreditCard size={13} /> Pay Now
          </button>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage invoices and track payments across stores
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasMultiplePlants && (
            <Select
              options={plantOptions}
              value={plantFilter}
              onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }}
              className="w-48"
            />
          )}
          {canGenerateStatement && (
            <Button
              variant="outline"
              size="sm"
              iconLeft={<FileText size={14} />}
              onClick={() => navigate('/billing/statement')}
            >
              Billing Statement
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Download size={14} />}
            loading={exporting}
            onClick={handleExport}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Formula Banners — franchisees only see the SRP/profit split (DR-based
          billing internals are a distributor/billing concern). */}
      <div className={`grid grid-cols-1 gap-3 ${isFranchisee ? '' : 'lg:grid-cols-2'}`}>
        {!isFranchisee && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Receipt size={18} className="text-zapp-orange shrink-0" />
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Zapp Billing (DR-Based)</p>
              <p className="text-sm text-zapp-brown font-medium">
                <span className="font-mono font-bold">Total Payable = (DR Total - Unsold Deduction) + Packaging</span>
              </p>
            </div>
          </div>
        )}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <DollarSign size={18} className="text-indigo-600 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Store Remittance (SRP-Based)</p>
            <p className="text-sm text-indigo-800 font-medium">
              <span className="font-mono font-bold">Remit to Distributor = 85% of SRP Sales | Franchisee Profit = 15% of SRP Sales</span>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isFranchisee ? (
          <>
            <Stat
              icon={<Receipt size={18} />}
              label="Total Sales"
              value={formatCurrency(stats.totalSRP)}
            />
            <Stat
              icon={<DollarSign size={18} />}
              label="Profit (15%)"
              value={formatCurrency(stats.totalProfit)}
            />
            <Stat
              icon={<DollarSign size={18} />}
              label="Remit to Distributor (85%)"
              value={formatCurrency(stats.totalRemittance)}
            />
            <Stat
              icon={<CheckCircle size={18} />}
              label="Total Paid"
              value={formatCurrency(stats.totalPaid)}
            />
            <Stat
              icon={<AlertTriangle size={18} />}
              label="Overdue"
              value={stats.overdueCount}
            />
            <Stat
              icon={<FileSpreadsheet size={18} />}
              label="Total Records"
              value={stats.totalRecords}
            />
          </>
        ) : (
          <>
            <Stat
              icon={<DollarSign size={18} />}
              label="DR Total Payable"
              value={formatCurrency(stats.totalPayable)}
            />
            <Stat
              icon={<DollarSign size={18} />}
              label="SRP Remittance (85%)"
              value={formatCurrency(stats.totalRemittance)}
            />
            <Stat
              icon={<CheckCircle size={18} />}
              label="Total Paid"
              value={formatCurrency(stats.totalPaid)}
            />
            <Stat
              icon={<Receipt size={18} />}
              label="Total SRP Sales"
              value={formatCurrency(stats.totalSRP)}
            />
            <Stat
              icon={<AlertTriangle size={18} />}
              label="Overdue"
              value={stats.overdueCount}
            />
            <Stat
              icon={<FileSpreadsheet size={18} />}
              label="Total Records"
              value={stats.totalRecords}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              placeholder="Filter by status"
            />
            <Select
              options={cutoffOptions}
              value={cutoffFilter}
              onChange={(e) => { setCutoffFilter(e.target.value); setPage(1); }}
              placeholder="Cutoff period"
            />
            <SearchInput
              value={storeSearch}
              onChange={(val) => { setStoreSearch(val); setPage(1); }}
              placeholder="Search store..."
            />
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
        columns={isFranchisee ? franchiseeColumns : columns}
        data={paged}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => setSelectedBilling(row)}
        emptyMessage="No billing records found matching your filters."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          onPageChange: setPage,
        }}
      />

      {/* Billing Detail Drawer */}
      <BillingDetailDrawer
        billing={selectedBilling}
        onClose={() => setSelectedBilling(null)}
      />
    </div>
  );
}
