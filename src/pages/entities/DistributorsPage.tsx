import { useState, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Store as StoreIcon,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  SearchInput,
  Select,
  Table,
  StatusBadge,
  Badge,
  Button,
  Stat,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import DistributorFormModal from './DistributorFormModal';
import type { Distributor } from '@/types';

const PAGE_SIZE = 10;

export default function DistributorsPage() {
  const { distributors, plants, stores, salesMetrics, currentUser } = useStore();

  // Reference data — Admin (Owner) only, matching 003's ref_write.
  const canManage = currentUser?.role === 'owner';
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enriched = useMemo(() =>
    distributors.map((d) => {
      const distStores = stores.filter((s) => s.distributorId === d.id);
      const distSales = salesMetrics
        .filter((m) => m.distributorId === d.id)
        .reduce((sum, m) => sum + m.srpSales, 0);
      return { ...d, storeCount: distStores.length, totalSales: distSales, stores: distStores };
    }),
  [distributors, stores, salesMetrics]);

  const filtered = useMemo(() => {
    let result = [...enriched];
    if (plantFilter) result = result.filter((d) => d.plantId === plantFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.contactPerson.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q),
      );
    }
    return result;
  }, [enriched, plantFilter, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  type EnrichedDist = (typeof enriched)[number];

  const columns: TableColumn<EnrichedDist>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'contactPerson',
      header: 'Contact',
      render: (row) => row.contactPerson,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-gray-500">{row.email}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone,
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.plantId),
    },
    {
      key: 'referralCode',
      header: 'Referral Code',
      render: (row) => <span className="font-mono text-xs">{row.referralCode}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'danger' : 'neutral'}
          size="sm"
          dot
        >
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'storeCount',
      header: 'Stores',
      render: (row) => row.storeCount,
    },
    // Boss: "lagyan mo din edit option sa distributor" — so a wrong name/plant/
    // contact can be corrected without a redeploy. Admin (Owner) only.
    ...(canManage
      ? ([
          {
            key: 'edit',
            header: '',
            render: (row) => (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Pencil size={13} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(distributors.find((d) => d.id === row.id) ?? null);
                }}
              >
                Edit
              </Button>
            ),
          },
        ] as TableColumn<EnrichedDist>[])
      : []),
    {
      key: 'expand',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpandedId(expandedId === row.id ? null : row.id);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          {expandedId === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      ),
    },
  ];

  const expanded = expandedId ? enriched.find((d) => d.id === expandedId) : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Distributors</h1>
        <p className="text-sm text-gray-500 mt-1">Manage partner distributors and their assigned stores</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Building2 size={18} />} label="Total Distributors" value={distributors.length} />
        <Stat icon={<StoreIcon size={18} />} label="Active" value={distributors.filter((d) => d.status === 'active').length} />
        <Stat label="Total Assigned Stores" value={enriched.reduce((s, d) => s + d.storeCount, 0)} />
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select options={plantOptions} value={plantFilter} onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }} />
            <div className="sm:col-span-2">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, contact, email..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        emptyMessage="No distributors found."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          onPageChange: setPage,
        }}
      />

      {/* Expanded Detail */}
      {expanded && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">{expanded.name} - Stores & Sales</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Total SRP Sales</p>
                <p className="text-lg font-bold text-gray-900">P{expanded.totalSales.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Store Count</p>
                <p className="text-lg font-bold text-gray-900">{expanded.storeCount}</p>
              </div>
              <div>
                <p className="text-gray-500">Plant</p>
                <p className="text-lg font-bold text-gray-900">{plantName(expanded.plantId)}</p>
              </div>
            </div>
            {expanded.stores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Store</th>
                      <th className="px-3 py-2 text-left">Owner</th>
                      <th className="px-3 py-2 text-left">Area</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expanded.stores.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">{s.ownerName}</td>
                        <td className="px-3 py-2">{s.area}</td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge category="store" status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No stores assigned.</p>
            )}
          </CardContent>
        </Card>
      )}

      <DistributorFormModal
        open={!!editing}
        distributor={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
