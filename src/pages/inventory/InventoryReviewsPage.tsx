import { useState, useMemo } from 'react';
import { ClipboardCheck, Eye, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Tabs,
  StatusBadge,
  EmptyState,
  SearchInput,
  Badge,
} from '@/components/ui';
import type { Tab } from '@/components/ui';
import type { EndingInventory } from '@/types';
import { InventoryReviewDetailDrawer } from './InventoryReviewDetailDrawer';

type ActiveTab = 'pending_review' | 'needs_review' | 'correction_required' | 'approved';

export default function InventoryReviewsPage() {
  const endingInventories = useStore((s) => s.endingInventories);
  const stores = useStore((s) => s.stores);
  const deliveries = useStore((s) => s.deliveries);
  const currentUser = useStore((s) => s.currentUser);
  const getEIForReview = useStore((s) => s.getEndingInventoriesForReview);

  // Re-evaluate scoped list whenever any underlying slice changes.
  // The getter reads endingInventories/stores/currentUser via Zustand's get()
  // inside its body, so ESLint can't see those reads and flags them as
  // unnecessary deps. They are required — without them the memo would never
  // recompute when those slices change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eis = useMemo(() => getEIForReview(), [endingInventories, stores, currentUser, getEIForReview]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('pending_review');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<ActiveTab, EndingInventory[]> = {
      pending_review: [],
      needs_review: [],
      correction_required: [],
      approved: [],
    };
    for (const ei of eis) {
      const s = ei.status;
      if (s === 'approved' || s === 'confirmed') map.approved.push(ei);
      else if (s === 'needs_review') map.needs_review.push(ei);
      else if (s === 'correction_required') map.correction_required.push(ei);
      else map.pending_review.push(ei);
    }
    return map;
  }, [eis]);

  const filtered = useMemo(() => {
    const list = grouped[activeTab];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((ei) => {
      const store = stores.find((st) => st.id === ei.storeId);
      const delivery = deliveries.find((d) => d.id === ei.deliveryId);
      return (
        (store?.name.toLowerCase().includes(q) ?? false) ||
        (delivery?.drNumber.toLowerCase().includes(q) ?? false) ||
        ei.id.toLowerCase().includes(q)
      );
    });
  }, [activeTab, grouped, search, stores, deliveries]);

  const tabs: Tab[] = [
    { key: 'pending_review', label: `Pending Review (${grouped.pending_review.length})` },
    { key: 'needs_review', label: `Needs Review (${grouped.needs_review.length})` },
    {
      key: 'correction_required',
      label: `Correction Required (${grouped.correction_required.length})`,
    },
    { key: 'approved', label: `Approved (${grouped.approved.length})` },
  ];

  const selectedEI = useMemo(
    () => (selectedId ? eis.find((e) => e.id === selectedId) ?? null : null),
    [selectedId, eis],
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={24} /> Inventory Reviews
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and validate ending inventory submissions from stores in your network.
        </p>
      </div>

      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search store name, DR number..."
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(k) => setActiveTab(k as ActiveTab)}
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck size={28} />}
                title="No submissions"
                description={
                  search
                    ? 'No matches for your search.'
                    : 'No ending inventory submissions in this status.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Store</th>
                      <th className="px-4 py-2 text-left">DR Number</th>
                      <th className="px-4 py-2 text-left">EI Date</th>
                      <th className="px-4 py-2 text-left">Submitted</th>
                      <th className="px-4 py-2 text-center">Total Unsold</th>
                      <th className="px-4 py-2 text-center">Flags</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((ei) => {
                      const store = stores.find((s) => s.id === ei.storeId);
                      const delivery = deliveries.find((d) => d.id === ei.deliveryId);
                      const totalUnsold = ei.unsoldItems.reduce(
                        (s, u) => s + u.quantity,
                        0,
                      );
                      const discrepancies = ei.unsoldItems.filter(
                        (u) => (u.discrepancy ?? 0) !== 0,
                      ).length;
                      return (
                        <tr
                          key={ei.id}
                          onClick={() => setSelectedId(ei.id)}
                          className="cursor-pointer hover:bg-orange-50/50"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {store?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {delivery?.drNumber ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{ei.date}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {ei.submittedAt
                              ? new Date(ei.submittedAt).toLocaleString('en-PH', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900">{totalUnsold}</td>
                          <td className="px-4 py-3 text-center">
                            {discrepancies > 0 ? (
                              <Badge variant="warning" size="sm">
                                <AlertTriangle size={10} className="inline mr-0.5" />
                                {discrepancies}
                              </Badge>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              category="inventory_review"
                              status={ei.status}
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="inline-flex items-center gap-1 text-zapp-orange hover:underline text-xs font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(ei.id);
                              }}
                            >
                              <Eye size={12} /> Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <InventoryReviewDetailDrawer
        ei={selectedEI}
        open={selectedEI !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
