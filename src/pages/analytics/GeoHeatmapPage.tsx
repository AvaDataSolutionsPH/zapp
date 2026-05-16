// ============================================================
// ZAPP Donuts ERP - Geo Heatmap / Map-Based Analytics
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  MapPin,
  Store as StoreIcon,
  FileText,
  Filter,
  Eye,
  Layers,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet default icon — leaflet ships a private `_getIconUrl` that
// breaks bundler asset resolution; deleting it forces fallback to the
// mergeOptions URLs below. The `any` cast is intentional because the
// property isn't part of Leaflet's public TypeScript surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Custom Icons ─────────────────────────────────────────────

const storeIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const applicationIcon = new L.DivIcon({
  html: `<div style="background:#EF4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

// ── Helpers ──────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  `P${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const getCircleRadius = (sales: number, maxSales: number) => {
  const minR = 6;
  const maxR = 30;
  if (maxSales === 0) return minR;
  return minR + ((sales / maxSales) * (maxR - minR));
};

const getCircleColor = (sales: number, maxSales: number) => {
  const ratio = maxSales > 0 ? sales / maxSales : 0;
  if (ratio >= 0.75) return '#FF6B00';
  if (ratio >= 0.5) return '#FFD700';
  if (ratio >= 0.25) return '#22C55E';
  return '#3B82F6';
};

type StatusFilter = 'all' | 'stores' | 'applications';

// ── Main Component ──────────────────────────────────────────

export default function GeoHeatmapPage() {
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const stores = useStore((s) => s.stores);
  const applications = useStore((s) => s.applications);
  const salesMetrics = useStore((s) => s.salesMetrics);
  const plants = useStore((s) => s.plants);
  const distributors = useStore((s) => s.distributors);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // ── Filter options ────────────────────────────────────────────

  const areaOptions = useMemo(() => {
    const areas = [...new Set(stores.map((s) => s.area))].sort();
    return [{ value: '', label: 'All Areas' }, ...areas.map((a) => ({ value: a, label: a }))];
  }, [stores]);

  const plantOptions = useMemo(
    () => [
      { value: '', label: 'All Plants' },
      ...plants.map((p) => ({ value: p.id, label: p.name })),
    ],
    [plants],
  );

  const statusOptions = [
    { value: 'all', label: 'Stores & Applications' },
    { value: 'stores', label: 'Stores Only' },
    { value: 'applications', label: 'Applications Only' },
  ];

  // ── Filtered stores ───────────────────────────────────────────

  const filteredStores = useMemo(() => {
    let result = stores.filter((s) => s.lat && s.lng);
    if (areaFilter) result = result.filter((s) => s.area === areaFilter);
    if (plantFilter) result = result.filter((s) => s.plantId === plantFilter);
    return result;
  }, [stores, areaFilter, plantFilter]);

  // ── Filtered applications ─────────────────────────────────────

  const filteredApplications = useMemo(() => {
    let result = applications.filter((a) => a.lat && a.lng && a.status === 'pending');
    if (plantFilter) result = result.filter((a) => a.assignedPlantId === plantFilter);
    return result;
  }, [applications, plantFilter]);

  // ── Sales by store (for circle sizing) ────────────────────────

  const salesByStore = useMemo(() => {
    let metrics = [...salesMetrics];
    if (dateFrom) metrics = metrics.filter((m) => m.date >= dateFrom);
    if (dateTo) metrics = metrics.filter((m) => m.date <= dateTo);

    const byStore = new Map<string, number>();
    metrics.forEach((m) => {
      byStore.set(m.storeId, (byStore.get(m.storeId) ?? 0) + m.srpSales);
    });
    return byStore;
  }, [salesMetrics, dateFrom, dateTo]);

  const maxSales = useMemo(
    () => Math.max(...Array.from(salesByStore.values()), 1),
    [salesByStore],
  );

  // ── Summary counts ────────────────────────────────────────────

  const summary = useMemo(() => {
    const activeStores = filteredStores.filter((s) => s.status === 'active').length;
    const pendingStores = filteredStores.filter((s) => s.status === 'pending').length;
    const inactiveStores = filteredStores.filter((s) => s.status === 'inactive').length;
    const pendingApps = filteredApplications.length;
    return { activeStores, pendingStores, inactiveStores, pendingApps, total: filteredStores.length };
  }, [filteredStores, filteredApplications]);

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <MapPin size={28} className="text-[#FF6B00]" />
          <h1 className="text-2xl font-bold text-gray-900">Geographic Heatmap</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Interactive map showing store locations, applications, and sales density
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter size={16} />
            <span className="font-medium">Filters:</span>
          </div>
          <Select
            label="Show"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-52"
          />
          <Select
            label="Area"
            options={areaOptions}
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-44"
          />
          <Select
            label="Plant"
            options={plantOptions}
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="w-44"
          />
          <Input
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <Input
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          icon={<StoreIcon size={20} />}
          label="Active Stores"
          value={summary.activeStores}
        />
        <Stat
          icon={<Eye size={20} />}
          label="Pending Stores"
          value={summary.pendingStores}
        />
        <Stat
          icon={<FileText size={20} />}
          label="Pending Applications"
          value={summary.pendingApps}
        />
        <Stat
          icon={<Layers size={20} />}
          label="Total Locations"
          value={summary.total + summary.pendingApps}
        />
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div style={{ height: 560 }}>
            <MapContainer
              center={[12.8797, 121.7740]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Store Markers with Sales Circles */}
              {(statusFilter === 'all' || statusFilter === 'stores') &&
                filteredStores.map((store) => {
                  const sales = salesByStore.get(store.id) ?? 0;
                  const distributor = distributors.find((d) => d.id === store.distributorId);
                  const plant = plants.find((p) => p.id === store.plantId);
                  const radius = getCircleRadius(sales, maxSales);
                  const color = getCircleColor(sales, maxSales);

                  return (
                    <React.Fragment key={store.id}>
                      {/* Sales density circle */}
                      {sales > 0 && (
                        <CircleMarker
                          center={[store.lat, store.lng]}
                          radius={radius}
                          pathOptions={{
                            fillColor: color,
                            color: color,
                            weight: 1,
                            opacity: 0.7,
                            fillOpacity: 0.25,
                          }}
                        >
                          <Popup>
                            <div className="text-xs">
                              <strong>{store.name}</strong>
                              <br />
                              Total SRP: {fmtCurrency(sales)}
                            </div>
                          </Popup>
                        </CircleMarker>
                      )}

                      {/* Store marker */}
                      <Marker position={[store.lat, store.lng]} icon={storeIcon}>
                        <Popup>
                          <div className="min-w-[220px]">
                            <h4 className="font-bold text-sm mb-1">{store.name}</h4>
                            <div className="text-xs space-y-1 text-gray-600">
                              <p><strong>Owner:</strong> {store.ownerName}</p>
                              <p><strong>Address:</strong> {store.address}</p>
                              <p><strong>Area:</strong> {store.area}, {store.province}</p>
                              <p><strong>Plant:</strong> {plant?.name ?? 'N/A'}</p>
                              {distributor && (
                                <p><strong>Distributor:</strong> {distributor.name}</p>
                              )}
                              <p>
                                <strong>Status:</strong>{' '}
                                <span
                                  className={
                                    store.status === 'active'
                                      ? 'text-green-600'
                                      : store.status === 'pending'
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                  }
                                >
                                  {store.status.charAt(0).toUpperCase() + store.status.slice(1)}
                                </span>
                              </p>
                              <p><strong>Type:</strong> {store.franchiseType === 'distributor' ? 'Distributor' : 'Direct'}</p>
                              {sales > 0 && (
                                <p className="mt-1 pt-1 border-t border-gray-200">
                                  <strong>Total SRP Sales:</strong>{' '}
                                  <span className="text-[#FF6B00] font-bold">{fmtCurrency(sales)}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                })}

              {/* Application Markers */}
              {(statusFilter === 'all' || statusFilter === 'applications') &&
                filteredApplications.map((app) => {
                  const plant = plants.find((p) => p.id === app.assignedPlantId);
                  return (
                    <Marker key={app.id} position={[app.lat, app.lng]} icon={applicationIcon}>
                      <Popup>
                        <div className="min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                            <h4 className="font-bold text-sm">Application</h4>
                          </div>
                          <div className="text-xs space-y-1 text-gray-600">
                            <p><strong>Applicant:</strong> {app.fullName}</p>
                            <p><strong>Store Name:</strong> {app.storeName}</p>
                            <p><strong>Address:</strong> {app.address}</p>
                            <p><strong>Plant:</strong> {plant?.name ?? 'N/A'}</p>
                            <p><strong>Status:</strong>{' '}
                              <span className="text-yellow-600">Pending</span>
                            </p>
                            <p><strong>Submitted:</strong>{' '}
                              {new Date(app.submittedAt).toLocaleDateString('en-PH')}
                            </p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 text-sm">Map Legend</h3>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-xs">
            <div className="flex items-center gap-2">
              <img
                src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png"
                alt="store"
                className="w-4 h-6"
              />
              <span className="text-gray-600">Store Location</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow" />
              <span className="text-gray-600">Pending Application</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#FF6B00]/25 border border-[#FF6B00]" />
              <span className="text-gray-600">High Sales (&gt;75%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#FFD700]/25 border border-[#FFD700]" />
              <span className="text-gray-600">Medium-High (50-75%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#22C55E]/25 border border-[#22C55E]" />
              <span className="text-gray-600">Medium (25-50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#3B82F6]/25 border border-[#3B82F6]" />
              <span className="text-gray-600">Low (&lt;25%)</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              Circle size = proportional to total SRP sales
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStores
          .filter((s) => s.status === 'active')
          .sort((a, b) => (salesByStore.get(b.id) ?? 0) - (salesByStore.get(a.id) ?? 0))
          .slice(0, 6)
          .map((store) => {
            const sales = salesByStore.get(store.id) ?? 0;
            const plant = plants.find((p) => p.id === store.plantId);
            return (
              <Card key={store.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{store.name}</h4>
                      <p className="text-xs text-gray-500">{store.area}, {store.province}</p>
                    </div>
                    <Badge
                      variant={store.status === 'active' ? 'success' : store.status === 'pending' ? 'warning' : 'neutral'}
                    >
                      {store.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <span className="text-gray-500">Plant</span>
                      <p className="font-medium">{plant?.name ?? 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Type</span>
                      <p className="font-medium capitalize">{store.franchiseType}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Total SRP Sales</span>
                      <p className="font-bold text-[#FF6B00]">{fmtCurrency(sales)}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}

