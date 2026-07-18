import { useMemo, useState } from 'react';
import {
  Factory,
  MapPin,
  Store as StoreIcon,
  Building2,
  Truck,
  Plus,
  Pencil,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Stat,
} from '@/components/ui';
import PlantFormModal from './PlantFormModal';
import type { Plant } from '@/types';

export default function PlantsPage() {
  const { plants, stores, distributors, deliveries, currentUser } = useStore();

  // Plants are reference data — only the Admin (Owner) may add or correct them.
  const canManage = currentUser?.role === 'owner';
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plant | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Plant) => { setEditing(p); setFormOpen(true); };

  const today = new Date().toISOString().slice(0, 10);

  const plantCards = useMemo(() =>
    plants.map((plant) => {
      const plantStores = stores.filter((s) => s.plantId === plant.id);
      const plantDistributors = distributors.filter((d) => d.plantId === plant.id);
      const todayDeliveries = deliveries.filter(
        (d) => d.plantId === plant.id && d.date === today,
      );
      const activeStores = plantStores.filter((s) => s.status === 'active').length;
      const pendingStores = plantStores.filter((s) => s.status === 'pending').length;

      return {
        ...plant,
        storeCount: plantStores.length,
        activeStores,
        pendingStores,
        distributorCount: plantDistributors.length,
        todayDeliveries: todayDeliveries.length,
        distributors: plantDistributors,
      };
    }),
  [plants, stores, distributors, deliveries, today]);

  const totalStores = plantCards.reduce((s, p) => s + p.storeCount, 0);
  const totalDistributors = plantCards.reduce((s, p) => s + p.distributorCount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plants</h1>
          <p className="text-sm text-gray-500 mt-1">Production facilities and their network overview</p>
        </div>
        {canManage && (
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            New Plant
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Factory size={18} />} label="Total Plants" value={plants.length} />
        <Stat icon={<StoreIcon size={18} />} label="Total Stores" value={totalStores} />
        <Stat icon={<Building2 size={18} />} label="Total Distributors" value={totalDistributors} />
      </div>

      {/* Plant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {plantCards.map((plant) => (
          <Card key={plant.id} hover>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{plant.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={14} /> {plant.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={<Pencil size={13} />}
                      onClick={() => openEdit(plant)}
                    >
                      Edit
                    </Button>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-zapp-orange">
                    <Factory size={20} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Region</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{plant.region}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Code</p>
                  <p className="text-sm font-mono font-bold text-gray-900 mt-1">{plant.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <StoreIcon size={14} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{plant.storeCount}</p>
                  <p className="text-xs text-gray-500">Stores</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <Building2 size={14} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{plant.distributorCount}</p>
                  <p className="text-xs text-gray-500">Distributors</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <Truck size={14} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{plant.todayDeliveries}</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
              </div>

              {/* Store Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                <Badge variant="success" size="sm" dot>{plant.activeStores} Active</Badge>
                {plant.pendingStores > 0 && (
                  <Badge variant="warning" size="sm" dot>{plant.pendingStores} Pending</Badge>
                )}
              </div>

              {/* Distributors List */}
              {plant.distributors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Distributors</p>
                  <div className="space-y-1.5">
                    {plant.distributors.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{d.name}</span>
                        <Badge
                          variant={d.status === 'active' ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <PlantFormModal
        open={formOpen}
        plant={editing}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
