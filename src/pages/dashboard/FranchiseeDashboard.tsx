// ============================================================
// ZAPP Donuts ERP - Franchisee Dashboard
// (franchisee_distributor & franchisee_direct)
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  DollarSign,
  Calendar,
  PackageX,
  CreditCard,
  ShieldCheck,
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

// Turn a billing period key like "2026-03 (8-14)" into a human-readable
// range like "Mar 8–14, 2026". A BillingRecord is per-cutoff and aggregates
// multiple deliveries, so there is no single DR number to show here — the
// franchisee needs the date range + amount, not a delivery reference.
// Falls back to the raw period string if the format is unexpected.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatBillingPeriod(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})\s*\((\d+)-(\d+)\)$/);
  if (!m) return period;
  const [, year, month, startDay, endDay] = m;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${monthName} ${startDay}–${endDay}, ${year}`;
}

export function FranchiseeDashboard() {
  const [loading, setLoading] = useState(true);

  const currentUser = useStore((s) => s.currentUser);
  const stores = useStore((s) => s.stores);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const deliveries = useStore((s) => s.deliveries);
  const billingRecords = useStore((s) => s.billingRecords);
  const endingInventories = useStore((s) => s.endingInventories);
  const payments = useStore((s) => s.payments);
  const paySecurityDeposit = useStore((s) => s.paySecurityDeposit);
  const { addToast } = useToast();
  const [depositBusy, setDepositBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── My store IDs ────────────────────────────────────────────
  const myStoreIds = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'franchisee_distributor') {
      return stores.filter((s) => s.distributorId === currentUser.distributorId).map((s) => s.id);
    }
    return currentUser.assignedStoreIds ?? [];
  }, [currentUser, stores]);

  const mySales = useMemo(
    () => salesMetrics.filter((m) => myStoreIds.includes(m.storeId)),
    [salesMetrics, myStoreIds],
  );
  const myDeliveries = useMemo(
    () => deliveries.filter((d) => myStoreIds.includes(d.storeId)),
    [deliveries, myStoreIds],
  );
  const myBilling = useMemo(
    () => billingRecords.filter((b) => myStoreIds.includes(b.storeId)),
    [billingRecords, myStoreIds],
  );
  const myEnding = useMemo(
    () => endingInventories.filter((ei) => myStoreIds.includes(ei.storeId)),
    [endingInventories, myStoreIds],
  );

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = mySales
      .filter((m) => m.date === todayStr)
      .reduce((sum, m) => sum + m.srpSales, 0);

    // This week (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().slice(0, 10);
    const weekSales = mySales
      .filter((m) => m.date >= weekStr)
      .reduce((sum, m) => sum + m.srpSales, 0);

    // Unsold today
    const unsoldToday = myEnding
      .filter((ei) => ei.date.slice(0, 10) === todayStr)
      .reduce((sum, ei) => sum + ei.unsoldItems.reduce((s, i) => s + i.quantity, 0), 0);

    // Payment status from billing
    const latestBilling = myBilling.length > 0
      ? myBilling.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
      : null;
    const paymentStatus = latestBilling?.status ?? 'none';

    return { todaySales, weekSales, unsoldToday, paymentStatus };
  }, [mySales, myEnding, myBilling]);

  // ── Sales Trend (14 days) ───────────────────────────────────
  const salesTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    mySales.forEach((m) => {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.srpSales);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, sales]) => ({
        date: new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales,
      }));
  }, [mySales]);

  // ── Recent Deliveries ───────────────────────────────────────
  const recentDeliveries = useMemo(
    () =>
      [...myDeliveries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [myDeliveries],
  );

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);

  // ── Financial Summary ───────────────────────────────────────
  const financialSummary = useMemo(() => {
    const totalDR = myBilling.reduce((sum, b) => sum + b.drTotal, 0);
    const totalUnsoldDeduction = myBilling.reduce((sum, b) => sum + b.unsoldDeduction, 0);
    const totalPackaging = myBilling.reduce((sum, b) => sum + b.packagingTotal, 0);
    const totalPayable = myBilling.reduce((sum, b) => sum + b.totalPayable, 0);
    const totalSRP = mySales.reduce((sum, m) => sum + m.srpSales, 0);
    const billingSRP = myBilling.reduce((sum, b) => sum + b.srpTotal, 0);
    const franchiseeProfit = myBilling.reduce((sum, b) => sum + b.franchiseeProfit, 0);
    const remitToPD = myBilling.reduce((sum, b) => sum + b.remitToPD, 0);

    return { totalDR, totalUnsoldDeduction, totalPackaging, totalPayable, totalSRP, billingSRP, franchiseeProfit, remitToPD };
  }, [myBilling, mySales]);

  const isDistributor = currentUser?.role === 'franchisee_distributor';

  // ── Security deposit gate (Partner Onboarding Phase 5) ──────────
  // A newly-activated onboarding partner has a 'pending' store until the
  // ₱2,000 security deposit is paid. Show the gate when the store is pending
  // and no verified security_deposit payment exists for it yet.
  const depositStore = useMemo(
    () => stores.find((s) => myStoreIds.includes(s.id) && s.status === 'pending'),
    [stores, myStoreIds],
  );
  const depositPaid = useMemo(
    () =>
      depositStore
        ? payments.some(
            (p) => p.storeId === depositStore.id && p.type === 'security_deposit' && p.status === 'verified',
          )
        : true,
    [payments, depositStore],
  );
  const needsDeposit = !!depositStore && !depositPaid;

  const handlePayDeposit = async () => {
    if (!depositStore) return;
    setDepositBusy(true);
    try {
      // Simulate the gateway round-trip.
      await new Promise((r) => setTimeout(r, 1500));
      await paySecurityDeposit(depositStore.id);
      addToast('success', 'Security deposit paid. Your partner account is now Active!');
    } catch {
      addToast('error', 'Deposit payment failed. Please try again.');
    } finally {
      setDepositBusy(false);
    }
  };

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
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Franchisee Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isDistributor ? 'Distributor-model franchise overview' : 'Direct franchise overview'}
        </p>
      </div>

      {/* Security Deposit gate (Phase 5) */}
      {needsDeposit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <ShieldCheck size={22} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-900">Security Deposit Required</h2>
              <p className="mt-0.5 text-sm text-amber-700">
                Bayaran ang refundable na <span className="font-semibold">₱2,000 Security Deposit</span>{' '}
                para ma-activate ang iyong ZAPP Donuts partner account at makapag-simula ng deliveries.
              </p>
            </div>
          </div>
          <Button variant="primary" loading={depositBusy} onClick={handlePayDeposit} iconLeft={<CreditCard size={16} />}>
            Pay ₱2,000 (Gateway)
          </Button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<DollarSign size={20} />} label="Today's Sales" value={fmt(kpis.todaySales)} />
        <Stat icon={<Calendar size={20} />} label="This Week Sales" value={fmt(kpis.weekSales)} change={6.5} />
        <Stat icon={<PackageX size={20} />} label="Unsold Today" value={kpis.unsoldToday} />
        <Stat
          icon={<CreditCard size={20} />}
          label="Payment Status"
          value={kpis.paymentStatus === 'none' ? 'N/A' : kpis.paymentStatus.charAt(0).toUpperCase() + kpis.paymentStatus.slice(1)}
        />
      </div>

      {/* Sales Trend + Recent Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Sales Trend (14 Days)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: unknown) => [`P${Number(value).toLocaleString()}`, 'SRP Sales']} />
                <Line type="monotone" dataKey="sales" stroke="#FF6B00" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Recent Deliveries</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDeliveries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No deliveries yet.</p>
            ) : (
              recentDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">
                      {d.drNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(d.date).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' · '}
                      {storeMap.get(d.storeId) ?? d.storeId}
                    </p>
                  </div>
                  <StatusBadge category="delivery" status={d.status} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Summary + Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Billing */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Current Billing</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {myBilling.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No billing records.</p>
            ) : (
              [...myBilling]
                .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
                .slice(0, 5)
                .map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatBillingPeriod(b.period)}</p>
                      <p className="text-xs text-gray-500">
                        {storeMap.get(b.storeId) ?? b.storeId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">P{b.totalPayable.toLocaleString()}</p>
                      <StatusBadge category="billing" status={b.status} size="sm" />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Financial Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">Financial Breakdown</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SRP-Based Remittance */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">STORE REMITTANCE (SRP-BASED)</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total SRP Sales</span>
                  <span className="font-semibold">{fmt(financialSummary.billingSRP)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">15% Franchisee Profit</span>
                  <span className="font-semibold text-green-600">{fmt(financialSummary.franchiseeProfit)}</span>
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-gray-900">Remit to PD (85%)</span>
                  <span className="text-sm font-bold text-indigo-600">{fmt(financialSummary.remitToPD)}</span>
                </div>
              </div>
            </div>

            {/* ZAPP BILLING (DR-BASED) is intentionally hidden from
                franchisees — only distributor / billing / ops supervisor /
                area supervisor see the DR-based reference breakdown. */}

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-gray-500">Franchisee Profit (15% of SRP)</span>
              <Badge variant="success" size="md">
                {fmt(financialSummary.franchiseeProfit)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
