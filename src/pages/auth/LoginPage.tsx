import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { UserRole } from '@/types';

// ── Demo role config ───────────────────────────────────────────

interface DemoRole {
  role: UserRole;
  label: string;
  color: string;
}

const demoRoles: DemoRole[] = [
  { role: 'owner', label: 'Owner', color: 'bg-amber-500' },
  { role: 'operations_manager', label: 'Ops Supervisor', color: 'bg-purple-500' },
  { role: 'forecaster', label: 'Forecaster', color: 'bg-blue-500' },
  { role: 'plant_manager', label: 'Plant Manager', color: 'bg-emerald-500' },
  { role: 'billing_user', label: 'Billing User', color: 'bg-red-500' },
  { role: 'partner_distributor', label: 'Partner Distributor', color: 'bg-orange-500' },
  { role: 'franchisee_distributor', label: 'Franchisee (Dist)', color: 'bg-pink-500' },
  { role: 'franchisee_direct', label: 'Franchisee (Direct)', color: 'bg-cyan-500' },
  { role: 'area_manager', label: 'Area Supervisor', color: 'bg-lime-500' },
];

// ── Component ──────────────────────────────────────────────────

// Shared password seeded for all demo accounts (see supabase/seed/01_demo_users.sql).
const DEMO_PASSWORD = '111111';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, demoUsers } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Try a demo account below.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: UserRole) => {
    const user = demoUsers.find((u) => u.role === role);
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const success = await login(user.email, DEMO_PASSWORD);
      if (success) {
        navigate('/dashboard');
      } else {
        setError(
          `Demo login failed. Make sure the seed SQL has been run for ${user.email}.`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zapp-cream via-white to-orange-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/Logo.jpg" alt="ZAPP Donuts" className="h-20 w-20 rounded-2xl object-cover mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-zapp-brown tracking-tight">
            ZAPP Donuts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise Resource Planning System
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@zappdonuts.ph"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/40 focus:border-zapp-orange transition-colors"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/40 focus:border-zapp-orange transition-colors"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zapp-orange text-white text-sm font-semibold hover:bg-zapp-orange-light active:bg-zapp-orange-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Quick Demo Login
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Demo role buttons */}
          <div className="grid grid-cols-3 gap-2">
            {demoRoles.map(({ role, label, color }) => {
              const user = demoUsers.find((u) => u.role === role);
              return (
                <button
                  key={role}
                  onClick={() => { void handleDemoLogin(role); }}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-zapp-orange/40 hover:bg-zapp-cream/50 cursor-pointer bg-white transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  title={user?.name ?? label}
                >
                  <span
                    className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold`}
                  >
                    {label.charAt(0)}
                  </span>
                  <span className="text-[10px] font-medium text-gray-600 group-hover:text-zapp-brown leading-tight">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Demo credentials: use any demo button above or enter a valid demo
          email with any password.
        </p>
      </div>
    </div>
  );
}
