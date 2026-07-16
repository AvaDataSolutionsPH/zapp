// ============================================================
// ZAPP Donuts ERP — Admin settings: province coverage per Area Supervisor
// ============================================================
//
// Boss's instruction (verbatim): "Gawa nalang tayo ng admin settings na
// maglalagay sa per areas sa isang area supv. Para kahit mapalitan madali lang
// ichange."
//
// This is the master list behind the New Application Monitoring module's
// automatic Area-Supervisor assignment. It is DATA, edited here by an admin —
// changing it instantly re-points every application, because the AS is resolved
// at read time (see effectiveAreaSupervisorId) rather than frozen at submit.
//
// The province list comes from OPERATING_PROVINCES, not from the applications
// that happen to exist: an admin has to be able to assign coverage BEFORE the
// first applicant from that province ever arrives.

import { useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { provincesClaimedByOthers } from '@/lib/applicationMonitoring';
import { OPERATING_PROVINCES } from '@/lib/phRegions';
import type { AreaSupervisor } from '@/types';

interface Props {
  supervisor: AreaSupervisor | null;
  onClose: () => void;
}

export default function AssignProvincesModal({ supervisor, onClose }: Props) {
  const { areaSupervisors, updateAreaSupervisorProvinces } = useStore();
  const { addToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Re-seed the draft whenever a different supervisor is opened. Keyed state
  // instead of an effect — the parent remounts via `key`, so this initialiser
  // runs per supervisor.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (supervisor && seededFor !== supervisor.id) {
    setSeededFor(supervisor.id);
    setSelected(supervisor.assignedProvinces ?? []);
  }

  if (!supervisor) return null;

  const taken = provincesClaimedByOthers(supervisor.id, areaSupervisors);
  const toggle = (province: string) =>
    setSelected((prev) =>
      prev.includes(province) ? prev.filter((p) => p !== province) : [...prev, province],
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAreaSupervisorProvinces(supervisor.id, selected);
      addToast('success', `Na-update ang saklaw ni ${supervisor.name}.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hindi na-save ang saklaw.';
      addToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!supervisor} onClose={onClose} title={`Assign Areas — ${supervisor.name}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Piliin ang mga probinsyang hawak ni <strong>{supervisor.name}</strong>. Ang bagong
          application mula sa mga probinsyang ito ay awtomatikong mapupunta sa kanya, at ito rin
          ang makikita niya sa New Applications.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPERATING_PROVINCES.map((province) => {
            const checked = selected.includes(province);
            const claimed = taken.has(province.toLowerCase());
            return (
              <label
                key={province}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? 'border-zapp-orange bg-orange-50 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(province)}
                  className="h-4 w-4 shrink-0 accent-zapp-orange"
                />
                <span className="flex-1">{province}</span>
                {/* Coverage overlap isn't blocked — the first match wins at
                    assignment, so surface it and let the admin decide. */}
                {claimed && !checked && (
                  <AlertTriangle size={13} className="shrink-0 text-amber-500" />
                )}
              </label>
            );
          })}
        </div>

        {selected.some((p) => taken.has(p.toLowerCase())) && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            May probinsyang hawak na rin ng ibang Area Supervisor. Kung magkaganun, ang
            unang nakatala ang makukuha ng bagong application — mas mabuting isa lang ang
            may hawak ng bawat probinsya.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <span className="text-xs text-gray-500">
            {selected.length === 0
              ? 'Walang saklaw — hindi siya makakatanggap ng auto-assign.'
              : `${selected.length} probinsya${selected.length > 1 ? '' : ''} ang napili.`}
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<MapPin size={15} />}>
              Save Areas
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
