// ============================================================
// ZAPP Donuts ERP — New Account (login) creation
// ============================================================
//
// Admin-driven account creation for a Partner Distributor (PD), Sub-Partner
// Distributor (SPD), or Area Supervisor (AS). Creates the entity record + a
// login in one step and reveals a TEMPORARY PASSWORD for the admin to relay
// (no email — see docs). owner/ops may create any role. A PD onboards its own
// Franchisees and Sub-Partners (AS is HQ's job) — picking "Franchisee" routes
// to the full /franchisees/new wizard (store + shop code + map + ID) since a
// franchisee needs a Store, which this simple login form does not create.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, User, Mail, Phone, Handshake, Users, ClipboardList,
  Copy, CheckCircle2, ArrowLeft, KeyRound, AlertCircle, Store, ArrowRight,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardFooter, Input, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import type { NewAccountRole } from '@/store/useStore';

interface CreatedAccount {
  name: string;
  email: string;
  tempPassword: string;
  role: NewAccountRole;
}

const ROLE_LABEL: Record<NewAccountRole, string> = {
  partner_distributor: 'Partner Distributor',
  sub_partner_distributor: 'Sub-Partner Distributor',
  area_manager: 'Area Supervisor',
};

// The dropdown offers 'franchisee' as a shortcut that ROUTES to the full
// franchisee onboarding wizard (store + shop code + map pin + valid ID) — it is
// NOT a createPartnerAccount role (only PD/SPD/AS are). Franchisees need a Store,
// so we reuse the tested /franchisees/new flow instead of duplicating it here.
type DropdownRole = NewAccountRole | 'franchisee';

export default function NewAccountPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentUser, plants, distributors, createPartnerAccount } = useStore();

  const isAdmin = currentUser?.role === 'owner' || currentUser?.role === 'operations_manager';
  const isPD = currentUser?.role === 'partner_distributor';
  const canUse = isAdmin || isPD;

  useEffect(() => {
    if (currentUser && !canUse) navigate('/dashboard', { replace: true });
  }, [currentUser, canUse, navigate]);

  // A PD onboards Franchisees and Sub-Partners (Area Supervisors are created by
  // HQ, not the PD). Franchisee routes to the full onboarding wizard.
  const roleOptions: SelectOption[] = useMemo(() => {
    const opts: { value: DropdownRole; label: string }[] = isPD
      ? [
          { value: 'franchisee', label: 'Franchisee' },
          { value: 'sub_partner_distributor', label: 'Sub-Partner Distributor' },
        ]
      : [
          { value: 'partner_distributor', label: 'Partner Distributor' },
          { value: 'sub_partner_distributor', label: 'Sub-Partner Distributor' },
          { value: 'area_manager', label: 'Area Supervisor' },
        ];
    return opts;
  }, [isPD]);

  const [role, setRole] = useState<DropdownRole>(
    isPD ? 'sub_partner_distributor' : 'partner_distributor',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [parentDistributorId, setParentDistributorId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  const plantOptions: SelectOption[] = [
    { value: '', label: 'Select Plant' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const parentOptions: SelectOption[] = [
    { value: '', label: 'Select Parent Distributor' },
    ...distributors.map((d) => ({ value: d.id, label: d.name })),
  ];

  // owner/ops pick plant + (for SPD) the parent PD. A PD uses its own scope, so
  // those inputs are hidden for them.
  const showPlant = isAdmin;
  const showParent = isAdmin && role === 'sub_partner_distributor';

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!phone.trim()) e.phone = 'Phone is required.';
    if (showPlant && !plantId) e.plantId = 'Plant is required.';
    if (showParent && !parentDistributorId) e.parentDistributorId = 'Parent Distributor is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    // Franchisee has its own onboarding wizard (store + shop code + map + ID).
    if (role === 'franchisee') { navigate('/franchisees/new'); return; }
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await createPartnerAccount({
        role,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        plantId,
        parentDistributorId: parentDistributorId || undefined,
      });
      setCreated({ name: name.trim(), email: res.email, tempPassword: res.tempPassword, role });
      addToast('success', `Account created for ${name.trim()}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create account.';
      addToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    const text = `ZAPP Donuts login\nEmail: ${created.email}\nTemporary Password: ${created.tempPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('error', 'Could not copy — please copy manually.');
    }
  };

  const resetForm = () => {
    setCreated(null);
    setName(''); setEmail(''); setPhone(''); setPlantId(''); setParentDistributorId('');
    setErrors({});
  };

  const RoleIcon =
    role === 'franchisee' ? Store
    : role === 'partner_distributor' ? Handshake
    : role === 'sub_partner_distributor' ? Users
    : ClipboardList;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-zapp-orange transition-colors bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-zapp-orange">
            <UserPlus size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Account</h1>
            <p className="text-sm text-gray-500">
              Create a login for a {isPD ? 'Franchisee or Sub-Partner' : 'Partner Distributor, Sub-Partner, or Area Supervisor'}.
            </p>
          </div>
        </div>

        {/* Success reveal */}
        {created ? (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center py-4 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 size={30} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Account created!</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {ROLE_LABEL[created.role]} — <strong>{created.name}</strong>
                </p>

                <div className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <KeyRound size={14} /> Temporary Credentials — ibigay ito sa kanya
                  </div>
                  <div className="mt-3 space-y-1.5 font-mono text-sm">
                    <div><span className="text-gray-500">Email:</span> <span className="font-semibold">{created.email}</span></div>
                    <div><span className="text-gray-500">Password:</span> <span className="font-semibold">{created.tempPassword}</span></div>
                  </div>
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    Ipapadala/ibibigay mo ito sa kanya (text/chat). Papalitan nila ang password sa unang login.
                  </p>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button variant="primary" iconLeft={copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} onClick={copyCredentials}>
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Create Another</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <RoleIcon size={16} className="text-zapp-orange" /> Account Details
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <Select
                  label="Account Type"
                  options={roleOptions}
                  value={role}
                  onChange={(e) => { setRole(e.target.value as DropdownRole); setErrors({}); }}
                />

                {role === 'franchisee' ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2 font-semibold text-zapp-orange">
                      <Store size={16} /> Franchisee Onboarding
                    </div>
                    <p className="mt-2 text-gray-600">
                      Ang franchisee ay may sariling kumpletong form — store details, shop
                      code, map pin, at valid ID. Ituloy sa onboarding wizard para tama at
                      buo ang datos ng tindahan.
                    </p>
                  </div>
                ) : (
                  <>
                    <Input label="Full Name" placeholder="Juan Dela Cruz" value={name}
                      onChange={(e) => setName(e.target.value)} error={errors.name} iconLeft={<User size={16} />} />
                    <Input label="Email" type="email" placeholder="juan@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} error={errors.email} iconLeft={<Mail size={16} />}
                      helperText="Ito ang gagamitin niyang login." />
                    <Input label="Phone" placeholder="09171234567" value={phone}
                      onChange={(e) => setPhone(e.target.value)} error={errors.phone} iconLeft={<Phone size={16} />} />

                    {showParent && (
                      <Select label="Parent Distributor" options={parentOptions} value={parentDistributorId}
                        onChange={(e) => setParentDistributorId(e.target.value)} error={errors.parentDistributorId} />
                    )}
                    {showPlant && (
                      <Select label="Plant" options={plantOptions} value={plantId}
                        onChange={(e) => setPlantId(e.target.value)} error={errors.plantId} />
                    )}
                    {isPD && (
                      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        Awtomatikong nasa ilalim ng iyong network (scope) ang bagong account na ito.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              {role === 'franchisee' ? (
                <Button variant="primary" onClick={handleCreate} iconRight={<ArrowRight size={16} />}>
                  Continue to Franchisee Onboarding
                </Button>
              ) : (
                <Button variant="primary" onClick={handleCreate} loading={submitting} iconLeft={<UserPlus size={16} />}>
                  Create Account
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
