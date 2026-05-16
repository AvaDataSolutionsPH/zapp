// ============================================================
// ZAPP Donuts ERP - Sub-Partner Distributor Dashboard
//
// Read-only view for the SPD role. Shows assigned stores' sales, the
// SPD's 50% share of PD Profit (effectively 5% of Gross), and a
// per-store breakdown. SPDs cannot take any actions — no review queue,
// no editing.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, type TableColumn } from '@/components/ui/Table';
import {
  Store as StoreIcon,
  TrendingUp,
  Coins,
  PackageCheck,
  Building,
} from 'lucide-react';

interface StoreRow {
  id: string;
  name: string;
  area: string;
  status: string;
  srpSales: number;
  drSales: number;
  yourShare: number;
}

export function SubPartnerDashboard() {
  const [loading, setLoading] = useState(true);

  const currentUser = useStore((s) => s.currentUser);
  const stores = useStore((s) => s.stores);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const billingRecords = useStore((s) => s.billingRecords);
  const subPartnerDistributors = useStore((s) => s.subPartnerDistributors);
  const distributors = useStore((s) => s.distributors);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const spdId = currentUser?.subPartnerDistributorId ?? '';
  const spd = subPartnerDistributors.find((s) => s.id === spdId);
  const parentDist = spd ? distributors.find((d) => d.id === spd.parentDistributorId) : null;

  const myStores = useMemo(
    () => stores.filter((s) => s.subPartnerDistributorId === spdId),
    [stores, spdId],
  );

  const mySales = useMemo(
    () =>
      salesMetrics.filter((m) =>
        myStores.some((s) => s.id === m.storeId),
      ),
    [salesMetrics, myStores],
  );

  const myBilling = useMemo(
    () => billingRecords.filter((b) => b.subPartnerDistributorId === spdId),
    [billingRecords, spdId],
  );

  const kpis = useMemo(() => {
    const storeCount = myStores.filter((s) => s.status === 'active').length;
    const totalSRP = mySales.reduce((sum, m) => sum + m.srpSales, 0);
    const totalDR = mySales.reduce((sum, m) => sum + m.drSales, 0);
    // SPD takes 50% of PD Profit pool which is 10% of Gross — net 5% of Gross.
    const spdShareFromMetrics = totalSRP * 0.05;
    // Also surface the actual computed billing-driven figure (more authoritative
    // once billings flow through). Fall back to the metrics-derived estimate
    // when no computed billings exist yet for this SPD.
    const spdShareComputed = myBilling.reduce((sum, b) => sum + (b.spdProfit ?? 0), 0);
    return {
      storeCount,
      totalSRP,
      totalDR,
      spdShare: spdShareComputed > 0 ? spdShareComputed : spdShareFromMetrics,
      isComputed: spdShareComputed > 0,
    };
  }, [myStores, mySales, myBilling]);

  const storeRows: StoreRow[] = useMemo(() => {
    const sMap = new Map<string, { srpSales: number; drSales: number }>();
    mySales.forEach((m) => {
      const entry = sMap.get(m.storeId) ?? { srpSales: 0, drSales: 0 };
      entry.srpSales += m.srpSales;
      entry.drSales += m.drSales;
      sMap.set(m.storeId, entry);
    });
    return myStores
      .map((s) => {
        const sales = sMap.get(s.id) ?? { srpSales: 0, drSales: 0 };
        return {
          id: s.id,
          name: s.name,
          area: s.area,
          status: s.status,
          srpSales: sales.srpSales,
          drSales: sales.drSales,
          yourShare: sales.srpSales * 0.05,
        };
      })
      .sort((a, b) => b.srpSales - a.srpSales);
  }, [myStores, mySales]);

  const fmt = (n: number) => `P${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const columns: TableColumn<StoreRow>[] = [
    { key: 'name', header: 'Store', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'area', header: 'Area' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="store" status={row.status} size="sm" />,
    },
    {
      key: 'srpSales',
      header: 'SRP Sales',
      render: (row) => <span className="font-semibold text-zapp-orange">{fmt(row.srpSales)}</span>,
    },
    {
      key: 'drSales',
      header: 'DR Sales',
      render: (row) => <span>{fmt(row.drSales)}</span>,
    },
    {
      key: 'yourShare',
      header: 'Your Share (5%)',
      render: (row) => <span className="font-semibold text-teal-700">{fmt(row.yourShare)}</span>,
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
        <Skeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sub-Partner Distributor Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          View-only summary for your assigned stores and your 50% share of PD Profit.
        </p>
      </div>

      {/* Parent PD context */}
      {spd && parentDist && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-center gap-3">
          <Building size={20} className="text-teal-700 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-teal-900">
              {spd.name} · under {parentDist.name}
            </p>
            <p className="text-teal-700 text-xs">
              Your share is 50% of the parent Partner Distributor's profit pool (5% of Gross Sales).
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<StoreIcon size={20} />} label="My Stores" value={kpis.storeCount} />
        <Stat icon={<TrendingUp size={20} />} label="Total SRP Sales" value={fmt(kpis.totalSRP)} />
        <Stat icon={<PackageCheck size={20} />} label="Total DR Sales" value={fmt(kpis.totalDR)} />
        <Stat
          icon={<Coins size={20} />}
          label={kpis.isComputed ? 'My Share (computed)' : 'My Share (estimated)'}
          value={fmt(kpis.spdShare)}
        />
      </div>

      {/* Store performance */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">My Stores</h3>
        </CardHeader>
        <CardContent>
          <Table columns={columns} data={storeRows} keyExtractor={(row) => row.id} />
        </CardContent>
      </Card>
    </div>
  );
}
