// ============================================================
// ZAPP Donuts ERP - Distributor Leaderboard
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Trophy,
  Users,
  DollarSign,
  Filter,
  TrendingUp,
  Store as StoreIcon,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const COLORS = ['#FF6B00', '#22C55E', '#3B82F6', '#EF4444', '#FFD700', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

const fmtCurrency = (n: number) =>
  `P${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

// ── Types ────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  distributorId: string;
  distributorName: string;
  srpSales: number;
  drSales: number;
  avgPerStore: number;
  storeCount: number;
  plantName: string;
  plantId: string;
}

// ── Main Component ──────────────────────────────────────────

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [plantFilter, setPlantFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const salesMetrics = useStore((s) => s.salesMetrics);
  const plants = useStore((s) => s.plants);
  const distributors = useStore((s) => s.distributors);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── Filter options ────────────────────────────────────────────

  const plantOptions = useMemo(
    () => [
      { value: '', label: 'All Plants' },
      ...plants.map((p) => ({ value: p.id, label: p.name })),
    ],
    [plants],
  );

  const areaOptions = useMemo(() => {
    const areas = [...new Set(salesMetrics.map((m) => m.area))].sort();
    return [{ value: '', label: 'All Areas' }, ...areas.map((a) => ({ value: a, label: a }))];
  }, [salesMetrics]);

  const provinceOptions = useMemo(() => {
    const provinces = [...new Set(salesMetrics.map((m) => m.province))].sort();
    return [{ value: '', label: 'All Provinces' }, ...provinces.map((p) => ({ value: p, label: p }))];
  }, [salesMetrics]);

  // ── Filtered metrics ──────────────────────────────────────────

  const filteredMetrics = useMemo(() => {
    let metrics = salesMetrics.filter((m) => m.distributorId);
    if (plantFilter) metrics = metrics.filter((m) => m.plantId === plantFilter);
    if (areaFilter) metrics = metrics.filter((m) => m.area === areaFilter);
    if (provinceFilter) metrics = metrics.filter((m) => m.province === provinceFilter);
    if (dateFrom) metrics = metrics.filter((m) => m.date >= dateFrom);
    if (dateTo) metrics = metrics.filter((m) => m.date <= dateTo);
    return metrics;
  }, [salesMetrics, plantFilter, areaFilter, provinceFilter, dateFrom, dateTo]);

  // ── Leaderboard data ──────────────────────────────────────────

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const byDist = new Map<string, { drSales: number; srpSales: number; storeIds: Set<string> }>();

    filteredMetrics.forEach((m) => {
      if (!m.distributorId) return;
      const existing = byDist.get(m.distributorId) ?? { drSales: 0, srpSales: 0, storeIds: new Set() };
      existing.drSales += m.drSales;
      existing.srpSales += m.srpSales;
      existing.storeIds.add(m.storeId);
      byDist.set(m.distributorId, existing);
    });

    return distributors
      .filter((d) => byDist.has(d.id))
      .map((d) => {
        const data = byDist.get(d.id)!;
        const plant = plants.find((p) => p.id === d.plantId);
        const storeCount = data.storeIds.size;
        return {
          rank: 0,
          distributorId: d.id,
          distributorName: d.name,
          srpSales: data.srpSales,
          drSales: data.drSales,
          avgPerStore: storeCount > 0 ? Math.round(data.srpSales / storeCount) : 0,
          storeCount,
          plantName: plant?.name ?? 'Unknown',
          plantId: d.plantId,
        };
      })
      .sort((a, b) => b.srpSales - a.srpSales)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [filteredMetrics, distributors, plants]);

  // ── Top 10 chart data ─────────────────────────────────────────

  const top10ChartData = useMemo(
    () =>
      leaderboard.slice(0, 10).map((entry) => ({
        name: entry.distributorName.length > 18
          ? entry.distributorName.slice(0, 18) + '...'
          : entry.distributorName,
        srpSales: entry.srpSales,
      })),
    [leaderboard],
  );

  // ── Summary KPIs ──────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalSRP = leaderboard.reduce((s, e) => s + e.srpSales, 0);
    const totalDR = leaderboard.reduce((s, e) => s + e.drSales, 0);
    const totalStores = leaderboard.reduce((s, e) => s + e.storeCount, 0);
    return {
      totalSRP,
      totalDR,
      distributorCount: leaderboard.length,
      totalStores,
      avgPerDistributor: leaderboard.length > 0 ? Math.round(totalSRP / leaderboard.length) : 0,
    };
  }, [leaderboard]);

  // ── Medal display ─────────────────────────────────────────────

  const getMedal = (rank: number) => {
    switch (rank) {
      case 1: return '\u{1F947}';
      case 2: return '\u{1F948}';
      case 3: return '\u{1F949}';
      default: return null;
    }
  };

  // ── Table columns ─────────────────────────────────────────────

  const columns: TableColumn<LeaderboardEntry>[] = [
    {
      key: 'rank',
      header: 'Rank',
      render: (row) => (
        <div className="flex items-center gap-2">
          {getMedal(row.rank) ? (
            <span className="text-xl">{getMedal(row.rank)}</span>
          ) : (
            <span className="font-bold text-gray-500 w-7 text-center">#{row.rank}</span>
          )}
        </div>
      ),
    },
    {
      key: 'distributorName',
      header: 'Distributor Name',
      render: (row) => (
        <span className={`font-medium ${row.rank <= 3 ? 'text-gray-900' : 'text-gray-700'}`}>
          {row.distributorName}
        </span>
      ),
    },
    {
      key: 'srpSales',
      header: 'Total SRP Sales',
      sortable: true,
      render: (row) => <span className="font-bold text-[#FF6B00]">{fmtCurrency(row.srpSales)}</span>,
    },
    {
      key: 'drSales',
      header: 'Total DR Sales',
      render: (row) => fmtCurrency(row.drSales),
    },
    {
      key: 'avgPerStore',
      header: 'Avg Sales / Store',
      render: (row) => fmtCurrency(row.avgPerStore),
    },
    {
      key: 'storeCount',
      header: 'Store Count',
      render: (row) => <Badge variant="neutral">{row.storeCount}</Badge>,
    },
    {
      key: 'plantName',
      header: 'Plant',
      render: (row) => <Badge variant="info">{row.plantName}</Badge>,
    },
  ];

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
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
          <div className="flex items-center gap-3">
            <Trophy size={28} className="text-[#FFD700]" />
            <h1 className="text-2xl font-bold text-gray-900">Distributor Leaderboard</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by <span className="font-semibold text-[#FF6B00]">Total SRP Sales</span> -- top performers across all regions
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
            className="w-44"
          />
          <Select
            label="Area"
            options={areaOptions}
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-44"
          />
          <Select
            label="Province"
            options={provinceOptions}
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="w-44"
          />
          <Input
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <Input
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </CardContent>
      </Card>

      {/* Top 3 Podium Cards */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* 2nd Place */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 md:order-1">
            <div className="text-center">
              <span className="text-4xl">{'\u{1F948}'}</span>
              <div className="mt-3">
                <h3 className="font-bold text-gray-900">{leaderboard[1].distributorName}</h3>
                <p className="text-xs text-gray-500 mt-1">{leaderboard[1].plantName}</p>
              </div>
              <div className="mt-4 bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">Total SRP Sales</p>
                <p className="text-xl font-bold text-gray-700">{fmtCurrency(leaderboard[1].srpSales)}</p>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
                <span>{leaderboard[1].storeCount} stores</span>
                <span>{fmtCurrency(leaderboard[1].avgPerStore)}/store</span>
              </div>
            </div>
          </div>

          {/* 1st Place */}
          <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border-2 border-[#FFD700] rounded-xl p-6 md:order-2 md:-mt-4 shadow-lg">
            <div className="text-center">
              <span className="text-5xl">{'\u{1F947}'}</span>
              <div className="mt-3">
                <h3 className="font-bold text-gray-900 text-lg">{leaderboard[0].distributorName}</h3>
                <p className="text-xs text-gray-500 mt-1">{leaderboard[0].plantName}</p>
              </div>
              <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500">Total SRP Sales</p>
                <p className="text-2xl font-bold text-[#FF6B00]">{fmtCurrency(leaderboard[0].srpSales)}</p>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
                <span>{leaderboard[0].storeCount} stores</span>
                <span>{fmtCurrency(leaderboard[0].avgPerStore)}/store</span>
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 md:order-3">
            <div className="text-center">
              <span className="text-4xl">{'\u{1F949}'}</span>
              <div className="mt-3">
                <h3 className="font-bold text-gray-900">{leaderboard[2].distributorName}</h3>
                <p className="text-xs text-gray-500 mt-1">{leaderboard[2].plantName}</p>
              </div>
              <div className="mt-4 bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">Total SRP Sales</p>
                <p className="text-xl font-bold text-amber-700">{fmtCurrency(leaderboard[2].srpSales)}</p>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
                <span>{leaderboard[2].storeCount} stores</span>
                <span>{fmtCurrency(leaderboard[2].avgPerStore)}/store</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<DollarSign size={20} />}
          label="Total SRP Sales"
          value={fmtCurrency(kpis.totalSRP)}
        />
        <Stat
          icon={<TrendingUp size={20} />}
          label="Total DR Sales"
          value={fmtCurrency(kpis.totalDR)}
        />
        <Stat
          icon={<Users size={20} />}
          label="Distributors"
          value={kpis.distributorCount}
        />
        <Stat
          icon={<StoreIcon size={20} />}
          label="Total Stores"
          value={kpis.totalStores}
        />
      </div>

      {/* Top 10 Bar Chart */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Top 10 Distributors by SRP Sales</h3>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-[#FF6B00]">Ranked by Total SRP Sales</span>
          </p>
        </CardHeader>
        <CardContent>
          {top10ChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={top10ChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `P${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={160}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: unknown) => [fmtCurrency(Number(value)), 'SRP Sales']}
                />
                <Bar dataKey="srpSales" radius={[0, 6, 6, 0]} name="SRP Sales">
                  {top10ChartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : COLORS[idx % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No data" description="No distributor data available." />
          )}
        </CardContent>
      </Card>

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Full Leaderboard</h3>
              <p className="text-xs text-gray-500">All distributors ranked by performance</p>
            </div>
            <Badge variant="orange" dot>
              Ranked by Total SRP Sales
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <Table
              columns={columns}
              data={leaderboard}
              keyExtractor={(row) => row.distributorId}
            />
          ) : (
            <EmptyState
              title="No distributor data"
              description="No distributors found for the selected filters."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
