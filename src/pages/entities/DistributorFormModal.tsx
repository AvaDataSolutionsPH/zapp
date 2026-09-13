// ============================================================
// ZAPP Donuts ERP — Partner Distributor edit
// ============================================================
//
// Boss: "lagyan mo din edit option sa distributor."
//
// EDIT ONLY — creating a distributor stays in the New Account flow, because a
// distributor is useless without a login and a referral code, and that flow
// already mints all three together. This modal fixes the details of one that
// exists (a misspelt name, a wrong plant, a changed contact number).
//
// The referral code is deliberately NOT editable: applications already carry it
// (applications.referral_code is stored per submission), so changing it here
// would orphan every application filed under the old code.

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { validateReferralCode } from '@/lib/referralCode';
import type { Distributor, DistributorStatus } from '@/types';
import { errorMessage } from '@/lib/errorMessage';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function DistributorFormModal({
  open,
  distributor,
  onClose,
}: {
  open: boolean;
  distributor: Distributor | null;
  onClose: () => void;
}) {
  const { plants, updateDistributor, changeReferralCode, changeLoginEmail, demoUsers, currentUser } =
    useStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [status, setStatus] = useState<DistributorStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // The code is editable only while unused. The store does the real check
  // (counting applications that carry the string) and refuses with a reason,
  // so this is a separate, explicit action rather than part of the batch save.
  const [codeDraft, setCodeDraft] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  // The LOGIN lives on the user row, not the distributor row. Owner only, and
  // it goes through an Edge Function because it must write auth.users too.
  const [loginDraft, setLoginDraft] = useState('');
  const [savingLogin, setSavingLogin] = useState(false);

  useEffect(() => {
    if (!open || !distributor) return;
    setName(distributor.name);
    setContactPerson(distributor.contactPerson);
    setEmail(distributor.email);
    setPhone(distributor.phone);
    setPlantId(distributor.plantId);
    setStatus(distributor.status);
    setCodeDraft(distributor.referralCode);
    setLoginDraft(
      demoUsers.find((u) => u.distributorId === distributor.id && u.role === 'partner_distributor')
        ?.email ?? '',
    );
    setErrors({});
    // `demoUsers` is deliberately NOT a dependency. This effect seeds the form
    // ONCE when the modal opens; re-running it whenever the users slice changes
    // (every hydration, and hydration runs on every TOKEN_REFRESHED) would wipe
    // a half-typed login email out from under the person typing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, distributor]);

  const plantOptions: SelectOption[] = [
    { value: '', label: 'Select Plant' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Kailangan ang pangalan.';
    if (!contactPerson.trim()) e.contactPerson = 'Kailangan ang contact person.';
    if (!email.trim()) e.email = 'Kailangan ang email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Hindi tama ang email.';
    if (!phone.trim()) e.phone = 'Kailangan ang phone.';
    if (!plantId) e.plantId = 'Kailangan ang plant.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyCodeChange = async () => {
    if (!distributor) return;
    const problem = validateReferralCode(codeDraft);
    if (problem) { addToast('error', problem); return; }
    setSavingCode(true);
    try {
      const saved = await changeReferralCode(distributor.id, codeDraft);
      setCodeDraft(saved);
      addToast('success', `Referral code is now ${saved}.`);
    } catch (err) {
      addToast('error', errorMessage(err, 'Hindi na-palitan ang referral code.'));
    } finally {
      setSavingCode(false);
    }
  };

  const pdAccount = distributor
    ? demoUsers.find((u) => u.distributorId === distributor.id && u.role === 'partner_distributor')
    : undefined;
  const canChangeLogin = currentUser?.role === 'owner' && !!pdAccount;

  const applyLoginChange = async () => {
    if (!pdAccount) return;
    const next = loginDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      addToast('error', 'Hindi valid ang email address.');
      return;
    }
    setSavingLogin(true);
    try {
      const saved = await changeLoginEmail(pdAccount.id, next);
      setLoginDraft(saved);
      addToast('success', `Ang login niya ay ${saved} na.`);
    } catch (err) {
      addToast('error', errorMessage(err, 'Hindi na-palitan ang login email.'));
    } finally {
      setSavingLogin(false);
    }
  };

  const handleSave = async () => {
    if (!distributor || !validate()) return;
    setSaving(true);
    try {
      await updateDistributor(distributor.id, {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        plantId,
        status,
      });
      addToast('success', `Na-update ang ${name.trim()}.`);
      onClose();
    } catch (err) {
      addToast('error', errorMessage(err, 'Hindi na-save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={distributor ? `I-edit ang ${distributor.name}` : ''}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<Building2 size={15} />}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Distributor Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} error={errors.contactPerson} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* ⚠️ This is distributors.email — the COMPANY contact address. The
              LOGIN lives in users.email and is NOT touched here. Editing this
              does not change how they sign in, and without this label the two
              silently drift apart. */}
          <Input
            label="Email (contact ng kumpanya)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            helperText="Hindi ito ang login. Ang email na ipinang-login niya ay hindi mapapalitan dito."
          />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Plant" options={plantOptions} value={plantId} onChange={(e) => setPlantId(e.target.value)} error={errors.plantId} />
          <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as DistributorStatus)} />
        </div>
        {/* Editable ONLY while no application carries the code. The store
            counts them and refuses with a readable reason — applications store
            the code as TEXT, so renaming one that is in use would detach them
            from this distributor with no error at all. */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Referral Code"
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                helperText="Ito ang ita-type ng mga franchisee niya sa /apply."
              />
            </div>
            <Button
              variant="outline"
              onClick={() => void applyCodeChange()}
              disabled={savingCode || !codeDraft.trim() || codeDraft.trim() === distributor?.referralCode}
            >
              {savingCode ? 'Pinapalitan…' : 'Palitan ang Code'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            ⚠️ Mapapalitan lang ito habang <strong>wala pang nag-a-apply</strong> gamit ito. Kapag
            may naipasang application, permanente na — mawawala ang koneksyon nila sa distributor
            kapag pinalitan.
          </p>
        </div>

        {/* The SIGN-IN address. Separate from the company email above, and from
            the batch Save — it writes auth.users as well, so it is an explicit
            action with its own confirmation. */}
        {canChangeLogin && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Login Email (ito ang ipinapasok niya sa /login)"
                  type="email"
                  value={loginDraft}
                  onChange={(e) => setLoginDraft(e.target.value)}
                  helperText="Iba ito sa Email ng kumpanya sa itaas."
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void applyLoginChange()}
                disabled={
                  savingLogin || !loginDraft.trim() || loginDraft.trim().toLowerCase() === pdAccount?.email
                }
              >
                {savingLogin ? 'Pinapalitan…' : 'Palitan ang Login'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-blue-800">
              ⚠️ Pagkatapos nito, <strong>ang bagong email na ang gagamitin niya sa pag-login</strong>.
              Hindi magbabago ang password. Sabihan mo siya bago palitan.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
