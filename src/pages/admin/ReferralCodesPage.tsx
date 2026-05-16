import { useState, useMemo, useCallback } from 'react';
import {
  QrCode,
  Plus,
  Copy,
  Link2,
  Hash,
  Users,
  Building2,
  Activity,
  Download,
  Ban,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Table,
  Modal,
  Select,
  SearchInput,
  Stat,
  EmptyState,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import type { TableColumn, SelectOption } from '@/components/ui';
import type { ReferralCode, ReferralType } from '@/types';

const PAGE_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────

function generateCode(type: ReferralType): string {
  const prefix = type === 'distributor' ? 'ZAPP-DIST' : 'ZAPP-INT';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

function buildReferralUrl(code: string): string {
  return `${window.location.origin}/apply?ref=${code}`;
}

function buildQrUrl(code: string): string {
  return `${window.location.origin}/referral/${code}`;
}

// ── Component ──────────────────────────────────────────────────────────

export default function ReferralCodesPage() {
  const {
    referralCodes,
    distributors,
    areaSupervisors,
    plants,
    addReferralCode,
  } = useStore();
  const { addToast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [showGenerate, setShowGenerate] = useState(false);
  const [qrCode, setQrCode] = useState<ReferralCode | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ReferralCode | null>(null);

  // Generate form
  const [genType, setGenType] = useState<ReferralType>('distributor');
  const [genDistributorId, setGenDistributorId] = useState('');
  const [genAreaSupervisorId, setGenAreaSupervisorId] = useState('');
  const [genPlantId, setGenPlantId] = useState('');
  const [genCodePreview, setGenCodePreview] = useState(() => generateCode('distributor'));

  // Loading simulation
  const [loading, setLoading] = useState(false);

  // ── Lookups ────────────────────────────────────────────────────────

  const distributorMap = useMemo(
    () => Object.fromEntries(distributors.map((d) => [d.id, d])),
    [distributors],
  );
  const areaSupervisorMap = useMemo(
    () => Object.fromEntries(areaSupervisors.map((a) => [a.id, a])),
    [areaSupervisors],
  );
  const plantMap = useMemo(
    () => Object.fromEntries(plants.map((p) => [p.id, p])),
    [plants],
  );

  // ── Stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = referralCodes.length;
    const active = referralCodes.filter((r) => r.status === 'active').length;
    const distCodes = referralCodes.filter((r) => r.type === 'distributor').length;
    const intCodes = referralCodes.filter((r) => r.type === 'zapp_internal').length;
    const totalUsage = referralCodes.reduce((sum, r) => sum + r.usageCount, 0);
    return { total, active, distCodes, intCodes, totalUsage };
  }, [referralCodes]);

  // ── Filtered & Paged Data ──────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...referralCodes];
    if (typeFilter) result = result.filter((r) => r.type === typeFilter);
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (plantFilter) result = result.filter((r) => r.plantId === plantFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const dist = r.distributorId ? distributorMap[r.distributorId] : null;
        const am = r.areaSupervisorId ? areaSupervisorMap[r.areaSupervisorId] : null;
        return (
          r.code.toLowerCase().includes(q) ||
          (dist?.name ?? '').toLowerCase().includes(q) ||
          (am?.name ?? '').toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [referralCodes, typeFilter, statusFilter, plantFilter, search, distributorMap, areaSupervisorMap]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // ── Actions ────────────────────────────────────────────────────────

  const handleCopyLink = useCallback(
    async (code: string) => {
      const url = buildReferralUrl(code);
      try {
        await navigator.clipboard.writeText(url);
        addToast('success', `Referral link copied: ${code}`);
      } catch {
        addToast('error', 'Failed to copy link to clipboard');
      }
    },
    [addToast],
  );

  const handleDeactivate = useCallback(() => {
    if (!deactivateTarget) return;
    // Mutate the code to inactive via store update pattern
    useStore.setState((s) => ({
      referralCodes: s.referralCodes.map((rc) =>
        rc.id === deactivateTarget.id ? { ...rc, status: 'inactive' as const } : rc,
      ),
    }));
    addToast('success', `Code ${deactivateTarget.code} deactivated`);
    setDeactivateTarget(null);
  }, [deactivateTarget, addToast]);

  const resetGenerateForm = () => {
    setGenType('distributor');
    setGenDistributorId('');
    setGenAreaSupervisorId('');
    setGenPlantId('');
    setGenCodePreview(generateCode('distributor'));
  };

  const handleGenerate = useCallback(() => {
    if (!genPlantId) {
      addToast('warning', 'Please select a plant');
      return;
    }
    if (genType === 'distributor' && !genDistributorId) {
      addToast('warning', 'Please select a distributor');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      addReferralCode({
        code: genCodePreview,
        type: genType,
        distributorId: genType === 'distributor' ? genDistributorId : undefined,
        areaSupervisorId: genAreaSupervisorId || undefined,
        plantId: genPlantId,
        status: 'active',
      });

      addToast('success', `Referral code ${genCodePreview} created`);
      setShowGenerate(false);
      resetGenerateForm();
      setLoading(false);
    }, 500);
  }, [genCodePreview, genType, genDistributorId, genAreaSupervisorId, genPlantId, addReferralCode, addToast]);

  const handleOpenGenerate = () => {
    resetGenerateForm();
    setShowGenerate(true);
  };

  const handleTypeChange = (type: ReferralType) => {
    setGenType(type);
    setGenCodePreview(generateCode(type));
    setGenDistributorId('');
  };

  const handleDownloadQr = useCallback(() => {
    if (!qrCode) return;
    const svg = document.querySelector('#qr-code-svg svg') as SVGElement | null;
    if (!svg) {
      addToast('info', 'QR download initiated');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `qr-${qrCode.code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addToast('success', 'QR code downloaded');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }, [qrCode, addToast]);

  // ── Filter Options ─────────────────────────────────────────────────

  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'zapp_internal', label: 'Zapp Internal' },
  ];

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const plantOptions: SelectOption[] = [
    { value: '', label: 'All Plants' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const plantSelectOptions: SelectOption[] = plants.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const distributorOptions: SelectOption[] = distributors
    .filter((d) => d.status === 'active')
    .map((d) => ({ value: d.id, label: d.name }));

  const areaSupervisorOptions: SelectOption[] = areaSupervisors.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  // ── Table Columns ──────────────────────────────────────────────────

  const columns: TableColumn<ReferralCode>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <span className="font-mono font-semibold text-gray-900">{row.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.type === 'distributor' ? 'info' : 'orange'} size="sm">
          {row.type === 'distributor' ? 'Distributor' : 'Zapp Internal'}
        </Badge>
      ),
    },
    {
      key: 'distributorId',
      header: 'Distributor',
      render: (row) =>
        row.distributorId ? (
          <span className="text-gray-700">{distributorMap[row.distributorId]?.name ?? '-'}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'areaSupervisorId',
      header: 'Area Supervisor',
      render: (row) =>
        row.areaSupervisorId ? (
          <span className="text-gray-700">{areaSupervisorMap[row.areaSupervisorId]?.name ?? '-'}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) => (
        <span className="text-gray-700">{plantMap[row.plantId]?.name ?? '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant={row.status === 'active' ? 'success' : 'neutral'}
          dot
          size="sm"
        >
          {row.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'usageCount',
      header: 'Usage',
      render: (row) => (
        <span className="font-medium text-gray-900">{row.usageCount}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-gray-500 text-xs">
          {new Date(row.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setQrCode(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="View QR Code"
          >
            <QrCode size={16} />
          </button>
          <button
            onClick={() => handleCopyLink(row.code)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Copy Link"
          >
            <Copy size={16} />
          </button>
          {row.status === 'active' && (
            <button
              onClick={() => setDeactivateTarget(row)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Deactivate"
            >
              <Ban size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral Codes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage referral codes for distributor and internal onboarding
          </p>
        </div>
        <Button
          iconLeft={<Plus size={16} />}
          onClick={handleOpenGenerate}
        >
          Generate New Code
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat icon={<Hash size={18} />} label="Total Codes" value={stats.total} />
        <Stat icon={<Activity size={18} />} label="Active Codes" value={stats.active} />
        <Stat icon={<Building2 size={18} />} label="Distributor Codes" value={stats.distCodes} />
        <Stat icon={<Link2 size={18} />} label="Zapp Internal" value={stats.intCodes} />
        <Stat icon={<Users size={18} />} label="Total Usage" value={stats.totalUsage} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              placeholder="Search codes, distributors..."
            />
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            />
            <Select
              options={plantOptions}
              value={plantFilter}
              onChange={(e) => { setPlantFilter(e.target.value); setPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 && !search && !typeFilter && !statusFilter && !plantFilter ? (
        <EmptyState
          icon={<QrCode size={28} />}
          title="No referral codes yet"
          description="Generate your first referral code to start onboarding franchisees."
          actionLabel="Generate Code"
          onAction={handleOpenGenerate}
        />
      ) : (
        <Table<ReferralCode>
          columns={columns}
          data={paged}
          keyExtractor={(row) => row.id}
          emptyMessage="No referral codes match your filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onPageChange: setPage,
          }}
        />
      )}

      {/* ── Generate Modal ──────────────────────────────────────────── */}
      <Modal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        title="Generate New Referral Code"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={loading}>
              Create Code
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Code Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Generated Code Preview</p>
            <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
              {genCodePreview}
            </p>
            <button
              onClick={() => setGenCodePreview(generateCode(genType))}
              className="text-xs text-zapp-orange hover:underline mt-2 inline-block"
            >
              Regenerate
            </button>
          </div>

          {/* Type Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Code Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTypeChange('distributor')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  genType === 'distributor'
                    ? 'border-zapp-orange bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Building2
                  size={20}
                  className={genType === 'distributor' ? 'text-zapp-orange' : 'text-gray-400'}
                />
                <span className={`text-sm font-medium ${genType === 'distributor' ? 'text-zapp-orange' : 'text-gray-600'}`}>
                  Distributor
                </span>
              </button>
              <button
                onClick={() => handleTypeChange('zapp_internal')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  genType === 'zapp_internal'
                    ? 'border-zapp-orange bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Link2
                  size={20}
                  className={genType === 'zapp_internal' ? 'text-zapp-orange' : 'text-gray-400'}
                />
                <span className={`text-sm font-medium ${genType === 'zapp_internal' ? 'text-zapp-orange' : 'text-gray-600'}`}>
                  Zapp Internal
                </span>
              </button>
            </div>
          </div>

          {/* Distributor (conditional) */}
          {genType === 'distributor' && (
            <Select
              label="Distributor"
              placeholder="Select a distributor"
              options={distributorOptions}
              value={genDistributorId}
              onChange={(e) => setGenDistributorId(e.target.value)}
            />
          )}

          {/* Area Supervisor */}
          <Select
            label="Area Supervisor"
            placeholder="Select an area supervisor (optional)"
            options={[{ value: '', label: 'None' }, ...areaSupervisorOptions]}
            value={genAreaSupervisorId}
            onChange={(e) => setGenAreaSupervisorId(e.target.value)}
          />

          {/* Plant */}
          <Select
            label="Plant"
            placeholder="Select a plant"
            options={plantSelectOptions}
            value={genPlantId}
            onChange={(e) => setGenPlantId(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── QR Code Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!qrCode}
        onClose={() => setQrCode(null)}
        title="QR Code"
        size="md"
      >
        {qrCode && (
          <div className="flex flex-col items-center gap-6">
            {/* QR Code */}
            <div
              id="qr-code-svg"
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
            >
              <QRCodeSVG
                value={buildQrUrl(qrCode.code)}
                size={220}
                level="H"
                includeMargin
              />
            </div>

            {/* Code Display */}
            <div className="text-center">
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                {qrCode.code}
              </p>
              <p className="text-xs text-gray-500 mt-1 break-all">
                {buildQrUrl(qrCode.code)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                fullWidth
                iconLeft={<Copy size={16} />}
                onClick={() => handleCopyLink(qrCode.code)}
              >
                Copy Link
              </Button>
              <Button
                variant="outline"
                fullWidth
                iconLeft={<Download size={16} />}
                onClick={handleDownloadQr}
              >
                Download QR
              </Button>
            </div>

            {/* Details */}
            <div className="w-full bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Referral Details</h4>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900 font-medium">
                  {qrCode.type === 'distributor' ? 'Distributor' : 'Zapp Internal'}
                </span>

                <span className="text-gray-500">Distributor</span>
                <span className="text-gray-900">
                  {qrCode.distributorId
                    ? distributorMap[qrCode.distributorId]?.name ?? '-'
                    : '-'}
                </span>

                <span className="text-gray-500">Area Supervisor</span>
                <span className="text-gray-900">
                  {qrCode.areaSupervisorId
                    ? areaSupervisorMap[qrCode.areaSupervisorId]?.name ?? '-'
                    : '-'}
                </span>

                <span className="text-gray-500">Plant</span>
                <span className="text-gray-900">
                  {plantMap[qrCode.plantId]?.name ?? '-'}
                </span>

                <span className="text-gray-500">Status</span>
                <span>
                  <Badge
                    variant={qrCode.status === 'active' ? 'success' : 'neutral'}
                    dot
                    size="sm"
                  >
                    {qrCode.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </span>

                <span className="text-gray-500">Usage Count</span>
                <span className="text-gray-900 font-medium">{qrCode.usageCount}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Deactivate Confirm ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Referral Code"
        message={`Are you sure you want to deactivate code "${deactivateTarget?.code ?? ''}"? This will prevent new applications from using this referral link.`}
        confirmLabel="Deactivate"
        danger
      />
    </div>
  );
}
