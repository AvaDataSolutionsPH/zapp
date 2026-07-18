// ============================================================
// ZAPP Donuts ERP — Area Supervisor edit
// ============================================================
//
// Boss: "same sa area supv, lagyan mo ng edit option."
//
// EDIT ONLY — creating an Area Supervisor stays in the New Account flow, which
// also mints the login. This fixes the details of an existing one.
//
// ⚠️ Province coverage is NOT here. It lives in its own "Assign Areas" modal
// because it decides which applications route to this supervisor — a
// consequential change that deserves its own deliberate action, not a field
// buried in a general edit form. `assignedAreas` below is the free-text CITY
// list, which is display-only.

import { useEffect, useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { Button, Input, Modal, Select, Badge } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import type { AreaSupervisor } from '@/types';

export default function AreaSupervisorFormModal({
  open,
  supervisor,
  onClose,
}: {
  open: boolean;
  supervisor: AreaSupervisor | null;
  onClose: () => void;
}) {
  const { plants, updateAreaSupervisorDetails } = useStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [areaDraft, setAreaDraft] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !supervisor) return;
    setName(supervisor.name);
    setEmail(supervisor.email);
    setPhone(supervisor.phone);
    setPlantId(supervisor.plantId);
    setAreas(supervisor.assignedAreas ?? []);
    setAreaDraft('');
    setErrors({});
  }, [open, supervisor]);

  const plantOptions: SelectOption[] = [
    { value: '', label: 'Select Plant' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const addArea = () => {
    const v = areaDraft.trim();
    // Case-insensitive dedupe — "Legazpi" and "legazpi" are the same city.
    if (!v || areas.some((a) => a.toLowerCase() === v.toLowerCase())) {
      setAreaDraft('');
      return;
    }
    setAreas([...areas, v]);
    setAreaDraft('');
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Kailangan ang pangalan.';
    if (!email.trim()) e.email = 'Kailangan ang email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Hindi tama ang email.';
    if (!phone.trim()) e.phone = 'Kailangan ang phone.';
    if (!plantId) e.plantId = 'Kailangan ang plant.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!supervisor || !validate()) return;
    setSaving(true);
    try {
      await updateAreaSupervisorDetails(supervisor.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        plantId,
        assignedAreas: areas,
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
      title={supervisor ? `I-edit si ${supervisor.name}` : ''}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<ClipboardList size={15} />}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        </div>
        <Select label="Plant" options={plantOptions} value={plantId} onChange={(e) => setPlantId(e.target.value)} error={errors.plantId} />

        <div>
          <span className="text-sm font-medium text-gray-700">Areas (mga lungsod)</span>
          <div className="mt-1.5 flex gap-2">
            <Input
              placeholder="Hal. Legazpi City"
              value={areaDraft}
              onChange={(e) => setAreaDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addArea(); }
              }}
              className="flex-1"
            />
            <Button variant="outline" onClick={addArea} disabled={!areaDraft.trim()}>
              Add
            </Button>
          </div>
          {areas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <span key={a} className="inline-flex items-center gap-1">
                  <Badge variant="neutral" size="sm">{a}</Badge>
                  <button
                    type="button"
                    onClick={() => setAreas(areas.filter((x) => x !== a))}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Alisin ang ${a}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Pang-display lang ito. Ang <strong>Provinces (Coverage)</strong> — na siyang
            nagdedesisyon kung aling application ang mapupunta sa kanya — ay nasa
            "Assign Areas".
          </p>
        </div>
      </div>
    </Modal>
  );
}
