// ============================================================
// LocationCascadeFields — PSGC Province → City/Municipality → Barangay
// ============================================================
// The public /apply form has always had a real location cascade: PSGC
// dropdowns plus Nominatim re-centering of the store map as the applicant
// narrows down province → city → barangay.
//
// The INTERNAL forms had three free-text inputs instead, so their map could
// only ever be centered from the 12-entry hardcoded table inside
// StorePinPicker. Anything outside it (e.g. "Camarines Norte") fell back to
// the Legazpi default — and because a non-empty province also bumps the zoom
// to 13, the map ended up parked at STREET level on the wrong province. That
// is what made the required pin step unusable away from Albay.
//
// This component owns the cascade + geocoding and reports upward:
//   • the resolved NAMES (each form keeps its own state shape)
//   • a map target (center + zoom) to hand to <StorePinPicker>
//
// Every level degrades to a free-text Input if its fetch fails, so a PSGC or
// Nominatim outage can never hard-block a form.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { fetchProvinces, fetchCities, fetchBarangays } from '@/services/phLocations';
import type { PsgcItem } from '@/services/phLocations';
import { geocodePH } from '@/services/geocode';

export interface LocationValue {
  province: string;
  city: string;
  barangay: string;
}

interface LocationCascadeFieldsProps {
  value: LocationValue;
  /** Patch of resolved names — the caller writes them into its own form. */
  onChange: (patch: Partial<LocationValue>) => void;
  errors?: Partial<Record<keyof LocationValue, string>>;
  /** Fired when the picked area geocodes, so the map can follow along. */
  onMapTarget?: (center: [number, number], zoom: number) => void;
  /** Grid columns for the three fields. */
  columns?: 2 | 3;
}

export default function LocationCascadeFields({
  value,
  onChange,
  errors,
  onMapTarget,
  columns = 3,
}: LocationCascadeFieldsProps) {
  const [provinces, setProvinces] = useState<PsgcItem[]>([]);
  const [cities, setCities] = useState<PsgcItem[]>([]);
  const [barangays, setBarangays] = useState<PsgcItem[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  // `prov` starts true — the province fetch is kicked off on mount, so the
  // first render is already a loading render.
  const [loading, setLoading] = useState({ prov: true, city: false, brgy: false });
  const [failed, setFailed] = useState({ prov: false, city: false, brgy: false });

  // `geoSeq` guards against a slow earlier geocode landing after — and
  // overriding — a newer selection. `targetRef` keeps the caller's inline
  // arrow prop out of the effect deps.
  const geoSeq = useRef(0);
  const targetRef = useRef(onMapTarget);
  useEffect(() => {
    targetRef.current = onMapTarget;
  }, [onMapTarget]);

  const recenter = useCallback(async (query: string, zoom: number) => {
    const seq = ++geoSeq.current;
    const geo = await geocodePH(query);
    if (seq !== geoSeq.current || !geo) return;
    targetRef.current?.([geo.lat, geo.lng], zoom);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchProvinces()
      .then((list) => {
        if (!alive) return;
        setProvinces(list);
        setFailed((s) => ({ ...s, prov: false }));
      })
      .catch(() => alive && setFailed((s) => ({ ...s, prov: true })))
      .finally(() => alive && setLoading((s) => ({ ...s, prov: false })));
    return () => {
      alive = false;
    };
  }, []);

  const selectProvince = (code: string) => {
    const name = provinces.find((p) => p.code === code)?.name ?? '';
    setProvinceCode(code);
    setCityCode('');
    setCities([]);
    setBarangays([]);
    setFailed((s) => ({ ...s, city: false, brgy: false }));
    onChange({ province: name, city: '', barangay: '' });
    if (!code) return;
    if (name) recenter(name + ', Philippines', 10);
    setLoading((s) => ({ ...s, city: true }));
    fetchCities(code)
      .then((list) => setCities(list))
      .catch(() => setFailed((s) => ({ ...s, city: true })))
      .finally(() => setLoading((s) => ({ ...s, city: false })));
  };

  const selectCity = (code: string) => {
    const name = cities.find((c) => c.code === code)?.name ?? '';
    setCityCode(code);
    setBarangays([]);
    setFailed((s) => ({ ...s, brgy: false }));
    onChange({ city: name, barangay: '' });
    if (!code) return;
    if (name) recenter(name + ', ' + value.province + ', Philippines', 13);
    setLoading((s) => ({ ...s, brgy: true }));
    fetchBarangays(code)
      .then((list) => setBarangays(list))
      .catch(() => setFailed((s) => ({ ...s, brgy: true })))
      .finally(() => setLoading((s) => ({ ...s, brgy: false })));
  };

  const selectBarangay = (name: string) => {
    onChange({ barangay: name });
    if (name) recenter(name + ', ' + value.city + ', ' + value.province + ', Philippines', 16);
  };

  const provinceOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: loading.prov ? 'Loading provinces…' : 'Select Province' },
      ...provinces.map((p) => ({ value: p.code, label: p.name })),
    ],
    [provinces, loading.prov],
  );

  const cityOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: loading.city ? 'Loading…' : 'Select City / Municipality' },
      ...cities.map((c) => ({ value: c.code, label: c.name })),
    ],
    [cities, loading.city],
  );

  const barangayOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: loading.brgy ? 'Loading…' : 'Select Barangay' },
      ...barangays.map((b) => ({ value: b.name, label: b.name })),
    ],
    [barangays, loading.brgy],
  );

  // A failure at ANY level drops the levels below it to free text — a city
  // dropdown is meaningless once its province came from a typed string.
  const anyFailed = failed.prov || failed.city || failed.brgy;
  const gridCols = columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div className={'grid gap-4 ' + gridCols}>
      {failed.prov ? (
        <Input
          label="Province"
          placeholder="Type the province"
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value })}
          error={errors?.province}
        />
      ) : (
        <Select
          label="Province"
          options={provinceOptions}
          value={provinceCode}
          onChange={(e) => selectProvince(e.target.value)}
          error={errors?.province}
          disabled={loading.prov}
        />
      )}

      {anyFailed ? (
        <Input
          label="City / Municipality"
          placeholder="Type the city / municipality"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          error={errors?.city}
        />
      ) : (
        <Select
          label="City / Municipality"
          options={cityOptions}
          value={cityCode}
          onChange={(e) => selectCity(e.target.value)}
          error={errors?.city}
          disabled={!provinceCode || loading.city}
        />
      )}

      {anyFailed ? (
        <Input
          label="Barangay"
          placeholder="Type the barangay"
          value={value.barangay}
          onChange={(e) => onChange({ barangay: e.target.value })}
          error={errors?.barangay}
        />
      ) : (
        <Select
          label="Barangay"
          options={barangayOptions}
          value={value.barangay}
          onChange={(e) => selectBarangay(e.target.value)}
          error={errors?.barangay}
          disabled={!cityCode || loading.brgy}
        />
      )}
    </div>
  );
}
