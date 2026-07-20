import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Eye,
  Download,
  Clock,
  CheckCircle,
  CreditCard,
  FileText,
  Image as ImageIcon,
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
import { exportTableXlsx, type XlsxColumn } from '@/lib/tableExcel';
import { getBillingBreakdown, getCutoffRangeForDate } from '@/lib/billingComputations';
import { computeDrReview, type DrReview } from '@/lib/drReviewComputations';
import BillingDetailDrawer from './BillingDetailDrawer';
import DrPhotosDrawer, { type DrPhotoTarget } from './DrPhotosDrawer';
import FranchiseeRevisionsSection from './FranchiseeRevisionsSection';

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

// Per-DR "billing statement" row shown to the billing user — mirrors the
// UBERDELI billing-summary format (one row per delivery/DR). Returns / delivery
// adjustment / merch. allowance are not tracked yet → 0.000, so Net Amount ==
// DR Amount (same placeholders as the printable BillingStatementPage).
interface BillingStatementRow {
  id: string;
  date: string;
  poNumber: string;
  drNumber: string;
  shopCode: string;
  shopName: string;
  distributorId?: string;
  drAmount: number;
  netAmount: number;
}

// Per-DR review row for the Partner Distributor billing view (boss's revised
// PD table: DR-based, with sold/unsold/lacking/overage + profit split).
interface PdReviewRow {
  deliveryId: string;
  drNumber: string;
  date: string;
  shopName: string;
  storeId: string;
  plantId: string;
  distributorId?: string;
  subPartnerDistributorId?: string;
  status: string;
  review: DrReview;
}

// 3-decimal money with thousands separators (matches the reference statement,
// e.g. 1,861.220). No peso sign — the reference prints plain amounts.
const fmt3 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

// MM/DD/YYYY, matching the reference statement's Delivery Date column.
const mmddyyyy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${m}/${d}/${y}`;
};

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
    subPartnerDistributors,
    plants,
    currentUser,
    payments,
    deliveries,
    beginningInventories,
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
  // SRP-based remittance (85%/15%) is a partner-distributor / franchisee matter —
  // the billing user handles DR-based billing, so hide that banner for them.
  const isBillingUser = currentUser?.role === 'billing_user';

  // Who the 85%/15% remittance split actually concerns. Per boss: "visible lang
  // sa PD, SPD, at franchisee under PD's. The rest hindi nila need makita yan."
  //
  // franchisee_direct is deliberately EXCLUDED: a direct franchisee has no
  // distributor, so there is nobody for them to remit 85% to — the formula
  // describes a relationship they are not in. That is the literal reading of
  // "franchisee under PD's" and it matches the business.
  //
  // ⚠️ Banner ONLY. The same figures still appear in the table (Profit 15% /
  // Remit to PD 85%) and in the SRP Remittance stat, exactly as when this was
  // hidden from the billing user. The boss marked the banner both times; the
  // columns were an explicit keep.
  const seesRemittanceFormula =
    currentUser?.role === 'partner_distributor' ||
    currentUser?.role === 'sub_partner_distributor' ||
    currentUser?.role === 'franchisee_distributor';

  // Unchanged rule, just named: the DR formula is for the people who bill on it,
  // not the store paying it, and the billing user asked for no formula chrome.
  const showDrFormula = !isFranchisee && !isBillingUser;

  // Owner / ops / billing_user see every distributor, so they can filter the
  // billing list by PD (and jump to the consolidated per-PD statement export).
  const canFilterDistributor =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'operations_manager' ||
    currentUser?.role === 'billing_user';
  // A partner distributor filters instead by the Sub-Partner (SPD) assigned to a
  // store, so they can see how much to bill each of their SPDs.
  const isPartnerDistributor = currentUser?.role === 'partner_distributor';

  const [plantFilter, setPlantFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');
  // PD billing filter: Sub-Partner / Franchisee (direct) → dependent entity.
  const [payerType, setPayerType] = useState<'' | 'spd' | 'franchisee'>('');
  const [payerEntity, setPayerEntity] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [cutoffFilter, setCutoffFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBilling, setSelectedBilling] = useState<BillingRecord | null>(null);
  // Billing user: the DR row whose Beginning/Ending photos are being viewed.
  const [photoTarget, setPhotoTarget] = useState<DrPhotoTarget | null>(null);
  const [exporting, setExporting] = useState(false);

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

  // PD (distributor) filter — owner/ops/billing_user only. Lets the billing user
  // pull every store billing under one PD, then export the consolidated statement.
  const distributorFilterOptions: SelectOption[] = [
    { value: '', label: 'All Distributors' },
    ...distributors.map((d) => ({ value: d.id, label: d.name })),
  ];

  // PD billing filter: pick Sub-Partner or Franchisee (direct), then the specific
  // entity. Mirrors the Payments payer filter — a PD's billings are its SPD
  // stores + its direct franchisee stores.
  const payerTypeOptions: SelectOption[] = [
    { value: '', label: 'All Payers' },
    { value: 'spd', label: 'Sub-Partner (SPD)' },
    { value: 'franchisee', label: 'Franchisee (Direct)' },
  ];
  // Dependent entity list — only payers of that type that actually have billings
  // (optionally within the chosen plant), so the options are real.
  const payerEntityOptions: SelectOption[] = useMemo(() => {
    const billedStoreIds = new Set(allBilling.map((b) => b.storeId));
    const relevant = stores.filter(
      (s) => billedStoreIds.has(s.id) && (!plantFilter || s.plantId === plantFilter),
    );
    if (payerType === 'spd') {
      const ids = [...new Set(relevant.filter((s) => s.subPartnerDistributorId).map((s) => s.subPartnerDistributorId!))];
      return [
        { value: '', label: 'All Sub-Partners' },
        ...ids.map((id) => ({ value: id, label: subPartnerDistributors.find((sp) => sp.id === id)?.name ?? id })),
      ];
    }
    if (payerType === 'franchisee') {
      const direct = relevant.filter((s) => !s.subPartnerDistributorId);
      return [{ value: '', label: 'All Franchisees' }, ...direct.map((s) => ({ value: s.id, label: s.name }))];
    }
    return [{ value: '', label: 'Select payer type first' }];
  }, [allBilling, stores, plantFilter, payerType, subPartnerDistributors]);

  // Filter billing records
  const filtered = useMemo(() => {
    let result = [...allBilling];
    if (plantFilter) result = result.filter((b) => b.plantId === plantFilter);
    if (distributorFilter) result = result.filter((b) => b.distributorId === distributorFilter);
    if (isPartnerDistributor && payerType) {
      result = result.filter((b) => {
        const s = stores.find((st) => st.id === b.storeId);
        if (!s) return false;
        return payerType === 'spd' ? !!s.subPartnerDistributorId : !s.subPartnerDistributorId;
      });
      if (payerEntity) {
        result = result.filter((b) => {
          const s = stores.find((st) => st.id === b.storeId);
          if (!s) return false;
          return payerType === 'spd' ? s.subPartnerDistributorId === payerEntity : s.id === payerEntity;
        });
      }
    }
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
    // storeName + the `stores` slice are stable lookups over the closure;
    // including them would re-run the memo every render without semantic change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBilling, plantFilter, distributorFilter, isPartnerDistributor, payerType, payerEntity, statusFilter, storeSearch, cutoffFilter, dateFrom, dateTo]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // KPI stats — reflect the active filters (so a PD sees the running total for
  // the selected SPD, and the billing user sees the total under the selected PD).
  const stats = useMemo(() => {
    const source = filtered;
    return {
      totalPayable: source.reduce((s, b) => s + b.totalPayable, 0),
      totalPaid: source.filter((b) => b.status === 'paid').reduce((s, b) => s + b.totalPayable, 0),
      overdueCount: source.filter((b) => b.status === 'overdue').length,
      totalRecords: source.length,
      totalRemittance: source.reduce((s, b) => s + b.remitToPD, 0),
      totalSRP: source.reduce((s, b) => s + b.srpTotal, 0),
      totalProfit: source.reduce((s, b) => s + b.franchiseeProfit, 0),
    };
  }, [filtered]);

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

  // Billing user sees the UBERDELI-style billing statement — one row per
  // delivery (DR), not per aggregated billing record. Built straight from the
  // deliveries slice (billing_user reads all, per migration 008), the same
  // source the printable Billing Statement uses. Filters that map to a DR line
  // (distributor, store search, cutoff, date range) apply here too.
  const billingUserRows = useMemo<BillingStatementRow[]>(() => {
    if (!isBillingUser) return [];
    let result = deliveries.map((d) => {
      const store = stores.find((s) => s.id === d.storeId);
      return {
        id: d.id,
        date: d.date,
        poNumber: 'ZAPP',
        drNumber: d.drNumber,
        shopCode: store?.shopCode ?? '',
        shopName: store?.name ?? d.storeId,
        distributorId: store?.distributorId,
        drAmount: d.totalDRCost,
        netAmount: d.totalDRCost, // credits are 0 for now → Net == DR Amount
      };
    });
    if (distributorFilter) result = result.filter((r) => r.distributorId === distributorFilter);
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      result = result.filter((r) => r.shopName.toLowerCase().includes(q));
    }
    if (cutoffFilter) result = result.filter((r) => getCutoffRangeForDate(r.date) === cutoffFilter);
    if (dateFrom) result = result.filter((r) => r.date.slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((r) => r.date.slice(0, 10) <= dateTo);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [isBillingUser, deliveries, stores, distributorFilter, storeSearch, cutoffFilter, dateFrom, dateTo]);

  const billingUserPaged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return billingUserRows.slice(start, start + PAGE_SIZE);
  }, [billingUserRows, page]);

  // Partner Distributor: per-DR review rows (boss's revised PD billing view).
  // Built from the PD's deliveries (RLS-scoped) + the store's Beginning/Ending
  // inventories, honoring the PD payer/plant/cutoff/date filters.
  const pdReviewRows = useMemo<PdReviewRow[]>(() => {
    if (!isPartnerDistributor) return [];
    let rows: PdReviewRow[] = deliveries.map((d) => {
      const store = stores.find((s) => s.id === d.storeId);
      const beginningInv = beginningInventories.find((bi) => bi.deliveryId === d.id);
      const endingInv = endingInventories.find((ei) => ei.deliveryId === d.id);
      return {
        deliveryId: d.id,
        drNumber: d.drNumber,
        date: d.date,
        shopName: store?.name ?? d.storeId,
        storeId: d.storeId,
        plantId: d.plantId,
        distributorId: store?.distributorId,
        subPartnerDistributorId: store?.subPartnerDistributorId,
        status: endingInv ? endingInv.status : beginningInv ? 'in_progress' : 'awaiting_report',
        review: computeDrReview(d, beginningInv, endingInv),
      };
    });
    if (plantFilter) rows = rows.filter((r) => r.plantId === plantFilter);
    if (payerType) {
      rows = rows.filter((r) =>
        payerType === 'spd' ? !!r.subPartnerDistributorId : !r.subPartnerDistributorId,
      );
      if (payerEntity) {
        rows = rows.filter((r) =>
          payerType === 'spd' ? r.subPartnerDistributorId === payerEntity : r.storeId === payerEntity,
        );
      }
    }
    if (cutoffFilter) rows = rows.filter((r) => getCutoffRangeForDate(r.date) === cutoffFilter);
    if (dateFrom) rows = rows.filter((r) => r.date.slice(0, 10) >= dateFrom);
    if (dateTo) rows = rows.filter((r) => r.date.slice(0, 10) <= dateTo);
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [isPartnerDistributor, deliveries, stores, beginningInventories, endingInventories, plantFilter, payerType, payerEntity, cutoffFilter, dateFrom, dateTo]);

  const pdReviewPaged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return pdReviewRows.slice(start, start + PAGE_SIZE);
  }, [pdReviewRows, page]);

  const formatCurrency = (n: number) => `P${n.toLocaleString()}`;

  // Pay Now — NextPay integration is not wired yet (boss: "coconnect natin yan
  // kay NextPay"). For now the button acknowledges the intent.
  const handlePayNow = (b: BillingRecord) => {
    addToast('info', `Pay Now for ${b.id.toUpperCase()} — NextPay integration coming soon.`);
  };

  // Export handler — "what you see is what you get": exports the table the
  // current user is actually looking at (the per-DR statement rows for the
  // billing user, the aggregated billing records for everyone else), honoring
  // the active filters, as a real .xlsx. Replaces the old plain-CSV stub that
  // pulled from empty mock data and never matched the printable statement.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (isBillingUser) {
        const columns: XlsxColumn[] = [
          { header: 'Delivery Date', key: 'date', width: 12 },
          { header: 'PO Number', key: 'poNumber', width: 10 },
          { header: 'DR Number', key: 'drNumber', width: 20 },
          { header: 'Shop Code', key: 'shopCode', width: 12 },
          { header: 'Shop Name', key: 'shopName', width: 28 },
          { header: 'DR Amount (Vat Inc.)', key: 'drAmount', width: 16, numFmt: '#,##0.000' },
          { header: 'Returns (Credit) (Vat Inc.)', key: 'returns', width: 16, numFmt: '#,##0.000' },
          { header: 'Delivery Adjustment (Credit) (Vat Inc.)', key: 'deliveryAdjustment', width: 18, numFmt: '#,##0.000' },
          { header: 'Merch. Allowance (Vat Inc.)', key: 'merchAllowance', width: 16, numFmt: '#,##0.000' },
          { header: 'Net Amount (Vat Inc.)', key: 'netAmount', width: 16, numFmt: '#,##0.000' },
        ];
        const rows = billingUserRows.map((r) => ({
          date: mmddyyyy(r.date),
          poNumber: r.poNumber,
          drNumber: r.drNumber,
          shopCode: r.shopCode,
          shopName: r.shopName,
          drAmount: r.drAmount,
          returns: 0,
          deliveryAdjustment: 0,
          merchAllowance: 0,
          netAmount: r.netAmount,
        }));
        await exportTableXlsx(`Billing-DR-Export-${stamp}.xlsx`, 'DR Billing', columns, rows);
      } else {
        const columns: XlsxColumn[] = [
          { header: 'Invoice #', key: 'invoice', width: 22 },
          { header: 'Store', key: 'store', width: 24 },
          { header: 'Distributor', key: 'distributor', width: 22 },
          { header: 'Period', key: 'period', width: 16 },
          { header: 'DR Total', key: 'drTotal', width: 14, numFmt: '#,##0.00' },
          { header: 'Unsold Deduction', key: 'unsold', width: 15, numFmt: '#,##0.00' },
          { header: 'Packaging', key: 'packaging', width: 13, numFmt: '#,##0.00' },
          { header: 'Total Payable', key: 'totalPayable', width: 15, numFmt: '#,##0.00' },
          { header: 'SRP Total', key: 'srpTotal', width: 14, numFmt: '#,##0.00' },
          { header: 'Profit (15%)', key: 'profit', width: 13, numFmt: '#,##0.00' },
          { header: 'Remit to PD (85%)', key: 'remit', width: 16, numFmt: '#,##0.00' },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Issued', key: 'issued', width: 14 },
          { header: 'Due', key: 'due', width: 14 },
        ];
        const rows = filtered.map((b) => ({
          invoice: b.id.toUpperCase(),
          store: storeName(b.storeId),
          distributor: distributorName(b.distributorId),
          period: b.period,
          drTotal: b.drTotal,
          unsold: b.unsoldDeduction,
          packaging: b.packagingTotal,
          totalPayable: b.totalPayable,
          srpTotal: b.srpTotal,
          profit: b.franchiseeProfit,
          remit: b.remitToPD,
          status: b.status,
          issued: new Date(b.issuedAt).toLocaleDateString(),
          due: new Date(b.dueAt).toLocaleDateString(),
        }));
        await exportTableXlsx(`Billing-Export-${stamp}.xlsx`, 'Billing', columns, rows);
      }
    } catch (err) {
      console.error('[BillingPage] export failed:', err);
      addToast('error', 'Hindi ma-export ang Excel. Pakisubukan ulit.');
    } finally {
      setExporting(false);
    }
    // storeName/distributorName are stable closures over the `stores`/`distributors`
    // slices; including them would rebuild the callback every render for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBillingUser, billingUserRows, filtered, addToast]);

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

  // Billing user: UBERDELI billing-summary columns (per-DR). Returns / delivery
  // adjustment / merch. allowance aren't tracked yet → printed as 0.000.
  const billingUserColumns: TableColumn<BillingStatementRow>[] = [
    {
      key: 'date',
      header: 'Delivery Date',
      render: (row) => <span className="text-sm text-gray-700 whitespace-nowrap">{mmddyyyy(row.date)}</span>,
    },
    {
      key: 'poNumber',
      header: 'PO Number',
      render: (row) => <span className="text-sm text-gray-700">{row.poNumber}</span>,
    },
    {
      key: 'drNumber',
      header: 'DR Number',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900 whitespace-nowrap">{row.drNumber}</span>
      ),
    },
    {
      key: 'shopCode',
      header: 'Shop Code',
      // Blank when unassigned — matches the billing user's manual files + the
      // printable BillingStatementPage. Shop code comes from franchisee
      // registration (store.shopCode), shown as-is once assigned.
      render: (row) => <span className="text-sm text-gray-700">{row.shopCode || ''}</span>,
    },
    {
      key: 'shopName',
      header: 'Shop Name',
      render: (row) => <span className="text-sm text-gray-900">{row.shopName}</span>,
    },
    {
      key: 'drAmount',
      header: 'DR Amount (Vat Inc.)',
      render: (row) => <span className="text-sm font-medium tabular-nums whitespace-nowrap">{fmt3(row.drAmount)}</span>,
    },
    {
      key: 'returns',
      header: 'Returns (Credit) (Vat Inc.)',
      render: () => <span className="text-sm text-gray-500 tabular-nums">0.000</span>,
    },
    {
      key: 'deliveryAdjustment',
      header: 'Delivery Adjustment (Credit) (Vat Inc.)',
      render: () => <span className="text-sm text-gray-500 tabular-nums">0.000</span>,
    },
    {
      key: 'merchAllowance',
      header: 'Merch. Allowance (Vat Inc.)',
      render: () => <span className="text-sm text-gray-500 tabular-nums">0.000</span>,
    },
    {
      key: 'netAmount',
      header: 'Net Amount (Vat Inc.)',
      render: (row) => (
        <span className="text-sm font-bold text-zapp-orange tabular-nums whitespace-nowrap">{fmt3(row.netAmount)}</span>
      ),
    },
    {
      key: 'photos',
      header: 'Photos',
      // Explicit "View" affordance per DR (per boss: "cclick lang nila view") —
      // opens the DR slip + donut-crate photos for report verification.
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPhotoTarget({
              deliveryId: row.id,
              drNumber: row.drNumber,
              date: mmddyyyy(row.date),
              shopName: row.shopName,
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-zapp-orange hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap"
          title="View DR slip + donut-crate photos"
        >
          <ImageIcon size={13} /> View
        </button>
      ),
    },
  ];

  // Partner Distributor: per-DR review columns (boss's revised PD billing).
  const pdReviewColumns: TableColumn<PdReviewRow>[] = [
    {
      key: 'drNumber',
      header: 'DR Number',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900 whitespace-nowrap">{row.drNumber}</span>
      ),
    },
    {
      key: 'date',
      header: 'Delivery Date',
      render: (row) => <span className="text-sm text-gray-700 whitespace-nowrap">{mmddyyyy(row.date)}</span>,
    },
    {
      key: 'drTotal',
      header: 'DR Total',
      render: (row) => <span className="text-sm font-medium tabular-nums">{row.review.drTotalQty}</span>,
    },
    {
      key: 'sold',
      header: 'Total Sold',
      render: (row) => <span className="text-sm tabular-nums">{row.review.totalSold}</span>,
    },
    {
      key: 'unsold',
      header: 'Total Unsold',
      render: (row) => <span className="text-sm tabular-nums">{row.review.totalUnsold}</span>,
    },
    {
      key: 'lacking',
      header: 'Lacking Total',
      render: (row) => (
        <span className={`text-sm tabular-nums ${row.review.lackingTotal > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
          {row.review.lackingTotal}
        </span>
      ),
    },
    {
      key: 'overage',
      header: 'Overage Total',
      render: (row) => (
        <span className={`text-sm tabular-nums ${row.review.overageTotal > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
          {row.review.overageTotal}
        </span>
      ),
    },
    {
      key: 'gross',
      header: 'Total Gross Sales',
      render: (row) => (
        <span className="text-sm font-medium text-purple-600 tabular-nums whitespace-nowrap">{formatCurrency(row.review.grossSales)}</span>
      ),
    },
    {
      key: 'fprofit',
      header: 'Franchisee Profit (15%)',
      render: (row) => (
        <span className="text-sm text-green-600 tabular-nums whitespace-nowrap">{formatCurrency(row.review.franchiseeProfit)}</span>
      ),
    },
    {
      key: 'remit',
      header: 'Remit to PD (85%)',
      render: (row) => (
        <span className="text-sm text-indigo-600 tabular-nums whitespace-nowrap">{formatCurrency(row.review.remitToPD)}</span>
      ),
    },
    {
      key: 'pdprofit',
      header: 'PD Profit',
      render: (row) => (
        <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${row.review.pdProfit < 0 ? 'text-red-600' : 'text-zapp-orange'}`}>
          {formatCurrency(row.review.pdProfit)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const cls =
          row.status === 'approved'
            ? 'text-green-700 bg-green-50'
            : row.status === 'awaiting_report'
              ? 'text-gray-500 bg-gray-100'
              : 'text-blue-700 bg-blue-50';
        return (
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap ${cls}`}>
            {row.status.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'photos',
      header: 'Photos',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPhotoTarget({
              deliveryId: row.deliveryId,
              drNumber: row.drNumber,
              date: mmddyyyy(row.date),
              shopName: row.shopName,
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-zapp-orange hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap"
          title="View DR slip + donut-crate photos"
        >
          <ImageIcon size={13} /> View
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
              onClick={() =>
                navigate(
                  distributorFilter
                    ? `/billing/statement?dist=${distributorFilter}`
                    : '/billing/statement',
                )
              }
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

      {/* Formula Banners.
            • DR-based       — everyone except franchisees and the billing user.
            • SRP remittance — only the roles the 85%/15% split concerns
                               (PD, SPD, franchisee under a PD).
          Each is computed independently, then the wrapper renders only if at
          least one survives — otherwise a franchisee_direct (who now sees
          neither) would get an empty grid holding a gap. Two columns only when
          both are actually shown, so a lone banner is never half-width. */}
      {(showDrFormula || seesRemittanceFormula) && (
        <div
          className={`grid grid-cols-1 gap-3 ${
            showDrFormula && seesRemittanceFormula ? 'lg:grid-cols-2' : ''
          }`}
        >
          {showDrFormula && (
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
          {seesRemittanceFormula && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <DollarSign size={18} className="text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Store Remittance (SRP-Based)</p>
                <p className="text-sm text-indigo-800 font-medium">
                  <span className="font-mono font-bold">Remit to Distributor = 85% of SRP Sales | Franchisee Profit = 15% of SRP Sales</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isBillingUser ? 'xl:grid-cols-4' : 'xl:grid-cols-6'}`}>
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
        ) : isBillingUser ? (
          /* Billing user: DR-focused only — no SRP remittance / SRP sales
             (per boss: they only need the DR price). */
          <>
            <Stat
              icon={<DollarSign size={18} />}
              label="DR Total Payable"
              value={formatCurrency(stats.totalPayable)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {isPartnerDistributor ? (
              // PD: Plant → Sub-Partner/Franchisee → entity → cutoff, plus the
              // From/To dates (kept — needed to review past transactions).
              <>
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
                  placeholder="Cutoff period"
                />
              </>
            ) : (
              <>
                {canFilterDistributor && (
                  <Select
                    options={distributorFilterOptions}
                    value={distributorFilter}
                    onChange={(e) => { setDistributorFilter(e.target.value); setPage(1); }}
                    placeholder="Filter by distributor"
                  />
                )}
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
              </>
            )}
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

      {/* Table — billing user gets the per-DR UBERDELI statement view; all
          other roles keep the aggregated per-billing-record table. */}
      {isBillingUser && (
        <p className="text-xs text-gray-500 -mb-2">
          I-click ang <span className="font-medium text-zapp-orange">View</span> sa
          dulo ng bawat DR row para makita ang DR slip at donut-crate photos ng store
          (para ma-double-check ang report).
        </p>
      )}
      {isBillingUser ? (
        <Table
          columns={billingUserColumns}
          data={billingUserPaged}
          keyExtractor={(row) => row.id}
          onRowClick={(row) =>
            setPhotoTarget({
              deliveryId: row.id,
              drNumber: row.drNumber,
              date: mmddyyyy(row.date),
              shopName: row.shopName,
            })
          }
          emptyMessage="No deliveries found matching your filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: billingUserRows.length,
            onPageChange: setPage,
          }}
        />
      ) : isPartnerDistributor ? (
        <Table
          columns={pdReviewColumns}
          data={pdReviewPaged}
          keyExtractor={(row) => row.deliveryId}
          onRowClick={(row) =>
            setPhotoTarget({
              deliveryId: row.deliveryId,
              drNumber: row.drNumber,
              date: mmddyyyy(row.date),
              shopName: row.shopName,
            })
          }
          emptyMessage="No deliveries found matching your filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: pdReviewRows.length,
            onPageChange: setPage,
          }}
        />
      ) : (
        <>
          {isFranchisee && <FranchiseeRevisionsSection />}
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
        </>
      )}

      {/* Billing Detail Drawer */}
      <BillingDetailDrawer
        billing={selectedBilling}
        onClose={() => setSelectedBilling(null)}
      />

      {/* Billing user: per-DR Beginning/Ending photos (report verification) */}
      <DrPhotosDrawer target={photoTarget} onClose={() => setPhotoTarget(null)} />
    </div>
  );
}
