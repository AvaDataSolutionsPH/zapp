import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { LoadingScreen } from '@/components/ui'

// Layouts
import Layout from '@/components/layout/Layout'
import PublicLayout from '@/components/layout/PublicLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// Public Pages
import LandingPage from '@/pages/public/LandingPage'
import StoreDirectoryPage from '@/pages/public/StoreDirectoryPage'
import ApplicationPage from '@/pages/public/ApplicationPage'
import PartnerOnboardingPage from '@/pages/public/PartnerOnboardingPage'
import AwaitingVerificationPage from '@/pages/public/AwaitingVerificationPage'
import AccountVerificationPage from '@/pages/auth/AccountVerificationPage'
import { isAccountLocked } from '@/lib/accountGate'
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
import FranchiseeOnboardingPage from '@/pages/entities/FranchiseeOnboardingPage'
import NewAccountPage from '@/pages/entities/NewAccountPage'

// Deliveries
import DeliveriesPage from '@/pages/deliveries/DeliveriesPage'

// Inventory
import BeginningInventoryPage from '@/pages/inventory/BeginningInventoryPage'
import EndingInventoryPage from '@/pages/inventory/EndingInventoryPage'
import AIValidationPage from '@/pages/inventory/AIValidationPage'
import InventoryReviewsPage from '@/pages/inventory/InventoryReviewsPage'

// Billing & Payments
import BillingPage from '@/pages/billing/BillingPage'
import BillingStatementPage from '@/pages/billing/BillingStatementPage'
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
import SkuCatalogPage from '@/pages/admin/SkuCatalogPage'
import PackagingCatalogPage from '@/pages/admin/PackagingCatalogPage'
import SettingsPage from '@/pages/admin/SettingsPage'

function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const authLoading = useStore((s) => s.authLoading)
  const currentUser = useStore((s) => s.currentUser)
  const pendingApplication = useStore((s) => s.pendingApplication)
  const restoreSession = useStore((s) => s.restoreSession)

  // Hydrate currentUser from any persisted Supabase session on first mount, and
  // keep the local store in sync if the session changes in another tab.
  useEffect(() => {
    void restoreSession()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useStore.setState({ currentUser: null, isAuthenticated: false, pendingApplication: null, authLoading: false })
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void restoreSession()
      }
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [restoreSession])

  if (authLoading) {
    return <LoadingScreen />
  }

  // A self-service onboarding applicant (valid login, application pending, not
  // yet activated) has no ERP access — show the awaiting-verification screen
  // instead of the app.
  if (pendingApplication) {
    return <AwaitingVerificationPage />
  }

  // A franchisee whose account has not been verified has NO access to any
  // module. This deliberately replaces the whole router rather than guarding
  // each route: a per-route check leaves every unguarded path (and anything
  // added later) reachable by typing the URL. Nothing renders but the
  // verification screen until the account is `active`.
  if (isAccountLocked(currentUser)) {
    return <AccountVerificationPage />
  }

  return (
    <Routes>
      {/* Landing page: standalone (own dark nav + footer, no PublicLayout chrome) */}
      <Route path="/" element={<LandingPage />} />

      {/* Dev preview of the boot loading splash (always renders it) */}
      <Route path="/loading-preview" element={<LoadingScreen />} />

      {/* Self-service Partner Onboarding — standalone full-screen wizard */}
      <Route path="/onboarding" element={<PartnerOnboardingPage />} />

      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/stores" element={<StoreDirectoryPage />} />
        <Route path="/apply" element={<ApplicationPage />} />
        <Route path="/referral/:code" element={<ReferralEntryPage />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />

      {/* Billing statement — standalone printable page (outside the dashboard
          Layout for a clean Print → PDF), gated to billing roles. */}
      <Route
        path="/billing/statement"
        element={
          <ProtectedRoute allowedRoles={['billing_user', 'owner', 'operations_manager']}>
            <BillingStatementPage />
          </ProtectedRoute>
        }
      />

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
        <Route path="/franchisees/new" element={<FranchiseeOnboardingPage />} />
        <Route path="/accounts/new" element={<NewAccountPage />} />
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
        <Route path="/donut-catalog" element={<SkuCatalogPage />} />
        <Route path="/packaging-catalog" element={<PackagingCatalogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
