import { useState, useMemo } from 'react';
import {
  Settings,
  Users,
  Server,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  Info,
  Lock,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Table,
  Tabs,
  Input,
  Select,
  useToast,
  Stat,
} from '@/components/ui';
import type { TableColumn, Tab } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────

interface DemoUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  plantId?: string;
  status: 'active';
}

// ── Constants ──────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const BUILD_DATE = '2026-03-20';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  operations_manager: 'Operations Supervisor',
  forecaster: 'Forecaster',
  plant_manager: 'Plant Manager',
  billing_user: 'Billing User',
  partner_distributor: 'Partner Distributor',
  franchisee_distributor: 'Franchisee Distributor',
  franchisee_direct: 'Franchisee Direct',
  area_manager: 'Area Supervisor',
};

const ROLE_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'> = {
  owner: 'danger',
  operations_manager: 'orange',
  forecaster: 'info',
  plant_manager: 'warning',
  billing_user: 'neutral',
  partner_distributor: 'success',
  franchisee_distributor: 'success',
  franchisee_direct: 'info',
  area_manager: 'warning',
};

// ── Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { demoUsers, plants } = useStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('general');

  // General settings state
  const [businessName, setBusinessName] = useState('ZAPP Donuts Philippines');
  const [address, setAddress] = useState('123 Donut Avenue, Makati City, Metro Manila');
  const [contactPhone, setContactPhone] = useState('+63 917 123 4567');
  const [contactEmail, setContactEmail] = useState('admin@zappdonuts.com');
  const [paymentDeadline, setPaymentDeadline] = useState('48');
  const [deliveryBlocked, setDeliveryBlocked] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalDirty, setGeneralDirty] = useState(false);

  // System state
  const [resetting, setResetting] = useState(false);

  // ── Plant lookup ───────────────────────────────────────────────────

  const plantMap = useMemo(
    () => Object.fromEntries(plants.map((p) => [p.id, p])),
    [plants],
  );

  // ── Tabs Config ────────────────────────────────────────────────────

  const tabs: Tab[] = [
    { key: 'general', label: 'General Settings', icon: <Settings size={16} /> },
    { key: 'users', label: 'User Management', icon: <Users size={16} /> },
    { key: 'system', label: 'System', icon: <Server size={16} /> },
  ];

  // ── General Settings Handlers ──────────────────────────────────────

  const handleSaveGeneral = () => {
    setGeneralSaving(true);
    setTimeout(() => {
      setGeneralSaving(false);
      setGeneralDirty(false);
      addToast('success', 'Settings saved successfully');
    }, 600);
  };

  const markDirty = () => {
    if (!generalDirty) setGeneralDirty(true);
  };

  // ── User Management Table ──────────────────────────────────────────

  const userRows: DemoUserRow[] = useMemo(
    () =>
      demoUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        plantId: u.plantId,
        status: 'active' as const,
      })),
    [demoUsers],
  );

  const userColumns: TableColumn<DemoUserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-zapp-orange text-xs font-bold">
            {row.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-gray-600">{row.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={ROLE_VARIANTS[row.role] ?? 'neutral'} size="sm">
          {ROLE_LABELS[row.role] ?? row.role}
        </Badge>
      ),
    },
    {
      key: 'plantId',
      header: 'Plant',
      render: (row) =>
        row.plantId ? (
          <span className="text-gray-700">{plantMap[row.plantId]?.name ?? '-'}</span>
        ) : (
          <span className="text-gray-400">All Plants</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <Badge variant="success" dot size="sm">
          Active
        </Badge>
      ),
    },
  ];

  // ── System Handlers ────────────────────────────────────────────────

  const handleResetData = () => {
    setResetting(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // ── API Status Items ───────────────────────────────────────────────

  const apiServices = [
    { name: 'Core API', status: 'operational', latency: '12ms' },
    { name: 'Authentication', status: 'operational', latency: '8ms' },
    { name: 'Image Upload (S3)', status: 'operational', latency: '45ms' },
    { name: 'AI Vision Service', status: 'operational', latency: '230ms' },
    { name: 'Payment Gateway', status: 'operational', latency: '68ms' },
    { name: 'Notification Service', status: 'operational', latency: '15ms' },
  ];

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure application settings and manage system preferences
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        {/* ── General Settings Tab ────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Business Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-zapp-orange" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Business Information
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Business Name"
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); markDirty(); }}
                    iconLeft={<Building2 size={16} />}
                  />
                  <Input
                    label="Address"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); markDirty(); }}
                    iconLeft={<MapPin size={16} />}
                  />
                  <Input
                    label="Contact Phone"
                    value={contactPhone}
                    onChange={(e) => { setContactPhone(e.target.value); markDirty(); }}
                    iconLeft={<Phone size={16} />}
                  />
                  <Input
                    label="Contact Email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); markDirty(); }}
                    iconLeft={<Mail size={16} />}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment & Delivery Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-zapp-orange" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Payment & Delivery
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Select
                      label="Payment Deadline"
                      options={[
                        { value: '24', label: '24 hours' },
                        { value: '48', label: '48 hours (default)' },
                        { value: '72', label: '72 hours' },
                        { value: '96', label: '96 hours' },
                      ]}
                      value={paymentDeadline}
                      onChange={(e) => { setPaymentDeadline(e.target.value); markDirty(); }}
                      helperText="Time allowed for payment after billing is issued"
                    />
                  </div>

                  {/* Toggle for delivery block */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        Block delivery after deadline
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Automatically block future deliveries when payment deadline is exceeded
                      </p>
                    </div>
                    <button
                      onClick={() => { setDeliveryBlocked(!deliveryBlocked); markDirty(); }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zapp-orange focus-visible:ring-offset-2 ${
                        deliveryBlocked ? 'bg-zapp-orange' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={deliveryBlocked}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          deliveryBlocked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveGeneral}
                loading={generalSaving}
                disabled={!generalDirty}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* ── User Management Tab ─────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Demo Mode</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  User management is in read-only demo mode. The users below are pre-configured
                  demo accounts. Full user management with invitations and role assignment is
                  coming in a future release.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat
                icon={<Users size={18} />}
                label="Total Users"
                value={demoUsers.length}
              />
              <Stat
                icon={<ShieldCheck size={18} />}
                label="Admin Users"
                value={demoUsers.filter((u) => u.role === 'owner' || u.role === 'operations_manager').length}
              />
              <Stat
                icon={<Building2 size={18} />}
                label="Plant-Level"
                value={demoUsers.filter((u) => !!u.plantId).length}
              />
              <Stat
                icon={<CheckCircle size={18} />}
                label="Active"
                value={demoUsers.length}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <div className="relative group">
                <Button
                  iconLeft={<Lock size={16} />}
                  variant="secondary"
                  disabled
                >
                  Add User
                </Button>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Coming soon
                  <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-gray-900 transform rotate-45" />
                </div>
              </div>
            </div>

            {/* Users Table */}
            <Table<DemoUserRow>
              columns={userColumns}
              data={userRows}
              keyExtractor={(row) => row.id}
              emptyMessage="No users found."
            />
          </div>
        )}

        {/* ── System Tab ──────────────────────────────────────────── */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {/* Application Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info size={18} className="text-zapp-orange" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Application Information
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Application</p>
                    <p className="text-sm font-semibold text-gray-900">ZAPP Donuts ERP</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Version</p>
                    <p className="text-sm font-semibold text-gray-900">v{APP_VERSION}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Build Date</p>
                    <p className="text-sm font-semibold text-gray-900">{BUILD_DATE}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Environment</p>
                    <Badge variant="warning" size="sm">Development</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Framework</p>
                    <p className="text-sm font-semibold text-gray-900">React + TypeScript + Vite</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">State Management</p>
                    <p className="text-sm font-semibold text-gray-900">Zustand</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Server size={18} className="text-zapp-orange" />
                    <h3 className="text-base font-semibold text-gray-900">
                      API Status
                    </h3>
                  </div>
                  <Badge variant="success" dot size="sm">All Systems Operational</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {apiServices.map((svc) => (
                    <div
                      key={svc.name}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-700">{svc.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">{svc.latency}</span>
                        <Badge variant="success" size="sm">Operational</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-zapp-orange" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Data Management
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex-1 mr-4">
                    <h4 className="text-sm font-medium text-red-800">Reset Mock Data</h4>
                    <p className="text-xs text-red-600 mt-0.5">
                      This will reload the application and restore all data to its initial demo state.
                      Any changes you made during this session will be lost.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    iconLeft={<RefreshCw size={14} />}
                    onClick={handleResetData}
                    loading={resetting}
                  >
                    Reset Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}
