import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Facebook,
} from 'lucide-react';
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
  Skeleton,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import { ensureHttpUrl } from '@/lib/externalUrl';
import type { Application } from '@/types';

const PAGE_SIZE = 10;

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const {
    applications: allApplications,
    plants,
    distributors,
    areaSupervisors,
    currentUser,
  } = useStore();

  // Area supervisors only see applications assigned to their area
  const applications = useMemo(() => {
    if (currentUser?.role === 'area_manager') {
      const myAreaSupervisor = areaSupervisors.find(
        (as_) => as_.id === currentUser.id || as_.name === currentUser.name,
      );
      if (myAreaSupervisor) {
        return allApplications.filter(
          (a) => a.assignedAreaSupervisorId === myAreaSupervisor.id,
        );
      }
      return [];
    }
    // A PD only sees the website applicants under its own channel/distributor.
    if (currentUser?.role === 'partner_distributor') {
      return allApplications.filter((a) => a.assignedDistributorId === currentUser.distributorId);
    }
    // An SPD sees "Own Referral Code only". RLS (022) already scopes the rows it
    // can fetch, but filter here too: it keeps the mock/no-DB path honest and
    // stops an SPD falling through to the see-everything branch below.
    if (currentUser?.role === 'sub_partner_distributor') {
      return allApplications.filter(
        (a) => a.assignedSubPartnerDistributorId === currentUser.subPartnerDistributorId,
      );
    }
    return allApplications;
  }, [allApplications, currentUser, areaSupervisors]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [plantFilter, setPlantFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading] = useState(false);

  // Status counts
  const counts = useMemo(() => {
    const pending = applications.filter((a) => a.status === 'pending').length;
    const approved = applications.filter((a) => a.status === 'approved').length;
    const declined = applications.filter((a) => a.status === 'declined').length;
    return { total: applications.length, pending, approved, declined };
  }, [applications]);

  // Filtered data
  const filtered = useMemo(() => {
    let result = [...applications];

    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (plantFilter) {
      result = result.filter((a) => a.assignedPlantId === plantFilter);
    }
    if (distributorFilter) {
      result = result.filter((a) => a.assignedDistributorId === distributorFilter);
    }
    if (areaFilter) {
      result = result.filter((a) => a.assignedAreaSupervisorId === areaFilter);
    }
    if (dateFrom) {
      result = result.filter((a) => a.submittedAt >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((a) => a.submittedAt <= dateTo + 'T23:59:59');
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.fullName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.storeName.toLowerCase().includes(q),
      );
    }

    // Sort by newest first
    result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return result;
  }, [applications, statusFilter, plantFilter, distributorFilter, areaFilter, dateFrom, dateTo, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Lookup helpers
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '-';
  const amName = (id?: string) => (id ? areaSupervisors.find((a) => a.id === id)?.name ?? '-' : '-');

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const distOptions: SelectOption[] = [
    { value: '', label: 'All Distributors' },
    ...distributors.map((d) => ({ value: d.id, label: d.name })),
  ];
  const amOptions: SelectOption[] = [
    { value: '', label: 'All Area Supervisors' },
    ...areaSupervisors.map((a) => ({ value: a.id, label: a.name })),
  ];
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'declined', label: 'Declined' },
  ];

  const columns: TableColumn<Application>[] = [
    {
      key: 'applicationNumber',
      header: 'Application #',
      render: (row) => (
        <span className="font-mono text-xs text-gray-700">{row.applicationNumber ?? '—'}</span>
      ),
    },
    {
      key: 'fullName',
      header: 'Applicant Name',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{row.fullName}</span>,
    },
    {
      key: 'storeName',
      header: 'Store Name',
      render: (row) => row.storeName,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-gray-500">{row.email}</span>,
    },
    {
      key: 'facebookLink',
      header: 'Facebook',
      // stopPropagation so opening FB doesn't also trigger the row's navigate.
      render: (row) =>
        ensureHttpUrl(row.facebookLink) ? (
          <a
            href={ensureHttpUrl(row.facebookLink)!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            title={row.facebookLink}
          >
            <Facebook size={14} /> Open
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'referralCode',
      header: 'Referral Code',
      render: (row) => (
        <span className="font-mono text-xs text-gray-600">{row.referralCode}</span>
      ),
    },
    {
      key: 'referralType',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.referralType === 'distributor' ? 'info' : 'orange'} size="sm">
          {row.referralType === 'distributor' ? 'Distributor' : 'Direct'}
        </Badge>
      ),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.assignedPlantId),
    },
    {
      key: 'areaSupervisorId',
      header: 'Area Supervisor',
      render: (row) => amName(row.assignedAreaSupervisorId),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge category="application" status={row.status} />,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (row) => new Date(row.submittedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/applications/${row.id}`);
          }}
          className="inline-flex items-center gap-1 text-sm text-zapp-orange hover:text-zapp-orange-dark transition-colors"
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" lines={2} />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
        <Skeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Franchise Applications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage franchise application submissions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<FileText size={18} />}
          label="Total Applications"
          value={counts.total}
        />
        <Stat
          icon={<Clock size={18} />}
          label="Pending Review"
          value={counts.pending}
        />
        <Stat
          icon={<CheckCircle2 size={18} />}
          label="Approved"
          value={counts.approved}
        />
        <Stat
          icon={<XCircle size={18} />}
          label="Declined"
          value={counts.declined}
        />
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Status"
            />
            <Select
              options={plantOptions}
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Plant"
            />
            <Select
              options={distOptions}
              value={distributorFilter}
              onChange={(e) => {
                setDistributorFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Distributor"
            />
            <Select
              options={amOptions}
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Area Supervisor"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="To"
              />
            </div>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search name/email..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        data={paged}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="No applications found matching your filters."
        onRowClick={(row) => navigate(`/applications/${row.id}`)}
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
