import { useState, useMemo } from 'react';
import {
  Store as StoreIcon,
  Eye,
  Plus,
  Hash,
  X,
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
import { useToast } from '@/components/ui/Toast';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { Store } from '@/types';

const PAGE_SIZE = 10;

export default function FranchiseesPage() {
  const navigate = useNavigate();
  const { stores, plants, distributors, areaSupervisors, updateStore, currentUser } = useStore();
  const { addToast } = useToast();

  // Admins onboard an already-approved franchisee by assigning the Mister Donut
  // shop code (supplied post-approval). No login is created here.
  const canOnboard =
    currentUser?.role === 'owner' || currentUser?.role === 'operations_manager';
  // The full onboarding application form is also usable by the PD (they hold the
  // shop code + encode their own franchisees).
  const canOnboardApplication = canOnboard || currentUser?.role === 'partner_distributor';

  const [showForm, setShowForm] = useState(false);
  const [formStoreId, setFormStoreId] = useState('');
  const [formShopCode, setFormShopCode] = useState('');

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

  // ── New Franchisee (shop-code onboarding) form ──
  const franchiseeOptions: SelectOption[] = [
    { value: '', label: 'Select approved franchisee…' },
    ...[...stores]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        value: s.id,
        label: `${s.name} — ${s.ownerName}${s.shopCode ? ` (${s.shopCode})` : ''}`,
      })),
  ];
  const selectedFormStore = stores.find((s) => s.id === formStoreId);

  const onSelectFormStore = (id: string) => {
    setFormStoreId(id);
    setFormShopCode(stores.find((s) => s.id === id)?.shopCode ?? '');
  };
  const resetForm = () => {
    setShowForm(false);
    setFormStoreId('');
    setFormShopCode('');
  };
  const handleSaveShopCode = () => {
    if (!formStoreId || !formShopCode.trim()) return;
    updateStore(formStoreId, { shopCode: formShopCode.trim() });
    addToast('success', `Shop code saved for ${selectedFormStore?.name ?? 'franchisee'}.`);
    resetForm();
  };

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
      key: 'shopCode',
      header: 'Shop Code',
      render: (row) =>
        row.shopCode ? (
          <span className="font-mono text-sm text-gray-900">{row.shopCode}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
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
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Franchisees</h1>
          <p className="text-sm text-gray-500 mt-1">All franchise store accounts with ownership details</p>
        </div>
        <div className="flex items-center gap-3">
          {canOnboard && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Hash size={16} /> Assign Shop Code
            </button>
          )}
          {canOnboardApplication && (
            <button
              onClick={() => navigate('/franchisees/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none"
            >
              <Plus size={16} /> New Franchisee
            </button>
          )}
        </div>
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

      {/* New Franchisee — assign the Mister Donut shop code to an approved franchisee */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New Franchisee</h2>
              <button
                onClick={resetForm}
                className="p-1 rounded hover:bg-gray-100 cursor-pointer bg-transparent border-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Assign the Mister Donut <span className="font-medium">shop code</span> to an
                already-approved franchisee.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Franchisee</label>
                <Select
                  options={franchiseeOptions}
                  value={formStoreId}
                  onChange={(e) => onSelectFormStore(e.target.value)}
                />
              </div>

              {selectedFormStore && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 space-y-1">
                  <div><span className="text-gray-500">Owner:</span> <span className="font-medium text-gray-800">{selectedFormStore.ownerName}</span></div>
                  <div><span className="text-gray-500">Distributor:</span> <span className="font-medium text-gray-800">{distName(selectedFormStore.distributorId)}</span></div>
                  <div><span className="text-gray-500">Plant:</span> <span className="font-medium text-gray-800">{plantName(selectedFormStore.plantId)}</span></div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Code</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Hash size={16} /></span>
                  <input
                    type="text"
                    value={formShopCode}
                    onChange={(e) => setFormShopCode(e.target.value)}
                    placeholder="e.g. 129098"
                    className="block w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Ang code na ibinigay ng Mister Donut para sa tindahang ito.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShopCode}
                disabled={!formStoreId || !formShopCode.trim()}
                className="rounded-lg bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Shop Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
