import { useState, useMemo } from 'react';
import {
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  SearchInput,
  Select,
  Table,
  StatusBadge,
  Badge,
  Stat,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { AreaSupervisor } from '@/types';
import AssignProvincesModal from './AssignProvincesModal';

const PAGE_SIZE = 10;

export default function AreaManagersPage() {
  const { areaSupervisors, plants, stores } = useStore();

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<AreaSupervisor | null>(null);

  const enriched = useMemo(() =>
    areaSupervisors.map((am) => {
      const amStores = stores.filter(
        (s) =>
          am.assignedStoreIds.includes(s.id) ||
          s.areaSupervisorId === am.id,
      );
      return { ...am, storeCount: amStores.length, stores: amStores };
    }),
  [areaSupervisors, stores]);

  const filtered = useMemo(() => {
    let result = [...enriched];
    if (plantFilter) result = result.filter((am) => am.plantId === plantFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (am) =>
          am.name.toLowerCase().includes(q) ||
          am.email.toLowerCase().includes(q) ||
          am.assignedAreas.some((a) => a.toLowerCase().includes(q)),
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

  type EnrichedAM = (typeof enriched)[number];

  const columns: TableColumn<EnrichedAM>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
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
      key: 'assignedAreas',
      header: 'Areas',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.assignedAreas.map((area) => (
            <Badge key={area} variant="neutral" size="sm">{area}</Badge>
          ))}
        </div>
      ),
    },
    {
      // The province master list — what actually drives auto-assignment. Kept
      // separate from "Areas" above, which is free-text city names for display.
      key: 'assignedProvinces',
      header: 'Provinces (Coverage)',
      render: (row) => {
        const provinces = row.assignedProvinces ?? [];
        if (provinces.length === 0) {
          return <span className="text-xs text-gray-400">Not set</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {provinces.map((p) => (
              <Badge key={p} variant="info" size="sm">{p}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'assign',
      header: '',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          iconLeft={<MapPin size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            setAssigning(areaSupervisors.find((a) => a.id === row.id) ?? null);
          }}
        >
          Assign Areas
        </Button>
      ),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.plantId),
    },
    {
      key: 'storeCount',
      header: 'Store Count',
      render: (row) => row.storeCount,
    },
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

  const expanded = expandedId ? enriched.find((am) => am.id === expandedId) : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Area Supervisors</h1>
        <p className="text-sm text-gray-500 mt-1">Manage area supervisors and their assigned territories</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Users size={18} />} label="Total Area Supervisors" value={areaSupervisors.length} />
        <Stat icon={<MapPin size={18} />} label="Total Areas Covered" value={areaSupervisors.reduce((s, am) => s + am.assignedAreas.length, 0)} />
        <Stat label="Total Stores Managed" value={enriched.reduce((s, am) => s + am.storeCount, 0)} />
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select options={plantOptions} value={plantFilter} onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }} />
            <div className="sm:col-span-2">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email, area..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        emptyMessage="No area supervisors found."
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
            <h3 className="text-lg font-semibold text-gray-900">{expanded.name} - Assigned Stores</h3>
          </CardHeader>
          <CardContent>
            {expanded.stores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Store</th>
                      <th className="px-3 py-2 text-left">Owner</th>
                      <th className="px-3 py-2 text-left">Area</th>
                      <th className="px-3 py-2 text-left">Province</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expanded.stores.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">{s.ownerName}</td>
                        <td className="px-3 py-2">{s.area}</td>
                        <td className="px-3 py-2">{s.province}</td>
                        <td className="px-3 py-2">
                          <Badge variant={s.franchiseType === 'distributor' ? 'info' : 'orange'} size="sm">
                            {s.franchiseType === 'distributor' ? 'Distributor' : 'Direct'}
                          </Badge>
                        </td>
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

      {/* Admin settings — province coverage. `key` remounts the modal per
          supervisor so its draft state re-seeds from the right one. */}
      <AssignProvincesModal
        key={assigning?.id ?? 'none'}
        supervisor={assigning}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}
