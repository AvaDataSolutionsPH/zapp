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
import type { Distributor, DistributorStatus } from '@/types';

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
  const { plants, updateDistributor } = useStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [status, setStatus] = useState<DistributorStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !distributor) return;
    setName(distributor.name);
    setContactPerson(distributor.contactPerson);
    setEmail(distributor.email);
    setPhone(distributor.phone);
    setPlantId(distributor.plantId);
    setStatus(distributor.status);
    setErrors({});
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
      addToast('error', err instanceof Error ? err.message : 'Hindi na-save.');
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
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Plant" options={plantOptions} value={plantId} onChange={(e) => setPlantId(e.target.value)} error={errors.plantId} />
          <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as DistributorStatus)} />
        </div>
        {/* Changing the code would orphan every application already filed under it. */}
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Referral Code: <span className="font-mono font-medium">{distributor?.referralCode}</span> — hindi
          mababago (nakakabit na ito sa mga naisumiteng application).
        </div>
      </div>
    </Modal>
  );
}
