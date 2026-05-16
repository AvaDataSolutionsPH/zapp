// ============================================================
// ZAPP Donuts ERP - Main Dashboard Router
// ============================================================

import { useStore } from '@/store/useStore';
import { OwnerDashboard } from './OwnerDashboard';
import { OperationsDashboard } from './OperationsDashboard';
import { ForecasterDashboard } from './ForecasterDashboard';
import { PlantManagerDashboard } from './PlantManagerDashboard';
import { BillingDashboard } from './BillingDashboard';
import { DistributorDashboard } from './DistributorDashboard';
import { SubPartnerDashboard } from './SubPartnerDashboard';
import { FranchiseeDashboard } from './FranchiseeDashboard';
import { AreaManagerDashboard } from './AreaManagerDashboard';

export default function DashboardPage() {
  const currentUser = useStore((s) => s.currentUser);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please log in to view your dashboard.</p>
      </div>
    );
  }

  switch (currentUser.role) {
    case 'owner':
      return <OwnerDashboard />;
    case 'operations_manager':
      return <OperationsDashboard />;
    case 'forecaster':
      return <ForecasterDashboard />;
    case 'plant_manager':
      return <PlantManagerDashboard />;
    case 'billing_user':
      return <BillingDashboard />;
    case 'partner_distributor':
      return <DistributorDashboard />;
    case 'sub_partner_distributor':
      return <SubPartnerDashboard />;
    case 'franchisee_distributor':
    case 'franchisee_direct':
      return <FranchiseeDashboard />;
    case 'area_manager':
      return <AreaManagerDashboard />;
    default:
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Dashboard not available for your role.</p>
        </div>
      );
  }
}
