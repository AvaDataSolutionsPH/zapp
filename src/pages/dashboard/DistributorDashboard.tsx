// ============================================================
// ZAPP Donuts ERP - Distributor Dashboard
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
  TrendingUp,
  DollarSign,
  BarChart3,
  Trophy,
  ClipboardCheck,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function DistributorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const currentUser = useStore((s) => s.currentUser);
  const stores = useStore((s) => s.stores);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const billingRecords = useStore((s) => s.billingRecords);
  const endingInventories = useStore((s) => s.endingInventories);
  const distId = currentUser?.distributorId ?? '';

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── Filtered data ───────────────────────────────────────────
  const myStores = useMemo(() => stores.filter((s) => s.distributorId === distId), [stores, distId]);
  const mySales = useMemo(() => salesMetrics.filter((m) => m.distributorId === distId), [salesMetrics, distId]);
  const myBilling = useMemo(() => billingRecords.filter((b) => b.distributorId === distId), [billingRecords, distId]);

  // ── Pending reviews (EIs awaiting reviewer action) ──────────
  const pendingReviewCount = useMemo(() => {
    const ids = new Set(myStores.map((s) => s.id));
    return endingInventories.filter(
      (ei) => ids.has(ei.storeId) && ei.status === 'pending_review',
    ).length;
  }, [endingInventories, myStores]);

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const storeCount = myStores.filter((s) => s.status === 'active').length;
    const totalSRP = mySales.reduce((sum, m) => sum + m.srpSales, 0);
    const totalDR = mySales.reduce((sum, m) => sum + m.drSales, 0);
    const avgPerStore = storeCount > 0 ? totalSRP / storeCount : 0;
    const totalRemittance = myBilling.reduce((sum, b) => sum + b.remitToPD, 0);
    const totalCollected = myBilling.filter((b) => b.status === 'paid').reduce((sum, b) => sum + b.remitToPD, 0);
    const totalDRBilling = myBilling.reduce((sum, b) => sum + b.totalPayable, 0);
    return { storeCount, totalSRP, totalDR, avgPerStore, totalRemittance, totalCollected, totalDRBilling };
  }, [myStores, mySales, myBilling]);

  // ── Store Performance Table ─────────────────────────────────
  const storePerformance = useMemo(() => {
    const sMap = new Map<string, { srpSales: number; drSales: number }>();
    mySales.forEach((m) => {
      const entry = sMap.get(m.storeId) ?? { srpSales: 0, drSales: 0 };
      entry.srpSales += m.srpSales;
      entry.drSales += m.drSales;
      sMap.set(m.storeId, entry);
    });
    const bMap = new Map<string, { remittance: number; drBilling: number }>();
    myBilling.forEach((b) => {
      const entry = bMap.get(b.storeId) ?? { remittance: 0, drBilling: 0 };
      entry.remittance += b.remitToPD;
      entry.drBilling += b.totalPayable;
      bMap.set(b.storeId, entry);
    });
    return myStores
      .map((s) => ({
        id: s.id,
        name: s.name,
        area: s.area,
        status: s.status,
        srpSales: sMap.get(s.id)?.srpSales ?? 0,
        drSales: sMap.get(s.id)?.drSales ?? 0,
        remittance: bMap.get(s.id)?.remittance ?? 0,
        drBilling: bMap.get(s.id)?.drBilling ?? 0,
      }))
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [myStores, mySales, myBilling]);

  const storeColumns: TableColumn<(typeof storePerformance)[0]>[] = [
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
    {
      key: 'remittance',
      header: 'Remittance (85%)',
      render: (row) => <span className="font-semibold text-indigo-600">P{row.remittance.toLocaleString()}</span>,
    },
    {
      key: 'drBilling',
      header: 'Zapp DR Billing',
      render: (row) => <span className="text-zapp-orange">P{row.drBilling.toLocaleString()}</span>,
    },
  ];

  // ── Sales Trend ─────────────────────────────────────────────
  const salesTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    mySales.forEach((m) => {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.srpSales);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, sales]) => ({
        date: new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales,
      }));
  }, [mySales]);

  // ── Leaderboard Position ────────────────────────────────────
  const leaderboard = useMemo(() => {
    const distSales = new Map<string, number>();
    salesMetrics.forEach((m) => {
      if (m.distributorId) {
        distSales.set(m.distributorId, (distSales.get(m.distributorId) ?? 0) + m.srpSales);
      }
    });
    const sorted = Array.from(distSales.entries()).sort(([, a], [, b]) => b - a);
    const position = sorted.findIndex(([id]) => id === distId) + 1;
    const totalDist = sorted.length;
    const myTotal = distSales.get(distId) ?? 0;
    const topTotal = sorted[0]?.[1] ?? 0;
    return { position, totalDist, myTotal, topTotal };
  }, [salesMetrics, distId]);

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
        <h1 className="text-2xl font-bold text-gray-900">Distributor Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Performance overview for your distribution network
        </p>
      </div>

      {/* Pending Reviews alert */}
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
              {pendingReviewCount} ending inventory submission
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
        <Stat icon={<TrendingUp size={20} />} label="Total SRP Sales" value={fmt(kpis.totalSRP)} change={9.2} />
        <Stat icon={<DollarSign size={20} />} label="Total Remittance (85%)" value={fmt(kpis.totalRemittance)} />
        <Stat icon={<BarChart3 size={20} />} label="Total Collected" value={fmt(kpis.totalCollected)} />
      </div>

      {/* Billing Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<DollarSign size={20} />} label="Total DR Sales" value={fmt(kpis.totalDR)} />
        <Stat icon={<DollarSign size={20} />} label="Zapp DR Billing (ref)" value={fmt(kpis.totalDRBilling)} />
        <Stat icon={<BarChart3 size={20} />} label="Avg SRP / Store" value={fmt(Math.round(kpis.avgPerStore))} />
      </div>

      {/* Sales Trend + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales Trend (My Network)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Line type="monotone" dataKey="sales" stroke="#FF6B00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leaderboard Position */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" />
              <h3 className="text-base font-semibold text-gray-900">Leaderboard</h3>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-white">
                #{leaderboard.position || '--'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              out of {leaderboard.totalDist} distributors
            </p>
            <div className="w-full mt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">My Total Sales</span>
                <span className="font-semibold">{fmt(leaderboard.myTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Top Distributor</span>
                <span className="font-semibold text-zapp-orange">{fmt(leaderboard.topTotal)}</span>
              </div>
              {leaderboard.topTotal > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-zapp-orange h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (leaderboard.myTotal / leaderboard.topTotal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Performance Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">My Stores Performance</h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={storeColumns}
            data={storePerformance}
            keyExtractor={(row) => row.id}
            emptyMessage="No stores in your network."
          />
        </CardContent>
      </Card>
    </div>
  );
}
