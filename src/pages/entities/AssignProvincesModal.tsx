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
//
// ── ADDING A PROVINCE THAT IS NOT ON THE LIST ───────────────────────────────
// Boss: "lagyan mo to na pwede mag add areas. kasi may mga planta na wala sa
// area. example ang nueva ecija plant sya din nagsusupply sa tarlac."
//
// OPERATING_PROVINCES was a hardcoded fifteen, so a plant that also supplies a
// neighbouring province had nowhere to record it. The picker below fixes that —
// but deliberately NOT with a free-text box.
//
// ⚠️ WHY THE ADDED NAME MUST COME FROM PSGC, NOT THE KEYBOARD.
// The province stored on an application is whatever the `/apply` PSGC cascade
// wrote (`services/phLocations.ts`), and matching is an EXACT compare on both
// sides — `resolveAreaSupervisorForProvince` in the client, `app_province_key()`
// in RLS (migration 040). A typo like "Tarlac Province" or "tarlack" would save
// happily, show a tick in this grid, and then match NOTHING forever: the
// supervisor's queue just stays empty, with no error anywhere. That is the exact
// failure mode migrations 029 and 040 were written to kill.
//
// So the "add" control offers the SAME province list `/apply` itself uses, and
// the typed box only appears if that API is unreachable — with the spelling
// warning attached, because at that point we genuinely cannot verify it.
//
// No migration: `area_supervisors.assigned_provinces` is a JSONB array of
// strings and every consumer (client + RLS) matches against its contents rather
// than against a fixed list, so a new name works end to end as-is.

import { useMemo, useState } from 'react';
import { MapPin, AlertTriangle, Plus, Search, X } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { provincesClaimedByOthers } from '@/lib/applicationMonitoring';
import { OPERATING_PROVINCES, canonicalProvince } from '@/lib/phRegions';
import { fetchProvinces } from '@/services/phLocations';
import type { AreaSupervisor } from '@/types';
import { errorMessage } from '@/lib/errorMessage';

interface Props {
  supervisor: AreaSupervisor | null;
  onClose: () => void;
}

export default function AssignProvincesModal({ supervisor, onClose }: Props) {
  const { areaSupervisors, updateAreaSupervisorProvinces } = useStore();
  const { addToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Provinces added during THIS session that aren't in OPERATING_PROVINCES.
  // Kept apart from `selected` so an admin can add one, untick it, and still
  // see it in the grid instead of having it vanish under them.
  const [extra, setExtra] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Re-seed the draft whenever a different supervisor is opened. Keyed state
  // instead of an effect — the parent remounts via `key`, so this initialiser
  // runs per supervisor.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (supervisor && seededFor !== supervisor.id) {
    setSeededFor(supervisor.id);
    setSelected(supervisor.assignedProvinces ?? []);
    setExtra([]);
    setPicking(false);
    setSearch('');
  }

  // The grid = the standing list PLUS anything this supervisor already holds
  // PLUS anything added just now. Without the middle term, a province added in
  // an earlier session would be SAVED but invisible here — the count would say
  // 13 while only 12 boxes rendered.
  const assigned = supervisor?.assignedProvinces;
  const gridProvinces = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of [...OPERATING_PROVINCES, ...(assigned ?? []), ...extra]) {
      const key = canonicalProvince(p);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [assigned, extra]);

  const shownKeys = useMemo(
    () => new Set(gridProvinces.map((p) => canonicalProvince(p))),
    [gridProvinces],
  );

  const candidates = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog
      .filter((name) => !shownKeys.has(canonicalProvince(name)))
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [catalog, search, shownKeys]);

  if (!supervisor) return null;

  const taken = provincesClaimedByOthers(supervisor.id, areaSupervisors);

  // Compare by canonical key, not by string identity: the same province can
  // arrive spelled two ways ("Metro Manila" from the list below, "Metro Manila
  // (NCR)" from PSGC), and a plain `includes` would tick the wrong box and let
  // the same province be stored twice.
  const isChecked = (province: string) => {
    const key = canonicalProvince(province);
    return selected.some((s) => canonicalProvince(s) === key);
  };

  const toggle = (province: string) =>
    setSelected((prev) => {
      const key = canonicalProvince(province);
      return prev.some((s) => canonicalProvince(s) === key)
        ? prev.filter((s) => canonicalProvince(s) !== key)
        : [...prev, province];
    });

  const openPicker = async () => {
    setPicking(true);
    setSearch('');
    if (catalog || loadingCatalog) return;
    // Fetched on demand, not on open — most sessions never add a province, and
    // this is a third-party API call.
    setLoadingCatalog(true);
    setCatalogError('');
    try {
      const list = await fetchProvinces();
      setCatalog(list.map((p) => p.name));
    } catch (err) {
      setCatalogError(errorMessage(err, 'Hindi makuha ang listahan ng probinsya.'));
    } finally {
      setLoadingCatalog(false);
    }
  };

  const addProvince = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (shownKeys.has(canonicalProvince(clean))) {
      addToast('info', `Nasa listahan na ang ${clean}.`);
      return;
    }
    setExtra((prev) => [...prev, clean]);
    setSelected((prev) => [...prev, clean]);
    setPicking(false);
    setSearch('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAreaSupervisorProvinces(supervisor.id, selected);
      addToast('success', `Na-update ang saklaw ni ${supervisor.name}.`);
      onClose();
    } catch (err) {
      const msg = errorMessage(err, 'Hindi na-save ang saklaw.');
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
          {gridProvinces.map((province) => {
            const checked = isChecked(province);
            const claimed = taken.has(canonicalProvince(province));
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

        {/* ── Add a province that isn't on the standing list ───────────────── */}
        {!picking ? (
          <Button variant="outline" size="sm" iconLeft={<Plus size={15} />} onClick={() => void openPicker()}>
            Magdagdag ng probinsya
          </Button>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <Search size={15} className="shrink-0 text-gray-400" />
              <Input
                autoFocus
                placeholder="Hanapin ang probinsya — hal. Tarlac"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                aria-label="Isara"
              >
                <X size={16} />
              </button>
            </div>

            {loadingCatalog && (
              <p className="mt-2 text-xs text-gray-500">Kinukuha ang listahan ng probinsya...</p>
            )}

            {catalog && (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {candidates.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-gray-500">
                    {search.trim()
                      ? 'Walang tugmang probinsya. Baka nasa listahan na sa itaas.'
                      : 'Nasa listahan na ang lahat ng probinsya.'}
                  </p>
                ) : (
                  candidates.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addProvince(name)}
                      className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 last:border-b-0 hover:bg-orange-50 hover:text-gray-900"
                    >
                      <Plus size={13} className="shrink-0 text-zapp-orange" />
                      {name}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Only when the PSGC list is unreachable. An admin must not be
                blocked by a third-party outage — but the spelling can no longer
                be guaranteed to match what /apply writes, so say so plainly. */}
            {catalogError && (
              <div className="mt-2 space-y-2">
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Hindi makuha ang opisyal na listahan ({catalogError}). Pwede mong i-type ang
                  pangalan, pero kailangan <strong>tumpak ang baybay</strong> — kung hindi
                  tumugma sa isinusulat ng application form, walang mapupunta sa kanya.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!search.trim()}
                  iconLeft={<Plus size={14} />}
                  onClick={() => addProvince(search)}
                >
                  Idagdag ang "{search.trim() || '...'}"
                </Button>
              </div>
            )}
          </div>
        )}

        {selected.some((p) => taken.has(canonicalProvince(p))) && (
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
