// ============================================================
// ZAPP Donuts ERP - Owner Dashboard
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, type TableColumn } from '@/components/ui/Table';
import {
  DollarSign,
  TrendingUp,
  Store as StoreIcon,
  BarChart3,
  Package,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
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

const COLORS = ['#FF6B00', '#2563EB', '#16A34A', '#EAB308', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export function OwnerDashboard() {
  const [loading, setLoading] = useState(true);

  const salesMetrics = useStore((s) => s.salesMetrics);
  const stores = useStore((s) => s.stores);
  const plants = useStore((s) => s.plants);
  const distributors = useStore((s) => s.distributors);
  const applications = useStore((s) => s.applications);
  const billingRecords = useStore((s) => s.billingRecords);
  const packagingOrders = useStore((s) => s.packagingOrders);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── KPI Calculations ────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalDR = salesMetrics.reduce((sum, m) => sum + m.drSales, 0);
    const totalSRP = salesMetrics.reduce((sum, m) => sum + m.srpSales, 0);
    const activeStores = stores.filter((s) => s.status === 'active').length;
    const avgPerStore = activeStores > 0 ? totalSRP / activeStores : 0;
    return { totalDR, totalSRP, activeStores, avgPerStore };
  }, [salesMetrics, stores]);

  // ── Sales Trend (last 30 days aggregate by date) ────────────
  const salesTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    salesMetrics.forEach((m) => {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.srpSales);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, sales]) => ({
        date: new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales,
      }));
  }, [salesMetrics]);

  // ── Sales by Plant ──────────────────────────────────────────
  const salesByPlant = useMemo(() => {
    const byPlant = new Map<string, number>();
    salesMetrics.forEach((m) => {
      byPlant.set(m.plantId, (byPlant.get(m.plantId) ?? 0) + m.srpSales);
    });
    return plants.map((p) => ({
      name: p.name.replace(' Plant', ''),
      sales: byPlant.get(p.id) ?? 0,
    }));
  }, [salesMetrics, plants]);

  // ── Sales by Area ───────────────────────────────────────────
  const salesByArea = useMemo(() => {
    const byArea = new Map<string, number>();
    salesMetrics.forEach((m) => {
      const key = m.area || 'Unknown';
      byArea.set(key, (byArea.get(key) ?? 0) + m.srpSales);
    });
    return Array.from(byArea.entries())
      .map(([area, sales]) => ({ area, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [salesMetrics]);

  // ── Sales by Province (Pie) ─────────────────────────────────
  const salesByProvince = useMemo(() => {
    const byProv = new Map<string, number>();
    salesMetrics.forEach((m) => {
      const key = m.province || 'Unknown';
      byProv.set(key, (byProv.get(key) ?? 0) + m.srpSales);
    });
    const total = Array.from(byProv.values()).reduce((s, v) => s + v, 0);
    return Array.from(byProv.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);
  }, [salesMetrics]);

  // ── Distributor Ranking ─────────────────────────────────────
  const distributorRanking = useMemo(() => {
    const distMap = new Map<string, { drSales: number; srpSales: number; storeCount: number }>();
    distributors.forEach((d) => {
      distMap.set(d.id, { drSales: 0, srpSales: 0, storeCount: 0 });
    });
    // Count stores per distributor
    stores.forEach((s) => {
      if (s.distributorId && distMap.has(s.distributorId)) {
        distMap.get(s.distributorId)!.storeCount++;
      }
    });
    // Aggregate sales
    salesMetrics.forEach((m) => {
      if (m.distributorId && distMap.has(m.distributorId)) {
        const entry = distMap.get(m.distributorId)!;
        entry.drSales += m.drSales;
        entry.srpSales += m.srpSales;
      }
    });
    return distributors
      .map((d) => {
        const data = distMap.get(d.id)!;
        return {
          id: d.id,
          name: d.name,
          srpSales: data.srpSales,
          drSales: data.drSales,
          storeCount: data.storeCount,
          avgPerStore: data.storeCount > 0 ? data.srpSales / data.storeCount : 0,
        };
      })
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [distributors, stores, salesMetrics]);

  // ── Recent Applications ─────────────────────────────────────
  const recentApps = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 5),
    [applications],
  );

  // ── Payment Compliance ──────────────────────────────────────
  const paymentCompliance = useMemo(() => {
    const total = billingRecords.length;
    const onTime = billingRecords.filter((b) => b.status === 'paid').length;
    const overdue = billingRecords.filter((b) => b.status === 'overdue').length;
    return {
      total,
      onTime,
      overdue,
      pctOnTime: total > 0 ? ((onTime / total) * 100).toFixed(1) : '0',
      pctOverdue: total > 0 ? ((overdue / total) * 100).toFixed(1) : '0',
    };
  }, [billingRecords]);

  // ── Packaging Revenue ───────────────────────────────────────
  const packagingRevenue = useMemo(
    () => packagingOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [packagingOrders],
  );

  // ── Distributor Table Columns ───────────────────────────────
  const distColumns: TableColumn<(typeof distributorRanking)[0]>[] = [
    {
      key: 'rank',
      header: '#',
      render: (_row, idx) => <span className="font-semibold text-gray-500">{idx + 1}</span>,
    },
    { key: 'name', header: 'Distributor', render: (row) => <span className="font-medium">{row.name}</span> },
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
      key: 'storeCount',
      header: 'Stores',
      render: (row) => <span>{row.storeCount}</span>,
    },
    {
      key: 'avgPerStore',
      header: 'Avg / Store',
      render: (row) => <span>P{Math.round(row.avgPerStore).toLocaleString()}</span>,
    },
  ];

  const fmt = (n: number) => `P${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <Skeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Complete overview of ZAPP Donuts operations</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<DollarSign size={20} />}
          label="Total DR Sales"
          value={fmt(kpis.totalDR)}
          change={8.3}
        />
        <Stat
          icon={<TrendingUp size={20} />}
          label="Total SRP Sales"
          value={fmt(kpis.totalSRP)}
          change={12.1}
        />
        <Stat
          icon={<BarChart3 size={20} />}
          label="Avg Sales / Store"
          value={fmt(Math.round(kpis.avgPerStore))}
          change={5.4}
        />
        <Stat
          icon={<StoreIcon size={20} />}
          label="Total Active Stores"
          value={kpis.activeStores}
          change={3.0}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">SRP Sales Trend (Last 30 Days)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#FF6B00"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Plant */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales by Plant</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesByPlant}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Bar dataKey="sales" fill="#FF6B00" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Area (Horizontal Bar) */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales by Area (Top 10)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={salesByArea} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="area" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Bar dataKey="sales" fill="#2563EB" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Province (Pie) */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Province Contribution</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={salesByProvince}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  dataKey="value"
                  nameKey="name"
                  // recharts' PieLabelRenderProps doesn't surface our data
                  // fields (name, pct); `any` is the cleanest escape hatch.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => `${entry.name} (${entry.pct}%)`}
                  labelLine
                >
                  {salesByProvince.map((_entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distributor Ranking Table */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">Distributor Ranking by SRP Sales</h3>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={distColumns}
            data={distributorRanking}
            keyExtractor={(row) => row.id}
            emptyMessage="No distributor data available."
          />
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Applications */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Applications</h3>
              <Link to="/applications" className="text-sm text-zapp-orange hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentApps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No applications yet.</p>
            ) : (
              recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{app.storeName}</p>
                    <p className="text-xs text-gray-500">{app.fullName}</p>
                  </div>
                  <StatusBadge category="application" status={app.status} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Payment Compliance */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Payment Compliance</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <span className="text-sm text-gray-700">On-Time Payments</span>
              </div>
              <span className="text-lg font-bold text-green-600">{paymentCompliance.pctOnTime}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ width: `${paymentCompliance.pctOnTime}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-red-500" />
                <span className="text-sm text-gray-700">Overdue</span>
              </div>
              <span className="text-lg font-bold text-red-600">{paymentCompliance.overdue}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Invoices</p>
                <p className="text-lg font-bold text-gray-900">{paymentCompliance.total}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Paid</p>
                <p className="text-lg font-bold text-green-600">{paymentCompliance.onTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Packaging Revenue */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Packaging Revenue</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6">
              <Package size={40} className="text-zapp-orange mb-3" />
              <p className="text-3xl font-bold text-gray-900">{fmt(packagingRevenue)}</p>
              <p className="text-sm text-gray-500 mt-1">Total from {packagingOrders.length} orders</p>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pending</span>
                <span className="font-medium">
                  {packagingOrders.filter((o) => o.status === 'pending').length} orders
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">In Delivery</span>
                <span className="font-medium">
                  {packagingOrders.filter((o) => o.status === 'included_in_delivery').length} orders
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Billed</span>
                <span className="font-medium">
                  {packagingOrders.filter((o) => o.status === 'billed').length} orders
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
