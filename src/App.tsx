import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'

// Layouts
import Layout from '@/components/layout/Layout'
import PublicLayout from '@/components/layout/PublicLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// Public Pages
import LandingPage from '@/pages/public/LandingPage'
import StoreDirectoryPage from '@/pages/public/StoreDirectoryPage'
import ApplicationPage from '@/pages/public/ApplicationPage'
import ReferralEntryPage from '@/pages/public/ReferralEntryPage'

// Auth
import LoginPage from '@/pages/auth/LoginPage'

// Dashboard
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Applications
import ApplicationsPage from '@/pages/applications/ApplicationsPage'
import ApplicationDetailPage from '@/pages/applications/ApplicationDetailPage'

// Stores
import StoresPage from '@/pages/stores/StoresPage'
import StoreDetailPage from '@/pages/stores/StoreDetailPage'

// Entities
import DistributorsPage from '@/pages/entities/DistributorsPage'
import AreaManagersPage from '@/pages/entities/AreaManagersPage'
import PlantsPage from '@/pages/entities/PlantsPage'
import FranchiseesPage from '@/pages/entities/FranchiseesPage'

// Deliveries
import DeliveriesPage from '@/pages/deliveries/DeliveriesPage'

// Inventory
import BeginningInventoryPage from '@/pages/inventory/BeginningInventoryPage'
import EndingInventoryPage from '@/pages/inventory/EndingInventoryPage'
import AIValidationPage from '@/pages/inventory/AIValidationPage'
import InventoryReviewsPage from '@/pages/inventory/InventoryReviewsPage'

// Billing & Payments
import BillingPage from '@/pages/billing/BillingPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'

// Packaging
import PackagingPage from '@/pages/packaging/PackagingPage'

// Special Orders
import SpecialOrdersPage from '@/pages/specialorders/SpecialOrdersPage'

// Forecasting
import ForecastingPage from '@/pages/forecasting/ForecastingPage'

// Analytics
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import LeaderboardPage from '@/pages/analytics/LeaderboardPage'
import GeoHeatmapPage from '@/pages/analytics/GeoHeatmapPage'

// Admin
import ReferralCodesPage from '@/pages/admin/ReferralCodesPage'
import SettingsPage from '@/pages/admin/SettingsPage'

function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const authLoading = useStore((s) => s.authLoading)
  const restoreSession = useStore((s) => s.restoreSession)

  // Hydrate currentUser from any persisted Supabase session on first mount, and
  // keep the local store in sync if the session changes in another tab.
  useEffect(() => {
    void restoreSession()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useStore.setState({ currentUser: null, isAuthenticated: false, authLoading: false })
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void restoreSession()
      }
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [restoreSession])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zapp-cream/30">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/stores" element={<StoreDirectoryPage />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/referral/:code" element={<ReferralEntryPage />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />

      {/* Protected ERP routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Applications */}
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />

        {/* Stores */}
        <Route path="/stores-management" element={<StoresPage />} />
        <Route path="/stores-management/:id" element={<StoreDetailPage />} />

        {/* Entities */}
        <Route path="/franchisees" element={<FranchiseesPage />} />
        <Route path="/distributors" element={<DistributorsPage />} />
        <Route path="/area-managers" element={<AreaManagersPage />} />
        <Route path="/plants" element={<PlantsPage />} />

        {/* Deliveries */}
        <Route path="/deliveries" element={<DeliveriesPage />} />

        {/* Inventory */}
        <Route path="/beginning-inventory" element={<BeginningInventoryPage />} />
        <Route path="/ending-inventory" element={<EndingInventoryPage />} />
        <Route path="/ai-validation" element={<AIValidationPage />} />
        <Route path="/inventory-reviews" element={<InventoryReviewsPage />} />

        {/* Financial */}
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/packaging" element={<PackagingPage />} />
        <Route path="/special-orders" element={<SpecialOrdersPage />} />

        {/* Forecasting */}
        <Route path="/forecasting" element={<ForecastingPage />} />

        {/* Analytics */}
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/leaderboards" element={<LeaderboardPage />} />
        <Route path="/geo-heatmap" element={<GeoHeatmapPage />} />

        {/* Admin */}
        <Route path="/referral-codes" element={<ReferralCodesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
