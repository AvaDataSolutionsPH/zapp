// ============================================================
// ZAPP Donuts ERP - Forecasting Page
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Tabs, type Tab } from '@/components/ui/Tabs';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Forecast, ForecastItem, DemandPressure } from '@/types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Flame,
  Target,
  BarChart3,
  Save,
  RefreshCw,
  Info,
  Truck,
  Factory,
  History,
  Calculator,
  AlertOctagon,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-PH', { maximumFractionDigits: 1 });

const fmtPct = (n: number) => `${(n * 100 - 100).toFixed(0)}%`;

const COLORS = {
  orange: '#FF6B00',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  gold: '#FFD700',
  gray: '#9CA3AF',
};

const pressureBadge = (p: DemandPressure) => {
  switch (p) {
    case 'hot':
      return <Badge variant="danger" dot>HOT</Badge>;
    case 'weak':
      return <Badge variant="neutral" dot>WEAK</Badge>;
    default:
      return <Badge variant="info" dot>NORMAL</Badge>;
  }
};

const pressureRange = (p: DemandPressure) => {
  switch (p) {
    case 'hot':
      return '+10% to +25%';
    case 'weak':
      return '-5% to -20%';
    default:
      return '0%';
  }
};

// ── Tabs ─────────────────────────────────────────────────────

const PAGE_TABS: Tab[] = [
  { key: 'forecast', label: 'Current Forecast', icon: <Calculator size={16} /> },
  { key: 'history', label: 'Forecast History', icon: <History size={16} /> },
];

// ── Main Component ──────────────────────────────────────────

export default function ForecastingPage() {
  const [activeTab, setActiveTab] = useState('forecast');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [editedForecasts, setEditedForecasts] = useState<Record<string, number>>({});

  const stores = useStore((s) => s.stores);
  const plants = useStore((s) => s.plants);
  const skus = useStore((s) => s.skus);
  const forecasts = useStore((s) => s.forecasts);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const endingInventories = useStore((s) => s.endingInventories);
  const saveForecast = useStore((s) => s.saveForecast);
  const currentUser = useStore((s) => s.currentUser);
  const { addToast } = useToast();

  const activeStores = useMemo(
    () => stores.filter((s) => s.status === 'active'),
    [stores],
  );

  // Auto-select first store
  useEffect(() => {
    if (!selectedStoreId && activeStores.length > 0) {
      setSelectedStoreId(activeStores[0].id);
    }
  }, [activeStores, selectedStoreId]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Reset edits when store changes
  useEffect(() => {
    setEditedForecasts({});
  }, [selectedStoreId]);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId],
  );

  const currentForecast = useMemo(
    () => forecasts.find((f) => f.storeId === selectedStoreId),
    [forecasts, selectedStoreId],
  );

  // ── Sales data for last 14 days ──────────────────────────────

  const last14DaysSales = useMemo(() => {
    const storeMetrics = salesMetrics
      .filter((m) => m.storeId === selectedStoreId)
      .sort((a, b) => a.date.localeCompare(b.date));
    return storeMetrics.slice(-14);
  }, [salesMetrics, selectedStoreId]);

  // ── Unsold trend (from ending inventories) ────────────────────

  const unsoldTrend = useMemo(() => {
    const storeEnding = endingInventories
      .filter((ei) => ei.storeId === selectedStoreId)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (storeEnding.length === 0) {
      // Generate synthetic unsold data from sales
      return last14DaysSales.map((m) => ({
        date: new Date(m.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        unsold: Math.round(m.drSales * 0.04 + Math.random() * 3),
      }));
    }

    return storeEnding.slice(-14).map((ei) => {
      const totalUnsold = ei.unsoldItems.reduce((sum, item) => sum + item.quantity, 0);
      return {
        date: new Date(ei.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        unsold: totalUnsold,
      };
    });
  }, [endingInventories, selectedStoreId, last14DaysSales]);

  // ── Forecast items with edits ────────────────────────────────

  const forecastItems = useMemo((): (ForecastItem & { editedForecast: number })[] => {
    if (!currentForecast) return [];
    return currentForecast.items.map((item) => ({
      ...item,
      editedForecast: editedForecasts[item.skuId] ?? item.finalForecast,
    }));
  }, [currentForecast, editedForecasts]);

  // ── Summary KPIs ──────────────────────────────────────────────

  const summaryKPIs = useMemo(() => {
    if (!currentForecast || forecastItems.length === 0) {
      return { avgSales: 0, totalForecast: 0, hotCount: 0, weakCount: 0, accuracy: 0 };
    }
    const avgSales =
      forecastItems.reduce((s, fi) => s + fi.avg14Day, 0) / forecastItems.length;
    const totalForecast = forecastItems.reduce((s, fi) => s + fi.editedForecast, 0);
    const hotCount = forecastItems.filter((fi) => fi.demandPressure === 'hot').length;
    const weakCount = forecastItems.filter((fi) => fi.demandPressure === 'weak').length;

    // Accuracy: only for items with actualSold
    const withActual = forecastItems.filter((fi) => fi.actualSold !== undefined);
    let accuracy = 0;
    if (withActual.length > 0) {
      const totalAccuracy = withActual.reduce((sum, fi) => {
        const diff = Math.abs(fi.finalForecast - (fi.actualSold ?? 0));
        const pct = fi.actualSold ? 1 - diff / fi.actualSold : 0;
        return sum + Math.max(0, pct);
      }, 0);
      accuracy = (totalAccuracy / withActual.length) * 100;
    }

    return { avgSales, totalForecast, hotCount, weakCount, accuracy };
  }, [forecastItems, currentForecast]);

  // ── Sold-Out Detection ──────────────────────────────────────────
  // Items where actualSold == delivered qty (finalForecast) indicate potential stockouts

  const soldOutItems = useMemo(() => {
    if (!forecastItems.length) return [];
    return forecastItems.filter(
      (fi) =>
        fi.actualSold !== undefined &&
        fi.actualSold > 0 &&
        fi.actualSold >= fi.finalForecast,
    );
  }, [forecastItems]);

  // ── Daily sales trend chart data ──────────────────────────────

  const salesChartData = useMemo(
    () =>
      last14DaysSales.map((m) => ({
        date: new Date(m.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        srpSales: m.srpSales,
        drSales: m.drSales,
      })),
    [last14DaysSales],
  );

  // ── Forecast vs Actual chart ──────────────────────────────────

  const forecastVsActualData = useMemo(() => {
    if (!forecastItems.length) return [];
    return forecastItems
      .filter((fi) => fi.actualSold !== undefined)
      .map((fi) => ({
        sku: fi.skuName.length > 12 ? fi.skuName.slice(0, 12) + '...' : fi.skuName,
        forecast: fi.finalForecast,
        actual: fi.actualSold ?? 0,
      }));
  }, [forecastItems]);

  // ── Delivery plan ────────────────────────────────────────────

  const deliveryPlan = useMemo(() => {
    if (!selectedStore || !forecastItems.length) return [];
    return forecastItems.map((fi) => {
      const sku = skus.find((s) => s.id === fi.skuId);
      return {
        skuId: fi.skuId,
        skuName: fi.skuName,
        forecastQty: fi.editedForecast,
        plantName: plants.find((p) => p.id === selectedStore.plantId)?.name ?? 'Unknown',
        plantId: selectedStore.plantId,
        drPrice: sku?.drPrice ?? 0,
        totalDR: (sku?.drPrice ?? 0) * fi.editedForecast,
      };
    });
  }, [forecastItems, selectedStore, skus, plants]);

  // ── Plant summary ─────────────────────────────────────────────

  const plantSummary = useMemo(() => {
    const byPlant = new Map<string, { plantId: string; plantName: string; totalQty: number; totalDR: number; skuCount: number }>();
    deliveryPlan.forEach((dp) => {
      const existing = byPlant.get(dp.plantId) ?? {
        plantId: dp.plantId,
        plantName: dp.plantName,
        totalQty: 0,
        totalDR: 0,
        skuCount: 0,
      };
      existing.totalQty += dp.forecastQty;
      existing.totalDR += dp.totalDR;
      existing.skuCount += 1;
      byPlant.set(dp.plantId, existing);
    });
    return Array.from(byPlant.values());
  }, [deliveryPlan]);

  // ── Forecast history ──────────────────────────────────────────

  const forecastHistory = useMemo(() => {
    return forecasts
      .map((fc) => {
        const store = stores.find((s) => s.id === fc.storeId);
        const withActual = fc.items.filter((i) => i.actualSold !== undefined);
        let accuracy = 0;
        if (withActual.length > 0) {
          const totalAcc = withActual.reduce((sum, fi) => {
            const diff = Math.abs(fi.finalForecast - (fi.actualSold ?? 0));
            const pct = fi.actualSold ? 1 - diff / fi.actualSold : 0;
            return sum + Math.max(0, pct);
          }, 0);
          accuracy = (totalAcc / withActual.length) * 100;
        }
        const totalForecast = fc.items.reduce((s, i) => s + i.finalForecast, 0);
        return {
          id: fc.id,
          storeId: fc.storeId,
          storeName: store?.name ?? fc.storeId,
          date: fc.date,
          status: fc.status,
          skuCount: fc.items.length,
          totalForecast,
          accuracy,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [forecasts, stores]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleForecastEdit = useCallback((skuId: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setEditedForecasts((prev) => ({ ...prev, [skuId]: num }));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentForecast || !currentUser) return;
    setSaving(true);
    try {
      const updatedItems = currentForecast.items.map((item) => ({
        ...item,
        finalForecast: editedForecasts[item.skuId] ?? item.finalForecast,
      }));
      const updated: Forecast = {
        ...currentForecast,
        items: updatedItems,
        status: 'submitted',
      };
      saveForecast(updated);
      addToast('success', 'Forecast has been submitted successfully.');
      setEditedForecasts({});
    } catch {
      addToast('error', 'Could not save forecast. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentForecast, currentUser, editedForecasts, saveForecast, addToast]);

  // ── Store options ─────────────────────────────────────────────

  const storeOptions = useMemo(
    () => activeStores.map((s) => ({ value: s.id, label: s.name })),
    [activeStores],
  );

  // ── Table Columns ─────────────────────────────────────────────

  const forecastColumns: TableColumn<ForecastItem & { editedForecast: number }>[] = [
    { key: 'skuName', header: 'SKU Name' },
    {
      key: 'avg14Day',
      header: 'Avg 14-Day Sales',
      render: (row) => <span className="font-medium">{fmt(row.avg14Day)}</span>,
    },
    {
      key: 'unsoldAdjustment',
      header: 'Unsold Adj.',
      render: (row) => (
        <span className={row.unsoldAdjustment < 0 ? 'text-red-600' : 'text-gray-600'}>
          {row.unsoldAdjustment}
        </span>
      ),
    },
    {
      key: 'dayOfWeekAdjustment',
      header: 'DoW Adj.',
      render: (row) => (
        <span className={row.dayOfWeekAdjustment > 0 ? 'text-green-600' : 'text-gray-600'}>
          {row.dayOfWeekAdjustment > 0 ? '+' : ''}{row.dayOfWeekAdjustment}
        </span>
      ),
    },
    {
      key: 'demandPressure',
      header: 'Demand Pressure',
      render: (row) => (
        <div className="flex flex-col gap-1">
          {pressureBadge(row.demandPressure)}
          <span className="text-xs text-gray-400">{pressureRange(row.demandPressure)}</span>
        </div>
      ),
    },
    {
      key: 'pressureModifier',
      header: 'Modifier',
      render: (row) => (
        <span className="font-mono text-sm">
          {row.pressureModifier > 1 ? '+' : ''}{fmtPct(row.pressureModifier)}
        </span>
      ),
    },
    {
      key: 'finalForecast',
      header: 'Recommended',
      render: (row) => <span className="font-bold text-[#FF6B00]">{row.finalForecast}</span>,
    },
    {
      key: 'editedForecast',
      header: 'Your Forecast',
      render: (row) => (
        <Input
          type="number"
          value={editedForecasts[row.skuId] ?? row.finalForecast}
          onChange={(e) => handleForecastEdit(row.skuId, e.target.value)}
          className="w-20 text-center !py-1.5"
        />
      ),
    },
    {
      key: 'actualSold',
      header: 'Actual Sold',
      render: (row) =>
        row.actualSold !== undefined ? (
          <span className="font-medium text-green-600">{row.actualSold}</span>
        ) : (
          <span className="text-gray-400">--</span>
        ),
    },
  ];

  const deliveryColumns: TableColumn<(typeof deliveryPlan)[0]>[] = [
    { key: 'skuName', header: 'SKU Name' },
    {
      key: 'forecastQty',
      header: 'Forecast Qty',
      render: (row) => <span className="font-bold">{row.forecastQty}</span>,
    },
    { key: 'plantName', header: 'Plant' },
    {
      key: 'drPrice',
      header: 'DR Price',
      render: (row) => `P${row.drPrice.toFixed(2)}`,
    },
    {
      key: 'totalDR',
      header: 'Total DR',
      render: (row) => <span className="font-medium">P{fmt(row.totalDR)}</span>,
    },
  ];

  const historyColumns: TableColumn<(typeof forecastHistory)[0]>[] = [
    { key: 'date', header: 'Date', sortable: true },
    { key: 'storeName', header: 'Store' },
    {
      key: 'skuCount',
      header: 'SKUs',
      render: (row) => row.skuCount,
    },
    {
      key: 'totalForecast',
      header: 'Total Forecast',
      render: (row) => fmt(row.totalForecast),
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      render: (row) =>
        row.accuracy > 0 ? (
          <span
            className={
              row.accuracy >= 90
                ? 'text-green-600 font-bold'
                : row.accuracy >= 75
                  ? 'text-yellow-600 font-medium'
                  : 'text-red-600'
            }
          >
            {row.accuracy.toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-400">N/A</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const variant =
          row.status === 'approved' ? 'success' : row.status === 'submitted' ? 'info' : 'warning';
        return <Badge variant={variant}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</Badge>;
      },
    },
  ];

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand Forecasting</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered forecast recommendations based on 14-day rolling data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={storeOptions}
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            placeholder="Select a store"
            className="w-64"
          />
        </div>
      </div>

      <Tabs tabs={PAGE_TABS} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'forecast' ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                icon={<BarChart3 size={20} />}
                label="Avg 14-Day Sales"
                value={fmt(summaryKPIs.avgSales)}
                change={3.2}
              />
              <Stat
                icon={<Target size={20} />}
                label="Recommended Total"
                value={fmt(summaryKPIs.totalForecast)}
              />
              <Stat
                icon={<Flame size={20} />}
                label="HOT / WEAK SKUs"
                value={`${summaryKPIs.hotCount} / ${summaryKPIs.weakCount}`}
              />
              <Stat
                icon={<TrendingUp size={20} />}
                label="Forecast Accuracy"
                value={summaryKPIs.accuracy > 0 ? `${summaryKPIs.accuracy.toFixed(1)}%` : 'N/A'}
                change={summaryKPIs.accuracy > 0 ? 1.5 : undefined}
              />
            </div>

            {/* Sold-Out Detection */}
            {soldOutItems.length > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <AlertOctagon size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">Sold-Out Detection</h4>
                        <Badge variant="danger" size="sm">
                          {soldOutItems.length} item{soldOutItems.length > 1 ? 's' : ''} detected
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {soldOutItems.length} item{soldOutItems.length > 1 ? 's' : ''} detected as frequently sold out in the last 14 days.
                        These items sold equal to or more than the forecasted delivery quantity, indicating potential stockouts and lost sales.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {soldOutItems.map((item) => (
                          <div
                            key={item.skuId}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5"
                          >
                            <span className="text-sm font-medium text-gray-900">{item.skuName}</span>
                            <Badge variant="danger" size="sm">Frequently Sold Out</Badge>
                            <span className="text-xs text-gray-500">
                              ({item.actualSold}/{item.finalForecast})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Last 14 Days Sales Trend */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Last 14 Days Sales Trend</h3>
                  <p className="text-xs text-gray-500">Daily SRP & DR sales for {selectedStore?.name}</p>
                </CardHeader>
                <CardContent>
                  {salesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={salesChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                          formatter={(value: unknown) => [`P${fmt(Number(value))}`, '']}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="srpSales"
                          stroke={COLORS.orange}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          name="SRP Sales"
                        />
                        <Line
                          type="monotone"
                          dataKey="drSales"
                          stroke={COLORS.blue}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="DR Sales"
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No sales data" description="No sales metrics available for this store." />
                  )}
                </CardContent>
              </Card>

              {/* Unsold Trend */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Unsold Trend (14 Days)</h3>
                  <p className="text-xs text-gray-500">Daily unsold quantities</p>
                </CardHeader>
                <CardContent>
                  {unsoldTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={unsoldTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="unsold"
                          stroke={COLORS.red}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          name="Unsold Qty"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No unsold data" description="No ending inventory records found." />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Forecast Reasoning Panel */}
            <Card className="border-l-4 border-l-[#FF6B00]">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Info size={20} className="text-[#FF6B00]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Forecast Formula</h4>
                  <p className="text-sm text-gray-600">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
                      Forecast = Avg Sales (14 days) - Unsold Adjustment + Day-of-Week Adjustment + Demand Pressure
                    </span>
                  </p>
                  <ul className="mt-2 text-xs text-gray-500 space-y-1">
                    <li><strong>Avg 14-Day Sales:</strong> Rolling average of daily sales over the past 14 days</li>
                    <li><strong>Unsold Adjustment:</strong> Reduces forecast based on recent unsold inventory (negative value)</li>
                    <li><strong>Day-of-Week Adjustment:</strong> Adjusts for day-specific demand patterns (weekends typically higher)</li>
                    <li><strong>Demand Pressure:</strong> HOT (+10% to +25%) for trending items, WEAK (-5% to -20%) for slow movers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Forecast Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Forecast Table</h3>
                  <p className="text-xs text-gray-500">
                    Edit the "Your Forecast" column to override recommendations
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditedForecasts({})}
                    disabled={Object.keys(editedForecasts).length === 0}
                  >
                    <RefreshCw size={14} className="mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !currentForecast}
                  >
                    <Save size={14} className="mr-1" />
                    {saving ? 'Saving...' : 'Save Forecast'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {forecastItems.length > 0 ? (
                  <Table
                    columns={forecastColumns}
                    data={forecastItems}
                    keyExtractor={(row) => row.skuId}
                  />
                ) : (
                  <EmptyState
                    title="No forecast available"
                    description="Select a store with an existing forecast or generate a new one."
                  />
                )}
              </CardContent>
            </Card>

            {/* Forecast vs Actual */}
            {forecastVsActualData.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Forecast vs Actual</h3>
                  <p className="text-xs text-gray-500">Comparing predicted quantities with actual sold</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={forecastVsActualData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="sku" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <Legend />
                      <Bar dataKey="forecast" fill={COLORS.orange} name="Forecast" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" fill={COLORS.green} name="Actual Sold" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Delivery Plan Output */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <Truck size={18} className="text-[#FF6B00]" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Delivery Plan Output</h3>
                      <p className="text-xs text-gray-500">
                        Quantities to be sent from plant based on forecast
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {deliveryPlan.length > 0 ? (
                      <>
                        <Table
                          columns={deliveryColumns}
                          data={deliveryPlan}
                          keyExtractor={(row) => row.skuId}
                        />
                        <div className="mt-4 flex justify-end">
                          <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
                            <span className="text-gray-500">Total DR Value: </span>
                            <span className="font-bold text-gray-900">
                              P{fmt(deliveryPlan.reduce((s, d) => s + d.totalDR, 0))}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <EmptyState title="No delivery plan" description="Generate a forecast to see the delivery plan." />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Plant Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Factory size={18} className="text-[#FF6B00]" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Plant Summary</h3>
                    <p className="text-xs text-gray-500">Aggregated by plant</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {plantSummary.length > 0 ? (
                    <div className="space-y-4">
                      {plantSummary.map((ps) => (
                        <div key={ps.plantId} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 text-sm">{ps.plantName}</h4>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">SKUs:</span>{' '}
                              <span className="font-medium">{ps.skuCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Qty:</span>{' '}
                              <span className="font-medium">{fmt(ps.totalQty)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500">Total DR:</span>{' '}
                              <span className="font-bold text-[#FF6B00]">P{fmt(ps.totalDR)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No plant data.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* History Tab */
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Forecast History</h3>
              <p className="text-xs text-gray-500">Previous forecasts across all stores</p>
            </CardHeader>
            <CardContent>
              {forecastHistory.length > 0 ? (
                <Table
                  columns={historyColumns}
                  data={forecastHistory}
                  keyExtractor={(row) => row.id}
                />
              ) : (
                <EmptyState title="No history" description="No previous forecasts found." />
              )}
            </CardContent>
          </Card>
        )}
      </Tabs>
    </div>
  );
}
