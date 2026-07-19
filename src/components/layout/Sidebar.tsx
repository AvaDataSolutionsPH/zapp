import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Store,
  Users,
  Truck,
  Package,
  ClipboardList,
  ClipboardCheck,
  Brain,
  CreditCard,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Trophy,
  Map,
  QrCode,
  Croissant,
  Settings,
  BookOpen,
  Boxes,
  UserPlus,
  ChevronDown,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useStore } from '@/store/useStore';
import type { UserRole } from '@/types';

// ── Navigation item definition ─────────────────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  allowedRoles: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = [
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

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ALL_ROLES,
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Applications',
        path: '/applications',
        icon: FileText,
        allowedRoles: ['owner', 'operations_manager'],
      },
      {
        // PD sees the website applicants under its own channel (scoped in
        // ApplicationsPage) and can approve the franchisees under it. An SPD
        // sees only its own-referral applications and can fill the PD/SD
        // evaluation fields, but cannot approve (see lib/applicationMonitoring).
        // The Area Supervisor uses the same "New Applications" label as the PD
        // (boss request) — it points to the same scoped page; only the wording
        // matched so the AS isn't confused by a different name for the same thing.
        label: 'New Applications',
        path: '/applications',
        icon: FileText,
        allowedRoles: ['partner_distributor', 'sub_partner_distributor', 'area_manager'],
      },
      {
        label: 'Stores',
        path: '/stores-management',
        icon: Store,
        allowedRoles: [
          'owner',
          'operations_manager',
          'plant_manager',
          'partner_distributor',
          'sub_partner_distributor',
          'area_manager',
        ],
      },
      {
        label: 'Franchisees',
        path: '/franchisees',
        icon: Users,
        allowedRoles: ['owner', 'partner_distributor'],
      },
      {
        label: 'Distributors',
        path: '/distributors',
        icon: Truck,
        allowedRoles: ['owner'],
      },
      {
        label: 'Area Supervisors',
        path: '/area-managers',
        icon: ClipboardList,
        allowedRoles: ['owner'],
      },
      {
        label: 'New Account',
        path: '/accounts/new',
        icon: UserPlus,
        allowedRoles: ['owner', 'operations_manager', 'partner_distributor'],
      },
      {
        label: 'Plants',
        path: '/plants',
        icon: Boxes,
        allowedRoles: ['owner'],
      },
      {
        label: 'Deliveries',
        path: '/deliveries',
        icon: Package,
        allowedRoles: [
          'owner',
          'operations_manager',
          'plant_manager',
          'partner_distributor',
          'franchisee_distributor',
          'franchisee_direct',
          'area_manager',
        ],
      },
      {
        label: 'Beginning Inventory',
        path: '/beginning-inventory',
        icon: BookOpen,
        allowedRoles: [
          'owner',
          'operations_manager',
          'plant_manager',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
      {
        label: 'Ending Inventory',
        path: '/ending-inventory',
        icon: ClipboardList,
        allowedRoles: [
          'owner',
          'operations_manager',
          'plant_manager',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
      {
        label: 'AI Validation',
        path: '/ai-validation',
        icon: Brain,
        allowedRoles: ['owner', 'operations_manager', 'plant_manager'],
      },
      {
        label: 'Inventory Reviews',
        path: '/inventory-reviews',
        icon: ClipboardCheck,
        allowedRoles: [
          'owner',
          'operations_manager',
          'partner_distributor',
          'area_manager',
        ],
      },
      {
        label: 'Packaging',
        path: '/packaging',
        icon: ShoppingBag,
        allowedRoles: [
          'owner',
          'plant_manager',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
      {
        label: 'Special Orders',
        path: '/special-orders',
        icon: Package,
        // Not part of the billing user's work (boss). Special orders surface for
        // the area supervisor / PD / SPD (+ owner/ops/plant/franchisees who
        // create & fulfil them), NOT billing_user.
        allowedRoles: [
          'owner',
          'operations_manager',
          'plant_manager',
          'area_manager',
          'partner_distributor',
          'sub_partner_distributor',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Billing',
        path: '/billing',
        icon: CreditCard,
        allowedRoles: [
          'owner',
          'plant_manager',
          'billing_user',
          'partner_distributor',
          'sub_partner_distributor',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
      {
        label: 'Payments',
        path: '/payments',
        icon: DollarSign,
        allowedRoles: [
          'owner',
          'operations_manager',
          'billing_user',
          'partner_distributor',
          'sub_partner_distributor',
          'franchisee_distributor',
          'franchisee_direct',
        ],
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        label: 'Forecasting',
        path: '/forecasting',
        icon: TrendingUp,
        allowedRoles: ['owner', 'operations_manager', 'forecaster'],
      },
      {
        label: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        allowedRoles: [
          'owner',
          'operations_manager',
          'forecaster',
          'partner_distributor',
          'sub_partner_distributor',
          'area_manager',
        ],
      },
      {
        label: 'Leaderboards',
        path: '/leaderboards',
        icon: Trophy,
        allowedRoles: ['owner', 'operations_manager'],
      },
      {
        label: 'Geo Heatmap',
        path: '/geo-heatmap',
        icon: Map,
        allowedRoles: ['owner', 'operations_manager'],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        label: 'Referral Codes',
        path: '/referral-codes',
        icon: QrCode,
        allowedRoles: ['owner'],
      },
      {
        // Prices and product names are business data, not code — the ops
        // manager maintains them without a developer. Same roles the RLS
        // already allows to write reference tables (003's ref_write).
        label: 'Donut Catalog',
        path: '/donut-catalog',
        icon: Croissant,
        allowedRoles: ['owner', 'operations_manager'],
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        allowedRoles: ['owner'],
      },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, sidebarOpen, toggleSidebar } = useStore();
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const userRole = currentUser?.role;

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => userRole && item.allowedRoles.includes(userRole),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-64 bg-sidebar flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none"
          >
            <img src="/Logo.jpg" alt="ZAPP Donuts" className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight tracking-tight">
                ZAPP Donuts
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-text">
                ERP System
              </span>
            </div>
          </button>

          {/* Mobile close button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1 rounded text-sidebar-text hover:text-white hover:bg-sidebar-hover cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredSections.map((section) => {
            const isCollapsed = collapsedSections[section.title] ?? false;

            return (
              <div key={section.title} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text/60 hover:text-sidebar-text cursor-pointer bg-transparent border-none"
                >
                  <span>{section.title}</span>
                  {isCollapsed ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>

                {/* Section items */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive =
                        location.pathname === item.path ||
                        location.pathname.startsWith(item.path + '/');
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            // Close sidebar on mobile after navigation
                            if (window.innerWidth < 1024) {
                              toggleSidebar();
                            }
                          }}
                          className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer border-none',
                            isActive
                              ? 'bg-sidebar-active text-sidebar-text-active'
                              : 'bg-transparent text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                          )}
                        >
                          <Icon
                            size={18}
                            className={clsx(
                              'shrink-0',
                              isActive
                                ? 'text-white'
                                : 'text-sidebar-text',
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info footer */}
        {currentUser && (
          <div className="border-t border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {currentUser.name}
                </p>
                <p className="text-xs text-sidebar-text truncate">
                  {currentUser.role.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
