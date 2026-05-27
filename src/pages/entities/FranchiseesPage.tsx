import { useState, useMemo } from 'react';
import {
  Store as StoreIcon,
  Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  SearchInput,
  Select,
  Table,
  StatusBadge,
  Badge,
  Stat,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { Store } from '@/types';

const PAGE_SIZE = 10;

export default function FranchiseesPage() {
  const navigate = useNavigate();
  const { stores, plants, distributors, areaSupervisors } = useStore();

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');
  const [page, setPage] = useState(1);

  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';
  const distName = (id?: string) => (id ? distributors.find((d) => d.id === id)?.name ?? '-' : '-');
  const amName = (id: string) => areaSupervisors.find((a) => a.id === id)?.name ?? '-';

  const filtered = useMemo(() => {
    let result = [...stores];
    if (plantFilter) result = result.filter((s) => s.plantId === plantFilter);
    if (typeFilter) result = result.filter((s) => s.franchiseType === typeFilter);
    if (statusFilter) result = result.filter((s) => s.status === statusFilter);
    if (distributorFilter) result = result.filter((s) => s.distributorId === distributorFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  }, [stores, plantFilter, typeFilter, statusFilter, distributorFilter, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'direct', label: 'Direct' },
  ];
  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending' },
    { value: 'blocked', label: 'Blocked' },
  ];
  const distOptions: SelectOption[] = [
    { value: '', label: 'All Distributors' },
    ...distributors.map((d) => ({ value: d.id, label: d.name })),
  ];

  const directCount = stores.filter((s) => s.franchiseType === 'direct').length;
  const distributorCount = stores.filter((s) => s.franchiseType === 'distributor').length;
  const activeCount = stores.filter((s) => s.status === 'active').length;

  const columns: TableColumn<Store>[] = [
    {
      key: 'name',
      header: 'Store Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.businessName}</p>
        </div>
      ),
    },
    {
      key: 'ownerName',
      header: 'Owner',
      render: (row) => row.ownerName,
    },
    {
      key: 'franchiseType',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.franchiseType === 'distributor' ? 'info' : 'orange'} size="sm">
          {row.franchiseType === 'distributor' ? 'Distributor' : 'Direct'}
        </Badge>
      ),
    },
    {
      key: 'distributorId',
      header: 'Distributor',
      render: (row) => distName(row.distributorId),
    },
    {
      key: 'areaSupervisorId',
      header: 'Area Supervisor',
      render: (row) => amName(row.areaSupervisorId),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.plantId),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="store" status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/stores/${row.id}`);
          }}
          className="inline-flex items-center gap-1 text-sm text-zapp-orange hover:text-zapp-orange-dark transition-colors"
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Franchisees</h1>
        <p className="text-sm text-gray-500 mt-1">All franchise store accounts with ownership details</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<StoreIcon size={18} />} label="Total Franchisees" value={stores.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Distributor Type" value={distributorCount} />
        <Stat label="Direct Type" value={directCount} />
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <Select options={plantOptions} value={plantFilter} onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }} />
            <Select options={typeOptions} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} />
            <Select options={statusOptions} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
            <Select options={distOptions} value={distributorFilter} onChange={(e) => { setDistributorFilter(e.target.value); setPage(1); }} />
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search store or owner..." />
          </div>
        </CardContent>
      </Card>

      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/stores/${row.id}`)}
        emptyMessage="No franchisees found."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
