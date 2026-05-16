// ============================================================
// ZAPP Donuts ERP - Area Supervisor Dashboard
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, type TableColumn } from '@/components/ui/Table';
import {
  Store as StoreIcon,
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  ClipboardCheck,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#FF6B00', '#2563EB', '#22C55E', '#EAB308', '#8B5CF6', '#EC4899'];

export function AreaManagerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const currentUser = useStore((s) => s.currentUser);
  const stores = useStore((s) => s.stores);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const billingRecords = useStore((s) => s.billingRecords);
  const endingInventories = useStore((s) => s.endingInventories);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── My Stores ───────────────────────────────────────────────
  const myStoreIds = useMemo(() => currentUser?.assignedStoreIds ?? [], [currentUser]);
  const myStores = useMemo(() => stores.filter((s) => myStoreIds.includes(s.id)), [stores, myStoreIds]);

  // ── Pending reviews (direct-franchise EIs awaiting reviewer action) ──
  const pendingReviewCount = useMemo(() => {
    const directStoreIds = new Set(
      myStores.filter((s) => s.franchiseType === 'direct').map((s) => s.id),
    );
    return endingInventories.filter(
      (ei) => directStoreIds.has(ei.storeId) && ei.status === 'pending_review',
    ).length;
  }, [endingInventories, myStores]);
  const mySales = useMemo(
    () => salesMetrics.filter((m) => myStoreIds.includes(m.storeId)),
    [salesMetrics, myStoreIds],
  );
  const myBilling = useMemo(
    () => billingRecords.filter((b) => myStoreIds.includes(b.storeId)),
    [billingRecords, myStoreIds],
  );

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const storeCount = myStores.filter((s) => s.status === 'active').length;
    const totalDR = mySales.reduce((sum, m) => sum + m.drSales, 0);
    const totalSRP = mySales.reduce((sum, m) => sum + m.srpSales, 0);

    // % Contribution vs all sales
    const allSRP = salesMetrics.reduce((sum, m) => sum + m.srpSales, 0);
    const pctContribution = allSRP > 0 ? ((totalSRP / allSRP) * 100) : 0;

    return { storeCount, totalDR, totalSRP, pctContribution };
  }, [myStores, mySales, salesMetrics]);

  // ── Store Ranking ───────────────────────────────────────────
  const storeRanking = useMemo(() => {
    const sMap = new Map<string, { srpSales: number; drSales: number }>();
    mySales.forEach((m) => {
      const entry = sMap.get(m.storeId) ?? { srpSales: 0, drSales: 0 };
      entry.srpSales += m.srpSales;
      entry.drSales += m.drSales;
      sMap.set(m.storeId, entry);
    });
    return myStores
      .map((s) => ({
        id: s.id,
        name: s.name,
        area: s.area,
        province: s.province,
        status: s.status,
        srpSales: sMap.get(s.id)?.srpSales ?? 0,
        drSales: sMap.get(s.id)?.drSales ?? 0,
      }))
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [myStores, mySales]);

  const storeColumns: TableColumn<(typeof storeRanking)[0]>[] = [
    {
      key: 'rank',
      header: '#',
      render: (_row, idx) => <span className="font-semibold text-gray-500">{idx + 1}</span>,
    },
    { key: 'name', header: 'Store', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'area', header: 'Area' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge category="store" status={row.status} size="sm" /> },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      render: (row) => <span className="font-semibold text-zapp-green">P{row.srpSales.toLocaleString()}</span>,
    },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => <span>P{row.drSales.toLocaleString()}</span>,
    },
  ];

  // ── Sales by Area ───────────────────────────────────────────
  const salesByArea = useMemo(() => {
    const byArea = new Map<string, number>();
    mySales.forEach((m) => {
      const area = myStores.find((s) => s.id === m.storeId)?.area ?? 'Unknown';
      byArea.set(area, (byArea.get(area) ?? 0) + m.srpSales);
    });
    return Array.from(byArea.entries())
      .map(([area, sales]) => ({ area, sales }))
      .sort((a, b) => b.sales - a.sales);
  }, [mySales, myStores]);

  // ── Payment Status Overview ─────────────────────────────────
  const paymentOverview = useMemo(() => {
    const counts = { pending: 0, issued: 0, paid: 0, overdue: 0 };
    myBilling.forEach((b) => {
      if (b.status in counts) counts[b.status as keyof typeof counts]++;
    });
    return [
      { name: 'Pending', value: counts.pending, color: '#EAB308' },
      { name: 'Issued', value: counts.issued, color: '#3B82F6' },
      { name: 'Paid', value: counts.paid, color: '#22C55E' },
      { name: 'Overdue', value: counts.overdue, color: '#EF4444' },
    ];
  }, [myBilling]);

  const fmt = (n: number) => `P${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <Skeleton variant="card" />
        <Skeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Area Supervisor Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Performance for your assigned stores and areas
        </p>
      </div>

      {/* Pending Reviews alert (Direct-to-Zapp submissions) */}
      {pendingReviewCount > 0 && (
        <button
          onClick={() => navigate('/inventory-reviews')}
          className="w-full text-left rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex items-center gap-3 hover:bg-amber-100 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <ClipboardCheck size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900">
              {pendingReviewCount} direct-store ending inventory submission
              {pendingReviewCount === 1 ? '' : 's'} await your review
            </p>
            <p className="text-sm text-amber-700">Click to open the reviewer queue.</p>
          </div>
          <ChevronRight size={18} className="text-amber-700 shrink-0" />
        </button>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<StoreIcon size={20} />} label="My Stores" value={kpis.storeCount} />
        <Stat icon={<DollarSign size={20} />} label="Total DR Sales" value={fmt(kpis.totalDR)} />
        <Stat icon={<TrendingUp size={20} />} label="Total SRP Sales" value={fmt(kpis.totalSRP)} change={7.8} />
        <Stat icon={<PieChartIcon size={20} />} label="% Contribution" value={`${kpis.pctContribution.toFixed(1)}%`} />
      </div>

      {/* Sales by Area + Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Area */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales by Area</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesByArea}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="area" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {salesByArea.map((_entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Payment Status Overview</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentOverview}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {paymentOverview.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Store Ranking Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">Store Ranking</h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={storeColumns}
            data={storeRanking}
            keyExtractor={(row) => row.id}
            emptyMessage="No stores assigned to you."
          />
        </CardContent>
      </Card>
    </div>
  );
}
