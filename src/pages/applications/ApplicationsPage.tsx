import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Facebook,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Button,
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
import { applicationType, effectiveAreaSupervisorId } from '@/lib/applicationMonitoring';
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
    subPartnerDistributors,
    currentUser,
  } = useStore();

  // An AS sees the applications it is responsible for. Resolution goes through
  // effectiveAreaSupervisorId, so the admin province master list (Phase 5) wins
  // and re-pointing coverage instantly re-scopes the queue; applications whose
  // province has no coverage still match via the referral code's AS.
  const applications = useMemo(() => {
    if (currentUser?.role === 'area_manager') {
      const myAreaSupervisor = areaSupervisors.find(
        (as_) => as_.id === currentUser.id || as_.name === currentUser.name,
      );
      if (myAreaSupervisor) {
        return allApplications.filter(
          (a) => effectiveAreaSupervisorId(a, areaSupervisors) === myAreaSupervisor.id,
        );
      }
      return [];
    }
    // A PD sees "Own Referral Code + assigned Sub PDs" — its own channel plus
    // every application filed under an SPD that reports to it.
    if (currentUser?.role === 'partner_distributor') {
      const mySpdIds = subPartnerDistributors
        .filter((s) => s.parentDistributorId === currentUser.distributorId)
        .map((s) => s.id);
      return allApplications.filter(
        (a) =>
          a.assignedDistributorId === currentUser.distributorId ||
          (!!a.assignedSubPartnerDistributorId &&
            mySpdIds.includes(a.assignedSubPartnerDistributorId)),
      );
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
  }, [allApplications, currentUser, areaSupervisors, subPartnerDistributors]);

  // Primary filters (always visible)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Secondary filters (behind "Advanced")
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [plantFilter, setPlantFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');
  const [marketSourceFilter, setMarketSourceFilter] = useState('');
  const [rtcFilter, setRtcFilter] = useState('');
  const [comparableFilter, setComparableFilter] = useState('');
  const [adsFilter, setAdsFilter] = useState('');
  const [shopCodeFilter, setShopCodeFilter] = useState('');
  const [mapsLinkFilter, setMapsLinkFilter] = useState('');
  const [mapsPictureFilter, setMapsPictureFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading] = useState(false);

  // A PD/SPD is already confined to one distributor's channel, so a
  // "Distributor" filter would only ever have one meaningful value.
  const isChannelScoped =
    currentUser?.role === 'partner_distributor' ||
    currentUser?.role === 'sub_partner_distributor';

  const resetFilters = () => {
    setSearch(''); setStatusFilter('all'); setProvinceFilter(''); setAreaFilter('');
    setTypeFilter(''); setDateFrom(''); setDateTo(''); setPlantFilter('');
    setDistributorFilter(''); setMarketSourceFilter(''); setRtcFilter('');
    setComparableFilter(''); setAdsFilter(''); setShopCodeFilter('');
    setMapsLinkFilter(''); setMapsPictureFilter(''); setPage(1);
  };

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

    // ── Primary ──────────────────────────────────────────────
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (provinceFilter) {
      result = result.filter((a) => a.province === provinceFilter);
    }
    if (areaFilter) {
      result = result.filter((a) => effectiveAreaSupervisorId(a, areaSupervisors) === areaFilter);
    }
    if (typeFilter) {
      result = result.filter((a) => applicationType(a.referralType) === typeFilter);
    }
    if (dateFrom) {
      result = result.filter((a) => a.submittedAt >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((a) => a.submittedAt <= dateTo + 'T23:59:59');
    }

    // ── Secondary ────────────────────────────────────────────
    if (plantFilter) {
      result = result.filter((a) => a.assignedPlantId === plantFilter);
    }
    if (distributorFilter) {
      result = result.filter((a) => a.assignedDistributorId === distributorFilter);
    }
    if (marketSourceFilter) {
      result = result.filter((a) => a.marketSource === marketSourceFilter);
    }
    if (rtcFilter) {
      result = result.filter((a) => a.rtc === rtcFilter);
    }
    if (comparableFilter) {
      result = result.filter((a) => a.comparable === comparableFilter);
    }
    if (adsFilter) {
      result = result.filter((a) => a.ads === adsFilter);
    }
    // "with / without" presence filters
    if (shopCodeFilter) {
      result = result.filter((a) => (shopCodeFilter === 'with' ? !!a.shopCode : !a.shopCode));
    }
    if (mapsLinkFilter) {
      result = result.filter((a) => (mapsLinkFilter === 'with' ? !!a.googleMapsLink : !a.googleMapsLink));
    }
    if (mapsPictureFilter) {
      result = result.filter((a) =>
        mapsPictureFilter === 'with' ? !!a.googleMapsPictureUrl : !a.googleMapsPictureUrl,
      );
    }

    if (search) {
      const q = search.toLowerCase();
      // Spec: Applicant Name, Store Name, Contact Number, Email, Referral Code,
      // Shop Code.
      result = result.filter(
        (a) =>
          a.fullName.toLowerCase().includes(q) ||
          a.storeName.toLowerCase().includes(q) ||
          a.mobile.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.referralCode.toLowerCase().includes(q) ||
          (a.shopCode?.toLowerCase().includes(q) ?? false),
      );
    }

    // Sort by newest first
    result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return result;
  }, [
    // areaSupervisors: the Area Supervisor filter resolves through the province
    // master list, so edits to coverage must re-run this.
    applications, areaSupervisors, statusFilter, provinceFilter, areaFilter, typeFilter,
    dateFrom, dateTo, plantFilter, distributorFilter, marketSourceFilter, rtcFilter,
    comparableFilter, adsFilter, shopCodeFilter, mapsLinkFilter, mapsPictureFilter, search,
  ]);

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
  // Auto-populated per spec — the provinces actually present in the user's own
  // scope, so the dropdown never offers a province with zero results.
  const provinceOptions: SelectOption[] = useMemo(() => {
    const found = [...new Set(applications.map((a) => a.province).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Areas' },
      ...found.map((p) => ({ value: p as string, label: p as string })),
    ];
  }, [applications]);
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    // Stored as 'declined'; the module calls it Disapproved.
    { value: 'declined', label: 'Disapproved' },
    // Was missing entirely — applications parked in needs_more_info were
    // unreachable from this filter.
    { value: 'needs_more_info', label: 'Needs More Info' },
  ];
  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Distributor', label: 'Distributor' },
    { value: 'Direct', label: 'Direct' },
  ];
  const marketSourceOptions: SelectOption[] = [
    { value: '', label: 'All Market Sources' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'referral', label: 'Referral' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'website', label: 'Website' },
    { value: 'others', label: 'Others' },
  ];
  const rtcOptions: SelectOption[] = [
    { value: '', label: 'All RTC' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'disapproved', label: 'Disapproved' },
  ];
  const yesNoOptions = (label: string): SelectOption[] => [
    { value: '', label },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];
  const presenceOptions = (all: string, withL: string, withoutL: string): SelectOption[] => [
    { value: '', label: all },
    { value: 'with', label: withL },
    { value: 'without', label: withoutL },
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
      render: (row) => {
        const type = applicationType(row.referralType);
        return (
          <Badge variant={type === 'Distributor' ? 'info' : 'orange'} size="sm">
            {type}
          </Badge>
        );
      },
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => plantName(row.assignedPlantId),
    },
    {
      key: 'areaSupervisorId',
      header: 'Area Supervisor',
      // Resolved live from the province master list, not the stored id.
      render: (row) => amName(effectiveAreaSupervisorId(row, areaSupervisors)),
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

      {/* Filter Bar — primary always visible, secondary behind "Advanced".
          Every setter resets to page 1: filtering while on page 3 would
          otherwise land on an empty page. */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              placeholder="Status"
            />
            <Select
              options={provinceOptions}
              value={provinceFilter}
              onChange={(e) => { setProvinceFilter(e.target.value); setPage(1); }}
              placeholder="Area (Province)"
            />
            <Select
              options={amOptions}
              value={areaFilter}
              onChange={(e) => { setAreaFilter(e.target.value); setPage(1); }}
              placeholder="Area Supervisor"
            />
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              placeholder="Type"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
                placeholder="To"
              />
            </div>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Name, store, contact, email, code..."
            />
          </div>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
              <Select
                options={marketSourceOptions}
                value={marketSourceFilter}
                onChange={(e) => { setMarketSourceFilter(e.target.value); setPage(1); }}
                placeholder="Market Source"
              />
              <Select
                options={rtcOptions}
                value={rtcFilter}
                onChange={(e) => { setRtcFilter(e.target.value); setPage(1); }}
                placeholder="RTC"
              />
              <Select
                options={yesNoOptions('All Comparable')}
                value={comparableFilter}
                onChange={(e) => { setComparableFilter(e.target.value); setPage(1); }}
                placeholder="Comparable"
              />
              <Select
                options={yesNoOptions('All ADS')}
                value={adsFilter}
                onChange={(e) => { setAdsFilter(e.target.value); setPage(1); }}
                placeholder="ADS"
              />
              <Select
                options={presenceOptions('All Shop Codes', 'With Shop Code', 'Without Shop Code')}
                value={shopCodeFilter}
                onChange={(e) => { setShopCodeFilter(e.target.value); setPage(1); }}
                placeholder="Shop Code"
              />
              <Select
                options={presenceOptions('All Maps Links', 'With Maps Link', 'Without Maps Link')}
                value={mapsLinkFilter}
                onChange={(e) => { setMapsLinkFilter(e.target.value); setPage(1); }}
                placeholder="Google Maps Link"
              />
              <Select
                options={presenceOptions('All Maps Pictures', 'Uploaded', 'Not Uploaded')}
                value={mapsPictureFilter}
                onChange={(e) => { setMapsPictureFilter(e.target.value); setPage(1); }}
                placeholder="Maps Picture"
              />
              <Select
                options={plantOptions}
                value={plantFilter}
                onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }}
                placeholder="Plant"
              />
              {/* Distributor is meaningless to a PD/SPD — their whole scope is
                  already one distributor. */}
              {!isChannelScoped && (
                <Select
                  options={distOptions}
                  value={distributorFilter}
                  onChange={(e) => { setDistributorFilter(e.target.value); setPage(1); }}
                  placeholder="Distributor"
                />
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              iconRight={showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced filters'}
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {filtered.length} of {applications.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                iconLeft={<RotateCcw size={14} />}
              >
                Reset Filters
              </Button>
            </div>
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
