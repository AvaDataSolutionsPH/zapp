// ============================================================
// ZAPP Donuts ERP - Operations Supervisor Dashboard
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, type TableColumn } from '@/components/ui/Table';
import {
  Truck,
  AlertTriangle,
  TrendingDown,
  FileText,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { Delivery } from '@/types';

export function OperationsDashboard() {
  const [loading, setLoading] = useState(true);

  const deliveries = useStore((s) => s.deliveries);
  const beginningInventories = useStore((s) => s.beginningInventories);
  const endingInventories = useStore((s) => s.endingInventories);
  const applications = useStore((s) => s.applications);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const stores = useStore((s) => s.stores);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── KPI Calculations ────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeDeliveries = deliveries.filter(
      (d) => d.status === 'scheduled' || d.status === 'in_transit',
    ).length;

    // AI discrepancies: items from beginningInventories with AI results
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDiscrepancies = beginningInventories
      .filter((bi) => bi.date.slice(0, 10) === todayStr)
      .reduce((count, bi) => count + bi.aiResults.filter((r) => r.type === 'discrepancy').length, 0);

    // Unsold rate from ending inventories
    const totalDelivered = deliveries
      .filter((d) => d.status === 'delivered' || d.status === 'reconciled')
      .reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);
    const totalUnsold = endingInventories.reduce(
      (sum, ei) => sum + ei.unsoldItems.reduce((s, i) => s + i.quantity, 0),
      0,
    );
    const unsoldRate = totalDelivered > 0 ? ((totalUnsold / totalDelivered) * 100) : 0;

    const pendingApps = applications.filter((a) => a.status === 'pending').length;

    return { activeDeliveries, todayDiscrepancies, unsoldRate, pendingApps };
  }, [deliveries, beginningInventories, endingInventories, applications]);

  // ── Sales Overview ──────────────────────────────────────────
  const salesOverview = useMemo(() => {
    const byDate = new Map<string, number>();
    salesMetrics.forEach((m) => {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.srpSales);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, sales]) => ({
        date: new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales,
      }));
  }, [salesMetrics]);

  // ── Delivery Accuracy ───────────────────────────────────────
  const deliveryAccuracy = useMemo(() => {
    const scheduled = deliveries.filter((d) => d.status === 'scheduled').length;
    const inTransit = deliveries.filter((d) => d.status === 'in_transit').length;
    const delivered = deliveries.filter((d) => d.status === 'delivered').length;
    const reconciled = deliveries.filter((d) => d.status === 'reconciled').length;
    return [
      { status: 'Scheduled', count: scheduled },
      { status: 'In Transit', count: inTransit },
      { status: 'Delivered', count: delivered },
      { status: 'Reconciled', count: reconciled },
    ];
  }, [deliveries]);

  // ── AI Discrepancy Summary ──────────────────────────────────
  const aiSummary = useMemo(() => {
    const all = beginningInventories.flatMap((bi) => bi.aiResults);
    const high = all.filter((r) => r.confidence === 'high').length;
    const medium = all.filter((r) => r.confidence === 'medium').length;
    const low = all.filter((r) => r.confidence === 'low').length;
    return { high, medium, low, total: all.length };
  }, [beginningInventories]);

  // ── Unsold Trend (last 14 days) ─────────────────────────────
  const unsoldTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    endingInventories.forEach((ei) => {
      const total = ei.unsoldItems.reduce((s, i) => s + i.quantity, 0);
      byDate.set(ei.date, (byDate.get(ei.date) ?? 0) + total);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, unsold]) => ({
        date: new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        unsold,
      }));
  }, [endingInventories]);

  // ── Recent Deliveries ───────────────────────────────────────
  const recentDeliveries = useMemo(
    () =>
      [...deliveries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [deliveries],
  );

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);

  const deliveryColumns: TableColumn<Delivery>[] = [
    { key: 'drNumber', header: 'DR #', render: (row) => <span className="font-mono text-sm">{row.drNumber}</span> },
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => <span className="font-medium">{storeMap.get(row.storeId) ?? row.storeId}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => new Date(row.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    {
      key: 'totalDRCost',
      header: 'DR Total',
      render: (row) => <span>P{row.totalDRCost.toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="delivery" status={row.status} size="sm" />,
    },
  ];

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor deliveries, inventory, and operational health</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<Truck size={20} />}
          label="Active Deliveries"
          value={kpis.activeDeliveries}
        />
        <Stat
          icon={<AlertTriangle size={20} />}
          label="AI Discrepancies Today"
          value={kpis.todayDiscrepancies}
        />
        <Stat
          icon={<TrendingDown size={20} />}
          label="Unsold Rate"
          value={`${kpis.unsoldRate.toFixed(1)}%`}
          change={-2.3}
        />
        <Stat
          icon={<FileText size={20} />}
          label="Pending Applications"
          value={kpis.pendingApps}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Overview */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales Overview (14 Days)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={salesOverview}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Line type="monotone" dataKey="sales" stroke="#FF6B00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Delivery Accuracy */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Delivery Status Breakdown</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deliveryAccuracy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Discrepancy + Unsold Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">AI Discrepancy Summary</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-gray-900">{aiSummary.total}</p>
              <p className="text-sm text-gray-500">Total AI Results</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">High Confidence</span>
                </div>
                <span className="text-sm font-bold text-green-600">{aiSummary.high}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-700">Medium Confidence</span>
                </div>
                <span className="text-sm font-bold text-yellow-600">{aiSummary.medium}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-700">Low Confidence</span>
                </div>
                <span className="text-sm font-bold text-red-600">{aiSummary.low}</span>
              </div>
            </div>
            {aiSummary.low > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs text-red-700">
                  <AlertTriangle size={14} className="inline mr-1" />
                  {aiSummary.low} low-confidence items require manual review.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unsold Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Unsold Trend (14 Days)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={unsoldTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: unknown) => [Number(value), 'Unsold Units']} />
                <Line type="monotone" dataKey="unsold" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliveries Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">Recent Deliveries</h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={deliveryColumns}
            data={recentDeliveries}
            keyExtractor={(row) => row.id}
            emptyMessage="No deliveries found."
          />
        </CardContent>
      </Card>
    </div>
  );
}
