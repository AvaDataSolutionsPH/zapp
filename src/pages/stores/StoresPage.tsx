import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, AlertOctagon, AlertTriangle, CheckCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  SearchInput,
  Select,
  Table,
  StatusBadge,
  Badge,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { Store, StoreDeliveryStatus } from '@/types';
import { getOverdueReasonForStore } from '@/lib/deliveryEnforcement';

const deliveryStatusVariant = (
  s: StoreDeliveryStatus,
): 'success' | 'warning' | 'danger' => {
  if (s === 'hold') return 'danger';
  if (s === 'warning') return 'warning';
  return 'success';
};

const deliveryStatusIcon = (s: StoreDeliveryStatus) => {
  if (s === 'hold') return <AlertOctagon size={10} className="inline mr-0.5" />;
  if (s === 'warning') return <AlertTriangle size={10} className="inline mr-0.5" />;
  return <CheckCircle size={10} className="inline mr-0.5" />;
};

const PAGE_SIZE = 10;

export default function StoresPage() {
  const navigate = useNavigate();
  const {
    getStoresForCurrentUser,
    plants,
    distributors,
    billingRecords,
    payments,
  } = useStore();

  const allStores = getStoresForCurrentUser();

  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [page, setPage] = useState(1);

  // Derive unique provinces and areas from stores
  const provinces = useMemo(
    () => [...new Set(allStores.map((s) => s.province).filter(Boolean))].sort(),
    [allStores],
  );
  const areas = useMemo(
    () => [...new Set(allStores.map((s) => s.area).filter(Boolean))].sort(),
    [allStores],
  );

  const filtered = useMemo(() => {
    let result = [...allStores];
    if (plantFilter) result = result.filter((s) => s.plantId === plantFilter);
    if (areaFilter) result = result.filter((s) => s.area === areaFilter);
    if (provinceFilter) result = result.filter((s) => s.province === provinceFilter);
    if (statusFilter) result = result.filter((s) => s.status === statusFilter);
    if (typeFilter) result = result.filter((s) => s.franchiseType === typeFilter);
    if (deliveryFilter) result = result.filter((s) => s.deliveryStatus === deliveryFilter);
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
  }, [allStores, plantFilter, areaFilter, provinceFilter, statusFilter, typeFilter, deliveryFilter, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';
  const distName = (id?: string) => (id ? distributors.find((d) => d.id === id)?.name ?? '-' : '-');

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const provinceOptions: SelectOption[] = [
    { value: '', label: 'All Provinces' },
    ...provinces.map((p) => ({ value: p, label: p })),
  ];
  const areaOptions: SelectOption[] = [
    { value: '', label: 'All Areas' },
    ...areas.map((a) => ({ value: a, label: a })),
  ];
  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending' },
    { value: 'blocked', label: 'Blocked' },
  ];
  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'direct', label: 'Direct' },
  ];
  const deliveryOptions: SelectOption[] = [
    { value: '', label: 'All Delivery' },
    { value: 'active', label: 'Active' },
    { value: 'warning', label: 'Warning' },
    { value: 'hold', label: 'Hold' },
  ];

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
      key: 'area',
      header: 'Area',
      render: (row) => row.area,
    },
    {
      key: 'province',
      header: 'Province',
      render: (row) => row.province,
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.plantId),
    },
    {
      key: 'distributorId',
      header: 'Distributor',
      render: (row) => distName(row.distributorId),
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
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="store" status={row.status} />,
    },
    {
      key: 'deliveryStatus',
      header: 'Delivery',
      render: (row) => {
        const reason = getOverdueReasonForStore(row.id, billingRecords, payments);
        return (
          <span title={reason.label}>
            <Badge variant={deliveryStatusVariant(row.deliveryStatus)} size="sm" dot>
              {deliveryStatusIcon(row.deliveryStatus)}
              {row.deliveryStatus.toUpperCase()}
            </Badge>
          </span>
        );
      },
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
        <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          {filtered.length} store{filtered.length !== 1 ? 's' : ''} found
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Select options={plantOptions} value={plantFilter} onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }} />
            <Select options={areaOptions} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setPage(1); }} />
            <Select options={provinceOptions} value={provinceFilter} onChange={(e) => { setProvinceFilter(e.target.value); setPage(1); }} />
            <Select options={statusOptions} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
            <Select options={typeOptions} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} />
            <Select options={deliveryOptions} value={deliveryFilter} onChange={(e) => { setDeliveryFilter(e.target.value); setPage(1); }} />
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search store name..." />
          </div>
        </CardContent>
      </Card>

      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/stores/${row.id}`)}
        emptyMessage="No stores found matching your filters."
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
