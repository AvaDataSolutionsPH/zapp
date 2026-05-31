import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '@/store/useStore';
import type { UserRole } from '@/types';

// ── Route-to-title map ─────────────────────────────────────────

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/applications': 'Applications',
  '/stores-management': 'Stores',
  '/franchisees': 'Franchisees',
  '/distributors': 'Distributors',
  '/area-managers': 'Area Supervisors',
  '/plants': 'Plants',
  '/deliveries': 'Deliveries',
  '/beginning-inventory': 'Beginning Inventory',
  '/ending-inventory': 'Ending Inventory',
  '/ai-validation': 'AI Validation',
  '/billing': 'Billing',
  '/payments': 'Payments',
  '/packaging': 'Packaging',
  '/forecasting': 'Forecasting',
  '/analytics': 'Analytics',
  '/leaderboards': 'Leaderboards',
  '/geo-heatmap': 'Geo Heatmap',
  '/referral-codes': 'Referral Codes',
  '/settings': 'Settings',
};

const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  operations_manager: 'Operations Supervisor',
  forecaster: 'Forecaster',
  plant_manager: 'Plant Manager',
  billing_user: 'Billing User',
  partner_distributor: 'Partner Distributor',
  sub_partner_distributor: 'Sub-Partner Distributor',
  franchisee_distributor: 'Franchisee (Distributor)',
  franchisee_direct: 'Franchisee (Direct)',
  area_manager: 'Area Supervisor',
};

const allRoles: UserRole[] = [
  'owner',
  'operations_manager',
  'forecaster',
  'plant_manager',
  'billing_user',
  'partner_distributor',
  'sub_partner_distributor',
  'franchisee_distributor',
  'franchisee_direct',
  'area_manager',
];

// ── Helper: derive breadcrumbs from pathname ──────────────────

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [];
  const segments = pathname.split('/').filter(Boolean);
  let accumulated = '';

  for (const seg of segments) {
    accumulated += `/${seg}`;
    const title =
      routeTitles[accumulated] ??
      seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label: title, path: accumulated });
  }

  return crumbs;
}

// ── Component ──────────────────────────────────────────────────

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, notifications, toggleSidebar, switchRole, logout } =
    useStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(e.target as Node)
      ) {
        setRoleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pageTitle =
    routeTitles[location.pathname] ??
    location.pathname
      .split('/')
      .pop()
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ??
    'Page';

  const breadcrumbs = getBreadcrumbs(location.pathname);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            <Menu size={20} />
          </button>

          <div>
            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
              <button
                onClick={() => navigate('/dashboard')}
                className="hover:text-gray-600 cursor-pointer bg-transparent border-none text-xs text-gray-400 p-0"
              >
                Home
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1.5">
                  <span>/</span>
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-gray-600 font-medium">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate(crumb.path)}
                      className="hover:text-gray-600 cursor-pointer bg-transparent border-none text-xs text-gray-400 p-0"
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              ))}
            </nav>

            {/* Page title */}
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
              {pageTitle}
            </h2>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer">
            <Search size={18} />
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-zapp-red text-white text-[10px] font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Role switcher (demo) */}
          <div ref={roleMenuRef} className="relative hidden sm:block">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors',
                'border-zapp-orange/30 bg-zapp-cream text-zapp-brown hover:bg-zapp-orange/10',
              )}
            >
              <Shield size={14} className="text-zapp-orange" />
              <span className="max-w-[120px] truncate">
                {currentUser ? roleLabels[currentUser.role] : 'Select Role'}
              </span>
              <ChevronDown size={12} />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Switch Demo Role
                  </p>
                </div>
                {allRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      switchRole(role);
                      setRoleMenuOpen(false);
                      navigate('/dashboard');
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm cursor-pointer bg-transparent border-none transition-colors',
                      currentUser?.role === role
                        ? 'bg-zapp-cream text-zapp-brown font-medium'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    {roleLabels[role]}
                    {currentUser?.role === role && (
                      <span className="ml-2 text-xs text-zapp-orange">
                        (active)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              {currentUser ? (
                <>
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight">
                      {roleLabels[currentUser.role]}
                    </p>
                  </div>
                  <ChevronDown size={14} className="text-gray-400 hidden md:block" />
                </>
              ) : (
                <User size={20} className="text-gray-400" />
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                <button
                  onClick={() => {
                    navigate('/settings');
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer bg-transparent border-none"
                >
                  <User size={16} />
                  Profile
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer bg-transparent border-none"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
