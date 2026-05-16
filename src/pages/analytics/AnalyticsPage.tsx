// ============================================================
// ZAPP Donuts ERP - Analytics Dashboard
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Tabs, type Tab } from '@/components/ui/Tabs';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AreaChart,
  Area,
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
import {
  DollarSign,
  TrendingUp,
  Store as StoreIcon,
  BarChart3,
  MapPin,
  Trophy,
  Filter,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const COLORS = ['#FF6B00', '#22C55E', '#3B82F6', '#EF4444', '#FFD700', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

const fmtCurrency = (n: number) =>
  `P${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

// ── Tabs ─────────────────────────────────────────────────────

const ANALYTICS_TABS: Tab[] = [
  { key: 'overview', label: 'Sales Overview', icon: <BarChart3 size={16} /> },
  { key: 'area', label: 'By Area / Province', icon: <MapPin size={16} /> },
  { key: 'rankings', label: 'Store Rankings', icon: <Trophy size={16} /> },
];

// ── Main Component ──────────────────────────────────────────

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [plantFilter, setPlantFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  const salesMetrics = useStore((s) => s.salesMetrics);
  const stores = useStore((s) => s.stores);
  const plants = useStore((s) => s.plants);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── Filtered metrics ──────────────────────────────────────────

  const filteredMetrics = useMemo(() => {
    let metrics = [...salesMetrics];
    if (plantFilter) {
      metrics = metrics.filter((m) => m.plantId === plantFilter);
    }
    if (dateFrom) {
      metrics = metrics.filter((m) => m.date >= dateFrom);
    }
    if (dateTo) {
      metrics = metrics.filter((m) => m.date <= dateTo);
    }
    return metrics;
  }, [salesMetrics, plantFilter, dateFrom, dateTo]);

  // ── Plant options ─────────────────────────────────────────────

  const plantOptions = useMemo(
    () => [
      { value: '', label: 'All Plants' },
      ...plants.map((p) => ({ value: p.id, label: p.name })),
    ],
    [plants],
  );

  // ── Area options ──────────────────────────────────────────────

  const areaOptions = useMemo(() => {
    const areas = [...new Set(salesMetrics.map((m) => m.area))].sort();
    return [{ value: '', label: 'All Areas' }, ...areas.map((a) => ({ value: a, label: a }))];
  }, [salesMetrics]);

  // ── KPIs ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalDR = filteredMetrics.reduce((sum, m) => sum + m.drSales, 0);
    const totalSRP = filteredMetrics.reduce((sum, m) => sum + m.srpSales, 0);
    const storeIds = new Set(filteredMetrics.map((m) => m.storeId));
    const storeCount = storeIds.size;
    const avgPerStore = storeCount > 0 ? totalSRP / storeCount : 0;
    return { totalDR, totalSRP, storeCount, avgPerStore };
  }, [filteredMetrics]);

  // ── Daily sales trend ─────────────────────────────────────────

  const dailySalesTrend = useMemo(() => {
    const byDate = new Map<string, { date: string; srpSales: number; drSales: number }>();
    filteredMetrics.forEach((m) => {
      const existing = byDate.get(m.date) ?? { date: m.date, srpSales: 0, drSales: 0 };
      existing.srpSales += m.srpSales;
      existing.drSales += m.drSales;
      byDate.set(m.date, existing);
    });
    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      }));
  }, [filteredMetrics]);

  // ── DR vs SRP comparison ──────────────────────────────────────

  const drVsSrp = useMemo(() => {
    const byDate = new Map<string, { date: string; dr: number; srp: number }>();
    filteredMetrics.forEach((m) => {
      const existing = byDate.get(m.date) ?? { date: m.date, dr: 0, srp: 0 };
      existing.dr += m.drSales;
      existing.srp += m.srpSales;
      byDate.set(m.date, existing);
    });
    // Sample every 3rd day for readability
    const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.filter((_, i) => i % 3 === 0).map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    }));
  }, [filteredMetrics]);

  // ── Monthly summary ───────────────────────────────────────────

  const monthlySummary = useMemo(() => {
    const byMonth = new Map<string, { period: string; drSales: number; srpSales: number; storeIds: Set<string> }>();
    filteredMetrics.forEach((m) => {
      const existing = byMonth.get(m.period) ?? { period: m.period, drSales: 0, srpSales: 0, storeIds: new Set() };
      existing.drSales += m.drSales;
      existing.srpSales += m.srpSales;
      existing.storeIds.add(m.storeId);
      byMonth.set(m.period, existing);
    });
    return Array.from(byMonth.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((m) => ({
        period: m.period,
        drSales: m.drSales,
        srpSales: m.srpSales,
        storeCount: m.storeIds.size,
        avgPerStore: m.storeIds.size > 0 ? Math.round(m.srpSales / m.storeIds.size) : 0,
      }));
  }, [filteredMetrics]);

  // ── Area sales ────────────────────────────────────────────────

  const areaSales = useMemo(() => {
    const byArea = new Map<string, { area: string; drSales: number; srpSales: number; storeIds: Set<string> }>();
    filteredMetrics.forEach((m) => {
      const existing = byArea.get(m.area) ?? { area: m.area, drSales: 0, srpSales: 0, storeIds: new Set() };
      existing.drSales += m.drSales;
      existing.srpSales += m.srpSales;
      existing.storeIds.add(m.storeId);
      byArea.set(m.area, existing);
    });
    const totalSRP = filteredMetrics.reduce((s, m) => s + m.srpSales, 0);
    return Array.from(byArea.values())
      .map((a) => ({
        area: a.area,
        drSales: a.drSales,
        srpSales: a.srpSales,
        contribution: totalSRP > 0 ? (a.srpSales / totalSRP) * 100 : 0,
        storeCount: a.storeIds.size,
      }))
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [filteredMetrics]);

  // ── Province sales ────────────────────────────────────────────

  const provinceSales = useMemo(() => {
    const byProvince = new Map<string, { province: string; drSales: number; srpSales: number; storeIds: Set<string> }>();
    filteredMetrics.forEach((m) => {
      const existing = byProvince.get(m.province) ?? { province: m.province, drSales: 0, srpSales: 0, storeIds: new Set() };
      existing.drSales += m.drSales;
      existing.srpSales += m.srpSales;
      existing.storeIds.add(m.storeId);
      byProvince.set(m.province, existing);
    });
    const totalSRP = filteredMetrics.reduce((s, m) => s + m.srpSales, 0);
    return Array.from(byProvince.values())
      .map((p) => ({
        province: p.province,
        drSales: p.drSales,
        srpSales: p.srpSales,
        contribution: totalSRP > 0 ? (p.srpSales / totalSRP) * 100 : 0,
        storeCount: p.storeIds.size,
      }))
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [filteredMetrics]);

  // ── Store rankings ────────────────────────────────────────────

  const storeRankings = useMemo(() => {
    const byStore = new Map<string, { storeId: string; drSales: number; srpSales: number; dayCount: number }>();
    const metricsToUse = areaFilter
      ? filteredMetrics.filter((m) => m.area === areaFilter)
      : filteredMetrics;

    metricsToUse.forEach((m) => {
      const existing = byStore.get(m.storeId) ?? { storeId: m.storeId, drSales: 0, srpSales: 0, dayCount: 0 };
      existing.drSales += m.drSales;
      existing.srpSales += m.srpSales;
      existing.dayCount += 1;
      byStore.set(m.storeId, existing);
    });

    return Array.from(byStore.values())
      .map((s, _idx) => {
        const store = stores.find((st) => st.id === s.storeId);
        const plant = plants.find((p) => p.id === store?.plantId);
        return {
          storeId: s.storeId,
          storeName: store?.name ?? s.storeId,
          area: store?.area ?? 'Unknown',
          province: store?.province ?? 'Unknown',
          plantName: plant?.name ?? 'Unknown',
          drSales: s.drSales,
          srpSales: s.srpSales,
          avgDaily: s.dayCount > 0 ? Math.round(s.srpSales / s.dayCount) : 0,
          rank: 0,
        };
      })
      .sort((a, b) => b.srpSales - a.srpSales)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [filteredMetrics, stores, plants, areaFilter]);

  // ── Table columns ─────────────────────────────────────────────

  const monthlyColumns: TableColumn<(typeof monthlySummary)[0]>[] = [
    {
      key: 'period',
      header: 'Period',
      render: (row) => {
        const [y, m] = row.period.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1);
        return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      },
    },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => fmtCurrency(row.drSales),
    },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      render: (row) => <span className="font-bold text-[#FF6B00]">{fmtCurrency(row.srpSales)}</span>,
    },
    {
      key: 'storeCount',
      header: 'Stores',
      render: (row) => row.storeCount,
    },
    {
      key: 'avgPerStore',
      header: 'Avg / Store',
      render: (row) => fmtCurrency(row.avgPerStore),
    },
  ];

  const areaColumns: TableColumn<(typeof areaSales)[0]>[] = [
    { key: 'area', header: 'Area Name' },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => fmtCurrency(row.drSales),
    },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      render: (row) => <span className="font-bold">{fmtCurrency(row.srpSales)}</span>,
    },
    {
      key: 'contribution',
      header: '% Contribution',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF6B00]"
              style={{ width: `${Math.min(row.contribution, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium">{row.contribution.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'storeCount',
      header: 'Stores',
      render: (row) => <Badge variant="neutral">{row.storeCount}</Badge>,
    },
  ];

  const provinceColumns: TableColumn<(typeof provinceSales)[0]>[] = [
    { key: 'province', header: 'Province Name' },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => fmtCurrency(row.drSales),
    },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      render: (row) => <span className="font-bold">{fmtCurrency(row.srpSales)}</span>,
    },
    {
      key: 'contribution',
      header: '% Contribution',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3B82F6]"
              style={{ width: `${Math.min(row.contribution, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium">{row.contribution.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'storeCount',
      header: 'Stores',
      render: (row) => <Badge variant="neutral">{row.storeCount}</Badge>,
    },
  ];

  const rankingColumns: TableColumn<(typeof storeRankings)[0]>[] = [
    {
      key: 'rank',
      header: 'Rank',
      render: (row) => (
        <span className={`font-bold ${row.rank <= 3 ? 'text-[#FF6B00]' : 'text-gray-600'}`}>
          #{row.rank}
        </span>
      ),
    },
    {
      key: 'storeName',
      header: 'Store Name',
      render: (row) => <span className="font-medium">{row.storeName}</span>,
    },
    { key: 'area', header: 'Area' },
    { key: 'province', header: 'Province' },
    { key: 'plantName', header: 'Plant' },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => fmtCurrency(row.drSales),
    },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      sortable: true,
      render: (row) => <span className="font-bold text-[#FF6B00]">{fmtCurrency(row.srpSales)}</span>,
    },
    {
      key: 'avgDaily',
      header: 'Avg Daily Sales',
      render: (row) => fmtCurrency(row.avgDaily),
    },
  ];

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive sales performance analysis across all stores
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter size={16} />
            <span className="font-medium">Filters:</span>
          </div>
          <Select
            label="Plant"
            options={plantOptions}
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="w-48"
          />
          <Input
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-44"
          />
          <Input
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-44"
          />
        </CardContent>
      </Card>

      <Tabs tabs={ANALYTICS_TABS} activeTab={activeTab} onChange={setActiveTab}>
        {/* ── Sales Overview Tab ───────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                icon={<DollarSign size={20} />}
                label="Total DR Sales"
                value={fmtCurrency(kpis.totalDR)}
                change={4.8}
              />
              <Stat
                icon={<TrendingUp size={20} />}
                label="Total SRP Sales"
                value={fmtCurrency(kpis.totalSRP)}
                change={6.2}
              />
              <Stat
                icon={<BarChart3 size={20} />}
                label="Avg Sales / Store"
                value={fmtCurrency(kpis.avgPerStore)}
                change={2.1}
              />
              <Stat
                icon={<StoreIcon size={20} />}
                label="Total Stores"
                value={kpis.storeCount}
              />
            </div>

            {/* Daily Sales Trend */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Daily Sales Trend</h3>
                <p className="text-xs text-gray-500">Aggregated SRP sales over time</p>
              </CardHeader>
              <CardContent>
                {dailySalesTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={dailySalesTrend}>
                      <defs>
                        <linearGradient id="srpGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#FF6B00" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `P${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: unknown) => [fmtCurrency(Number(value)), '']}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="srpSales"
                        stroke="#FF6B00"
                        fill="url(#srpGradient)"
                        strokeWidth={2.5}
                        name="SRP Sales"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No data" description="No sales data for selected filters." />
                )}
              </CardContent>
            </Card>

            {/* DR vs SRP Comparison */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">DR vs SRP Comparison</h3>
                <p className="text-xs text-gray-500">Side-by-side comparison of DR and SRP sales</p>
              </CardHeader>
              <CardContent>
                {drVsSrp.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={drVsSrp} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `P${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: unknown) => [fmtCurrency(Number(value)), '']}
                      />
                      <Legend />
                      <Bar dataKey="dr" fill="#3B82F6" name="DR Sales" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="srp" fill="#FF6B00" name="SRP Sales" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No data" description="No sales data for selected filters." />
                )}
              </CardContent>
            </Card>

            {/* Monthly Summary Table */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Monthly Summary</h3>
                <p className="text-xs text-gray-500">Sales breakdown by month</p>
              </CardHeader>
              <CardContent>
                {monthlySummary.length > 0 ? (
                  <Table
                    columns={monthlyColumns}
                    data={monthlySummary}
                    keyExtractor={(row) => row.period}
                  />
                ) : (
                  <EmptyState title="No data" description="No monthly data available." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── By Area / Province Tab ──────────────────────────── */}
        {activeTab === 'area' && (
          <div className="space-y-6">
            {/* Area Sales Table */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Sales by Area</h3>
                <p className="text-xs text-gray-500">Performance breakdown by area</p>
              </CardHeader>
              <CardContent>
                {areaSales.length > 0 ? (
                  <Table
                    columns={areaColumns}
                    data={areaSales}
                    keyExtractor={(row) => row.area}
                  />
                ) : (
                  <EmptyState title="No data" description="No area data available." />
                )}
              </CardContent>
            </Card>

            {/* Area Bar Chart */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Sales by Area Chart</h3>
              </CardHeader>
              <CardContent>
                {areaSales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={areaSales} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `P${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="area" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: unknown) => [fmtCurrency(Number(value)), '']}
                      />
                      <Legend />
                      <Bar dataKey="drSales" fill="#3B82F6" name="DR Sales" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="srpSales" fill="#FF6B00" name="SRP Sales" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No data" description="No area chart data available." />
                )}
              </CardContent>
            </Card>

            {/* Province Sales Table */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Sales by Province</h3>
                <p className="text-xs text-gray-500">Aggregated by province</p>
              </CardHeader>
              <CardContent>
                {provinceSales.length > 0 ? (
                  <Table
                    columns={provinceColumns}
                    data={provinceSales}
                    keyExtractor={(row) => row.province}
                  />
                ) : (
                  <EmptyState title="No data" description="No province data available." />
                )}
              </CardContent>
            </Card>

            {/* Province Pie Chart */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Province Breakdown</h3>
                <p className="text-xs text-gray-500">SRP sales distribution by province</p>
              </CardHeader>
              <CardContent>
                {provinceSales.length > 0 ? (
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={provinceSales}
                          dataKey="srpSales"
                          nameKey="province"
                          cx="50%"
                          cy="50%"
                          outerRadius={130}
                          innerRadius={60}
                          strokeWidth={2}
                          // recharts' PieLabelRenderProps doesn't surface our
                          // data fields (province, contribution); `any` is
                          // the cleanest escape hatch for this callback shape.
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          label={(entry: any) => `${entry.province} (${entry.contribution.toFixed(1)}%)`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {provinceSales.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                          formatter={(value: unknown) => [fmtCurrency(Number(value)), 'SRP Sales']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      {provinceSales.map((p, idx) => (
                        <div key={p.province} className="flex items-center gap-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-gray-600">{p.province}</span>
                          <span className="ml-auto font-medium">{fmtCurrency(p.srpSales)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No data" description="No province data available." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Store Rankings Tab ──────────────────────────────── */}
        {activeTab === 'rankings' && (
          <div className="space-y-6">
            {/* Rankings filters */}
            <div className="flex flex-wrap items-end gap-4">
              <Select
                label="Filter by Area"
                options={areaOptions}
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="w-48"
              />
            </div>

            {/* Top 3 highlight */}
            {storeRankings.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {storeRankings.slice(0, 3).map((store, idx) => {
                  const medals = ['text-[#FFD700]', 'text-gray-400', 'text-amber-600'];
                  const bgColors = ['bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200', 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200', 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'];
                  return (
                    <div key={store.storeId} className={`rounded-xl border p-5 ${bgColors[idx]}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-3xl font-bold ${medals[idx]}`}>#{idx + 1}</span>
                        <Trophy size={24} className={medals[idx]} />
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{store.storeName}</h4>
                      <p className="text-xs text-gray-500 mt-1">{store.area}, {store.province}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">SRP Sales</span>
                          <p className="font-bold text-[#FF6B00]">{fmtCurrency(store.srpSales)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Daily</span>
                          <p className="font-bold text-gray-900">{fmtCurrency(store.avgDaily)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Rankings Table */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Store Rankings</h3>
                <p className="text-xs text-gray-500">Sorted by SRP Sales (default)</p>
              </CardHeader>
              <CardContent>
                {storeRankings.length > 0 ? (
                  <Table
                    columns={rankingColumns}
                    data={storeRankings}
                    keyExtractor={(row) => row.storeId}
                  />
                ) : (
                  <EmptyState title="No data" description="No store rankings available for the selected filters." />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}
