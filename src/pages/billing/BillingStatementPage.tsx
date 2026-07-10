// ============================================================
// ZAPP Donuts ERP — Billing Statement (carbon copy of the
// UBERDELI CORP. "BILLING SUMMARY" that the billing user needs).
// ============================================================
//
// Standalone, print-friendly page (rendered OUTSIDE the dashboard
// Layout so Print → Save as PDF is clean). One statement per
// DISTRIBUTOR (payer) per cutoff period: every delivery (DR) to
// each of that distributor's shops in the period, grouped by shop
// with per-shop subtotals + a grand total.
//
// Reference format: docs/references/billing-statement-format/*.png
//
// Data notes / placeholders (fill in when the data exists):
//   - Shop Code: was reverted (MD supplies it later) → blank for now.
//   - Payer Code / Tin No. / Address: not on the Distributor record
//     yet → shown as “—”.
//   - Returns / Delivery Adjustment / Merch. Allowance: not tracked
//     yet → 0.000, so Net Amount == DR Amount. Wire to unsold/returns
//     later.

import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import type { Delivery } from '@/types';
import {
  getCutoffRangeForDate,
  getCutoffEndDate,
  type CutoffRange,
} from '@/lib/billingComputations';

// Fixed corporate letterhead (matches the reference statement).
const COMPANY_NAME = 'UBERDELI CORP.';
const COMPANY_ADDRESS =
  '127 Unit 302 Voss Condominium, Kamuning Road corner Sct. Rallos Extension, Kamuning, Quezon City, 1103';

const MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// 3-decimal money with thousands separators, e.g. 2,846.092
const fmt3 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const mmddyyyy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${m}/${d}/${y}`;
};

const addDaysIso = (iso: string, days: number) => {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// "JUN.22-30,2026" style label for the cutoff period.
function periodLabel(yearMonth: string, cutoff: CutoffRange): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const mon = MONTHS3[m - 1] ?? mStr;
  let start: number;
  let end: number;
  if (cutoff === '1-7') { start = 1; end = 7; }
  else if (cutoff === '8-14') { start = 8; end = 14; }
  else if (cutoff === '15-21') { start = 15; end = 21; }
  else { start = 22; end = new Date(y, m, 0).getDate(); }
  return `${mon}.${start}-${end},${y}`;
}

// Deterministic 9-digit-ish reference document number (stable per
// distributor + period so a re-print keeps the same ref).
function refDocNo(distributorId: string, yearMonth: string, cutoff: CutoffRange): string {
  const s = `${distributorId}-${yearMonth}-${cutoff}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (900000000 + (h % 100000000)).toString();
}

const periodKeyOf = (d: Delivery) => `${d.date.slice(0, 10).slice(0, 7)}|${getCutoffRangeForDate(d.date)}`;

interface ShopGroup {
  storeId: string;
  shopName: string;
  shopCode: string;
  rows: Delivery[];
  subtotalDR: number;
  subtotalNet: number;
}

export default function BillingStatementPage() {
  const navigate = useNavigate();
  const { distributors, stores, deliveries } = useStore();

  const [distributorId, setDistributorId] = useState('');
  const [periodKey, setPeriodKey] = useState('');

  const distributor = distributors.find((d) => d.id === distributorId);

  const distributorOptions: SelectOption[] = [
    { value: '', label: 'Select distributor…' },
    ...distributors.map((d) => ({ value: d.id, label: d.name })),
  ];

  // Stores under the selected distributor.
  const shopStores = useMemo(
    () => stores.filter((s) => s.distributorId === distributorId),
    [stores, distributorId],
  );
  const shopStoreIds = useMemo(() => new Set(shopStores.map((s) => s.id)), [shopStores]);

  // Deliveries for those shops.
  const distDeliveries = useMemo(
    () => deliveries.filter((d) => shopStoreIds.has(d.storeId)),
    [deliveries, shopStoreIds],
  );

  // Period options = distinct (yearMonth|cutoff) present in the distributor's
  // deliveries, most recent first.
  const periodOptions: SelectOption[] = useMemo(() => {
    const keys = Array.from(new Set(distDeliveries.map(periodKeyOf)));
    keys.sort((a, b) => b.localeCompare(a));
    return [
      { value: '', label: 'Select period…' },
      ...keys.map((k) => {
        const [ym, cut] = k.split('|');
        return { value: k, label: periodLabel(ym, cut as CutoffRange) };
      }),
    ];
  }, [distDeliveries]);

  // Rows for the selected period, grouped by shop.
  const { groups, grandDR, grandNet, statementDate, dueDate, currentLabel, ref } = useMemo(() => {
    const empty = {
      groups: [] as ShopGroup[],
      grandDR: 0,
      grandNet: 0,
      statementDate: '',
      dueDate: '',
      currentLabel: '',
      ref: '',
    };
    if (!distributorId || !periodKey) return empty;
    const [yearMonth, cutoff] = periodKey.split('|') as [string, CutoffRange];

    const inPeriod = distDeliveries.filter((d) => periodKeyOf(d) === periodKey);

    const byStore = new Map<string, Delivery[]>();
    for (const d of inPeriod) {
      const arr = byStore.get(d.storeId) ?? [];
      arr.push(d);
      byStore.set(d.storeId, arr);
    }

    const groups: ShopGroup[] = [];
    let grandDR = 0;
    let grandNet = 0;
    for (const [storeId, rows] of byStore.entries()) {
      const store = stores.find((s) => s.id === storeId);
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const subtotalDR = rows.reduce((s, r) => s + r.totalDRCost, 0);
      const subtotalNet = subtotalDR; // credits are 0 for now
      grandDR += subtotalDR;
      grandNet += subtotalNet;
      groups.push({
        storeId,
        shopName: (store?.name ?? storeId).toUpperCase(),
        // Shop Code (MD-assigned) is not captured yet — blank until provided.
        shopCode: '',
        rows,
        subtotalDR,
        subtotalNet,
      });
    }
    groups.sort((a, b) => a.shopName.localeCompare(b.shopName));

    const [yStr, mStr] = yearMonth.split('-');
    const year = parseInt(yStr, 10);
    const monthZeroBased = parseInt(mStr, 10) - 1;
    const stmtDate = getCutoffEndDate(year, monthZeroBased, cutoff);

    return {
      groups,
      grandDR,
      grandNet,
      statementDate: stmtDate,
      dueDate: addDaysIso(stmtDate, 9),
      currentLabel: periodLabel(yearMonth, cutoff),
      ref: refDocNo(distributorId, yearMonth, cutoff),
    };
  }, [distributorId, periodKey, distDeliveries, stores]);

  const hasStatement = !!distributorId && !!periodKey && groups.length > 0;

  return (
    <div className="bstmt-root min-h-screen bg-gray-100">
      {/* Print + local styles */}
      <style>{`
        .bstmt-doc { font-family: Arial, Helvetica, sans-serif; color: #000; }
        .bstmt-table { border-collapse: collapse; width: 100%; }
        .bstmt-table th, .bstmt-table td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
        .bstmt-table thead th { background: #f3f4f6; font-weight: 700; text-align: center; vertical-align: middle; }
        .bstmt-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .bstmt-sub td { font-weight: 700; background: #fafafa; }
        .bstmt-grand td { font-weight: 700; background: #eef2ff; }
        @media print {
          .no-print { display: none !important; }
          .bstmt-root { background: #fff !important; }
          .bstmt-page { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; }
          .bstmt-table thead { display: table-header-group; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>

      {/* Toolbar (hidden when printing) */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/billing')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 cursor-pointer bg-transparent border-none"
        >
          <ArrowLeft size={16} /> Back to Billing
        </button>
        <div className="w-56">
          <Select
            options={distributorOptions}
            value={distributorId}
            onChange={(e) => { setDistributorId(e.target.value); setPeriodKey(''); }}
          />
        </div>
        <div className="w-52">
          <Select
            options={periodOptions}
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
          />
        </div>
        <button
          onClick={() => window.print()}
          disabled={!hasStatement}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* Empty prompts */}
      {!distributorId && (
        <div className="no-print p-10 text-center text-sm text-gray-500">
          Select a distributor and period to generate the billing statement.
        </div>
      )}
      {distributorId && !periodKey && (
        <div className="no-print p-10 text-center text-sm text-gray-500">
          Select a statement period.
        </div>
      )}
      {distributorId && periodKey && groups.length === 0 && (
        <div className="no-print p-10 text-center text-sm text-gray-500">
          No deliveries found for this distributor in the selected period.
        </div>
      )}

      {/* Statement document */}
      {hasStatement && (
        <div className="bstmt-page bstmt-doc mx-auto my-6 max-w-[1100px] bg-white shadow p-8">
          {/* Letterhead */}
          <div className="flex items-center gap-4">
            <img src="/zapp-logo.png" alt="ZAPP Donuts" className="h-24 w-auto object-contain shrink-0" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold tracking-wide">{COMPANY_NAME}</div>
              <div className="text-[11px] leading-tight">{COMPANY_ADDRESS}</div>
              <div className="text-base font-bold mt-1">BILLING SUMMARY</div>
            </div>
            <div className="w-28 shrink-0" />
          </div>

          {/* Customer + Account Summary */}
          <div className="mt-3 flex justify-between gap-6">
            <div className="text-[11px] leading-5">
              <div><span className="font-bold">Customer Name:</span> {distributor?.contactPerson || distributor?.name}</div>
              <div><span className="font-bold">Payer Code:</span> {distributor?.id ?? '—'}</div>
              <div><span className="font-bold">Tin No.:</span> —</div>
              <div><span className="font-bold">Address:</span> —</div>
            </div>
            <table className="text-[11px] border-collapse self-start">
              <tbody>
                <tr>
                  <td className="border border-black px-2 py-0.5 font-bold bg-gray-100">Account Summary</td>
                  <td className="border border-black px-2 py-0.5 text-right">Page 1 of 1</td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-0.5">Statement Date</td>
                  <td className="border border-black px-2 py-0.5 text-right">{mmddyyyy(statementDate)}</td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-0.5">Payment Due Date</td>
                  <td className="border border-black px-2 py-0.5 text-right">{mmddyyyy(dueDate)}</td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-0.5">Current {currentLabel}</td>
                  <td className="border border-black px-2 py-0.5 text-right">{fmt3(grandNet)}</td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-0.5">Ref. Doc No.</td>
                  <td className="border border-black px-2 py-0.5 text-right">{ref}</td>
                </tr>
                <tr>
                  <td className="border border-black px-2 py-0.5 font-bold">Total Statement (Vat Inc.)</td>
                  <td className="border border-black px-2 py-0.5 text-right font-bold">{fmt3(grandNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Line items */}
          <table className="bstmt-table mt-4">
            <thead>
              <tr>
                <th>Delivery<br />Date</th>
                <th>PO<br />Number</th>
                <th>DR<br />Number</th>
                <th>Shop Code</th>
                <th>Shop Name</th>
                <th>DR<br />Amount<br />(Vat Inc.)</th>
                <th>Returns<br />(Credit)<br />(Vat Inc.)</th>
                <th>Delivery<br />Adjustment<br />(Credit)<br />(Vat Inc.)</th>
                <th>Merch.<br />Allowance<br />(Vat Inc.)</th>
                <th>Net Amount<br />(Vat Inc.)</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.storeId}>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{mmddyyyy(r.date)}</td>
                      <td>ZAPP</td>
                      <td>{r.drNumber}</td>
                      <td>{g.shopCode || ''}</td>
                      <td>{g.shopName}</td>
                      <td className="bstmt-num">{fmt3(r.totalDRCost)}</td>
                      <td className="bstmt-num">0.000</td>
                      <td className="bstmt-num">0.000</td>
                      <td className="bstmt-num">0.000</td>
                      <td className="bstmt-num">{fmt3(r.totalDRCost)}</td>
                    </tr>
                  ))}
                  <tr className="bstmt-sub">
                    <td colSpan={5}>Total {g.shopName}</td>
                    <td className="bstmt-num">{fmt3(g.subtotalDR)}</td>
                    <td className="bstmt-num">0.000</td>
                    <td className="bstmt-num">0.000</td>
                    <td className="bstmt-num">0.000</td>
                    <td className="bstmt-num">{fmt3(g.subtotalNet)}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className="bstmt-grand">
                <td colSpan={5}>GRAND TOTAL</td>
                <td className="bstmt-num">{fmt3(grandDR)}</td>
                <td className="bstmt-num">0.000</td>
                <td className="bstmt-num">0.000</td>
                <td className="bstmt-num">0.000</td>
                <td className="bstmt-num">{fmt3(grandNet)}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-center text-xs font-bold mt-6">***END OF STATEMENT***</div>
        </div>
      )}
    </div>
  );
}
