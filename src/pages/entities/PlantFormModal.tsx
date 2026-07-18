// ============================================================
// ZAPP Donuts ERP — Plant create / edit
// ============================================================
//
// Boss: "lagyan mo ng create new plant. tapos lagyan mo edit option ang plant.
// para if may mali madali ma edit in the future."
//
// One modal for both jobs — the fields are identical, only the action differs,
// so a second component would just be the same form twice. `plant === null`
// means create.
//
// Plants are reference data: 003's ref_write already restricts writes to
// admins, and the page only renders the buttons for the owner.

import { useEffect, useState } from 'react';
import { Factory } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import type { Plant } from '@/types';

export default function PlantFormModal({
  open,
  plant,
  onClose,
}: {
  open: boolean;
  /** null = create a new plant; otherwise edit this one. */
  plant: Plant | null;
  onClose: () => void;
}) {
  const { addPlant, updatePlant } = useStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [region, setRegion] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the modal opens (or switches plant) so an edit never shows
  // the previous plant's values.
  useEffect(() => {
    if (!open) return;
    setName(plant?.name ?? '');
    setLocation(plant?.location ?? '');
    setRegion(plant?.region ?? '');
    setCode(plant?.code ?? '');
    setErrors({});
  }, [open, plant]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Kailangan ang pangalan.';
    if (!location.trim()) e.location = 'Kailangan ang location.';
    if (!region.trim()) e.region = 'Kailangan ang region.';
    if (!code.trim()) e.code = 'Kailangan ang code.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim(),
        region: region.trim(),
        // Plant codes are shown uppercase everywhere (DRG / MNL / CEB).
        code: code.trim().toUpperCase(),
      };
      if (plant) {
        await updatePlant(plant.id, payload);
        addToast('success', `Na-update ang ${payload.name}.`);
      } else {
        await addPlant(payload);
        addToast('success', `Naidagdag ang ${payload.name}.`);
      }
      onClose();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Hindi na-save ang plant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={plant ? `I-edit ang ${plant.name}` : 'Bagong Plant'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<Factory size={15} />}>
            {plant ? 'Save Changes' : 'Create Plant'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Plant Name"
          placeholder="Daraga Plant"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="Location"
          placeholder="Daraga, Albay"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={errors.location}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Region"
            placeholder="Bicol"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            error={errors.region}
          />
          <Input
            label="Code"
            placeholder="DRG"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
            helperText="Maikling code (hal. DRG)"
          />
        </div>
      </div>
    </Modal>
  );
}
