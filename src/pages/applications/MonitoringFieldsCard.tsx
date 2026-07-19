// ============================================================
// ZAPP Donuts ERP — New Application Monitoring: evaluation fields
// ============================================================
//
// The department-owned half of an application. Everything above this card on
// ApplicationDetailPage is auto-filled from the intake form and read-only; these
// are the fields PD/SD, AS and OS complete while evaluating the location.
//
// Contract from the spec:
//   • Role-based access — each department edits only its own fields. Fields a
//     role does not own still RENDER (read-only), so everyone sees the full
//     picture; only the input is withheld. Permissions come from
//     src/lib/applicationMonitoring.ts.
//   • Save button — "No changes shall take effect until Save". So everything
//     here is DRAFT state; nothing touches the store until Save succeeds.
//
// Status is NOT here on purpose — approving creates the Store + login, so it
// stays an explicit action on the parent page.

import { useMemo, useState } from 'react';
import { Save, MapPin, ExternalLink, Undo2 } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter, Button, Input, Select, CheckboxGroup, FileUpload } from '@/components/ui';
import type { SelectOption, UploadedFile } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { useStorageUrl } from '@/lib/useStorageUrl';
import { ensureHttpUrl } from '@/lib/externalUrl';
import { uploadFile, buildObjectPath } from '@/services/storage';
import {
  canEditField,
  canEditAnyField,
  VALUE_LABELS,
  MARKET_SOURCE_OPTIONS,
  marketSourceSummary,
} from '@/lib/applicationMonitoring';
import type { Application, DeliverySchedule, RtcStatus } from '@/types';
import { DELIVERY_SCHEDULE_LABELS } from '@/types';

const RTC_OPTIONS: SelectOption[] = [
  { value: '', label: '—' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'disapproved', label: 'Disapproved' },
];

// Built from the labels map so the dropdown, the read-only view and the
// Transaction History can never disagree on what a cadence is called.
const DELIVERY_SCHEDULE_OPTIONS: SelectOption[] = [
  { value: '', label: '—' },
  ...(Object.keys(DELIVERY_SCHEDULE_LABELS) as DeliverySchedule[]).map((v) => ({
    value: v,
    label: DELIVERY_SCHEDULE_LABELS[v],
  })),
];

// Value → display text is shared with the Transaction History diff so the log
// and the form can never disagree on what a stored value is called.
const LABELS = VALUE_LABELS;

/** Read-only presentation of a field this role does not own. */
function ReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

/** The Google Maps screenshot, once saved. Private bucket → needs re-signing. */
function SavedMapsPicture({ storageRef }: { storageRef: string }) {
  const url = useStorageUrl(storageRef);
  if (!url) return <p className="text-xs text-gray-400">Loading preview…</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Store Google Maps"
        className="h-32 w-full rounded-lg border border-gray-200 object-cover"
      />
    </a>
  );
}

export default function MonitoringFieldsCard({ application }: { application: Application }) {
  const { currentUser, plants, updateApplicationMonitoring } = useStore();
  const { addToast } = useToast();
  const role = currentUser?.role;

  // Draft state — seeded from the application, discarded unless Saved.
  const [googleMapsLink, setGoogleMapsLink] = useState(application.googleMapsLink ?? '');
  const [lat, setLat] = useState(String(application.lat ?? ''));
  const [lng, setLng] = useState(String(application.lng ?? ''));
  const [marketSource, setMarketSource] = useState<string[]>(application.marketSource ?? []);
  const [marketSourceOther, setMarketSourceOther] = useState(application.marketSourceOther ?? '');
  const [comparable, setComparable] = useState(application.comparable ?? '');
  const [ads, setAds] = useState(application.ads ?? '');
  const [rtc, setRtc] = useState(application.rtc ?? '');
  const [shopCode, setShopCode] = useState(application.shopCode ?? '');
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | ''>(
    application.deliverySchedule ?? '',
  );
  const [plantId, setPlantId] = useState(application.assignedPlantId ?? '');
  const [remarksPdSd, setRemarksPdSd] = useState(application.remarksPdSd ?? '');
  const [remarksAs, setRemarksAs] = useState(application.remarksAs ?? '');
  const [remarksOs, setRemarksOs] = useState(application.remarksOs ?? '');
  // The picture is uploaded ON SAVE, not on pick — until then it's just a File,
  // so cancelling leaves no orphan object in the bucket.
  const [mapsPicture, setMapsPicture] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);

  const can = (f: Parameters<typeof canEditField>[1]) => canEditField(role, f);

  // ⚠️ The Shop Code IS the franchisee's username: approval turns it into the
  // synthetic login address stored in auth.users. Editing it afterwards would
  // NOT rename that login — the Shop Code → email mapping would simply stop
  // finding their row and they would be locked out with "invalid credentials",
  // with nothing on screen suggesting why. So it is frozen the moment a login
  // exists, for every role including Admin.
  const loginExists = !!application.accountUserId;
  const canEditShopCode = can('shopCode') && !loginExists;
  const plantOptions: SelectOption[] = [
    { value: '', label: 'Select Plant' },
    ...plants.map((p) => ({ value: p.id, label: p.name })),
  ];
  const plantName = plants.find((p) => p.id === application.assignedPlantId)?.name;
  const mapsHref = ensureHttpUrl(application.googleMapsLink);

  const dirty = useMemo(
    () =>
      googleMapsLink !== (application.googleMapsLink ?? '') ||
      lat !== String(application.lat ?? '') ||
      lng !== String(application.lng ?? '') ||
      JSON.stringify(marketSource) !== JSON.stringify(application.marketSource ?? []) ||
      marketSourceOther !== (application.marketSourceOther ?? '') ||
      comparable !== (application.comparable ?? '') ||
      ads !== (application.ads ?? '') ||
      rtc !== (application.rtc ?? '') ||
      shopCode !== (application.shopCode ?? '') ||
      deliverySchedule !== (application.deliverySchedule ?? '') ||
      plantId !== (application.assignedPlantId ?? '') ||
      remarksPdSd !== (application.remarksPdSd ?? '') ||
      remarksAs !== (application.remarksAs ?? '') ||
      remarksOs !== (application.remarksOs ?? '') ||
      mapsPicture.length > 0,
    [
      application, googleMapsLink, lat, lng, marketSource, marketSourceOther, comparable,
      ads, rtc, shopCode, deliverySchedule, plantId, remarksPdSd, remarksAs, remarksOs,
      mapsPicture,
    ],
  );

  const reset = () => {
    setGoogleMapsLink(application.googleMapsLink ?? '');
    setLat(String(application.lat ?? ''));
    setLng(String(application.lng ?? ''));
    setMarketSource(application.marketSource ?? []);
    setMarketSourceOther(application.marketSourceOther ?? '');
    setComparable(application.comparable ?? '');
    setAds(application.ads ?? '');
    setRtc(application.rtc ?? '');
    setShopCode(application.shopCode ?? '');
    setDeliverySchedule(application.deliverySchedule ?? '');
    setPlantId(application.assignedPlantId ?? '');
    setRemarksPdSd(application.remarksPdSd ?? '');
    setRemarksAs(application.remarksAs ?? '');
    setRemarksOs(application.remarksOs ?? '');
    setMapsPicture([]);
  };

  // Only fields this role owns go into the patch — a stray draft value from a
  // field the user cannot edit must never reach the DB.
  const handleSave = async () => {
    const patch: Partial<Application> = {};
    setSaving(true);
    try {
      if (can('googleMapsPictureUrl') && mapsPicture[0]) {
        const file = mapsPicture[0].file;
        const { storageRef } = await uploadFile(
          'zapp-private',
          buildObjectPath('store-maps', application.id, file),
          file,
          { sign: false },
        );
        patch.googleMapsPictureUrl = storageRef;
      }
      if (can('googleMapsLink')) patch.googleMapsLink = googleMapsLink.trim() || undefined;
      if (can('latLng')) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
          addToast('error', 'Latitude at Longitude ay dapat numero.');
          setSaving(false);
          return;
        }
        patch.lat = parsedLat;
        patch.lng = parsedLng;
      }
      if (can('marketSource')) {
        patch.marketSource = marketSource.length ? marketSource : undefined;
        // The custom text only means anything while "Other" is ticked.
        patch.marketSourceOther = marketSource.includes('other')
          ? marketSourceOther.trim() || undefined
          : undefined;
      }
      if (can('comparable')) patch.comparable = comparable.trim() || undefined;
      if (can('ads')) patch.ads = ads.trim() || undefined;
      if (can('rtc')) patch.rtc = (rtc || undefined) as RtcStatus | undefined;
      if (canEditShopCode) patch.shopCode = shopCode.trim() || undefined;
      if (can('deliverySchedule')) patch.deliverySchedule = deliverySchedule || undefined;
      if (can('assignedPlantId') && plantId) patch.assignedPlantId = plantId;
      if (can('remarksPdSd')) patch.remarksPdSd = remarksPdSd.trim() || undefined;
      if (can('remarksAs')) patch.remarksAs = remarksAs.trim() || undefined;
      if (can('remarksOs')) patch.remarksOs = remarksOs.trim() || undefined;

      await updateApplicationMonitoring(application.id, patch);
      setMapsPicture([]);
      addToast('success', 'Na-save ang mga pagbabago.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hindi na-save ang mga pagbabago.';
      addToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin size={18} /> Evaluation Details
          </h2>
          {!canEditAnyField(role) && (
            <span className="text-xs text-gray-500">View only</span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── PD/SD ─────────────────────────────────────────── */}
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Store Google Maps Picture
            </dt>
            <dd>
              {application.googleMapsPictureUrl ? (
                <SavedMapsPicture storageRef={application.googleMapsPictureUrl} />
              ) : (
                !can('googleMapsPictureUrl') && <span className="text-sm text-gray-400">—</span>
              )}
              {can('googleMapsPictureUrl') && (
                <div className="mt-2">
                  {/* FileUpload is uncontrolled (no `value` prop) — it owns its
                      own list. We mirror the picked file into draft state so
                      Save can upload it and `dirty` can see it. */}
                  <FileUpload
                    accept="image/*"
                    maxSizeMB={10}
                    camera
                    onChange={setMapsPicture}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Screenshot ng Google Maps view ng tindahan. Ia-upload lang kapag pinindot ang Save.
                  </p>
                </div>
              )}
            </dd>
          </div>

          {can('googleMapsLink') ? (
            <div className="sm:col-span-2">
              <Input
                label="Google Maps Link"
                placeholder="https://maps.app.goo.gl/..."
                value={googleMapsLink}
                onChange={(e) => setGoogleMapsLink(e.target.value)}
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Google Maps Link</dt>
              <dd className="mt-1 text-sm break-all">
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {application.googleMapsLink} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
          )}

          {/* ── Long/Lat — editable by PD/SD/AS because applicants
                 routinely pin the wrong spot. ───────────────────── */}
          {can('latLng') ? (
            <>
              <Input label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
              <Input label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
            </>
          ) : (
            <>
              <ReadOnly label="Latitude" value={String(application.lat)} />
              <ReadOnly label="Longitude" value={String(application.lng)} />
            </>
          )}

          {/* Market Source — a multi-select checklist of location traits
              (boss request); "Other" reveals a free-text box. Full width. */}
          {can('marketSource') ? (
            <div className="sm:col-span-2">
              <CheckboxGroup
                label="Market Source"
                options={MARKET_SOURCE_OPTIONS}
                value={marketSource}
                onChange={setMarketSource}
                multiple
              />
              {marketSource.includes('other') && (
                <div className="mt-2">
                  <Input
                    placeholder="Isulat ang ibang market source"
                    value={marketSourceOther}
                    onChange={(e) => setMarketSourceOther(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="sm:col-span-2">
              <ReadOnly
                label="Market Source"
                value={marketSourceSummary(application.marketSource, application.marketSourceOther)}
              />
            </div>
          )}

          {can('assignedPlantId') ? (
            <Select
              label="Plant"
              options={plantOptions}
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
            />
          ) : (
            <ReadOnly label="Plant" value={plantName} />
          )}

          {/* ── AS/OS — free-text boxes (boss: "box lang, ops/area supv ang
                 magta-type"). ADS = Average Daily Sales. ──────────── */}
          {can('comparable') ? (
            <Input
              label="Comparable"
              placeholder="Type value"
              value={comparable}
              onChange={(e) => setComparable(e.target.value)}
            />
          ) : (
            <ReadOnly label="Comparable" value={application.comparable} />
          )}

          {can('ads') ? (
            <Input
              label="ADS"
              placeholder="Average Daily Sales"
              value={ads}
              onChange={(e) => setAds(e.target.value)}
            />
          ) : (
            <ReadOnly label="ADS" value={application.ads} />
          )}

          {can('rtc') ? (
            /* An "Approved" RTC reads like THE approval and is not — it is a
               site evaluation. A boss set it, saved, and expected the login
               credentials to appear. The hint below is the fix for that. */
            <div>
              <Select
                label="RTC"
                options={RTC_OPTIONS}
                value={rtc}
                onChange={(e) => setRtc(e.target.value as RtcStatus)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Evaluation lang ito. <strong>Hindi ito ang pag-approve</strong> ng
                application — gamitin ang <strong>Approve</strong> na button sa itaas.
              </p>
            </div>
          ) : (
            <ReadOnly label="RTC" value={application.rtc && LABELS[application.rtc]} />
          )}

          {canEditShopCode ? (
            <Input
              label="Shop Code"
              placeholder="MD shop code"
              value={shopCode}
              onChange={(e) => setShopCode(e.target.value)}
            />
          ) : (
            <div>
              <ReadOnly label="Shop Code" value={application.shopCode} />
              {loginExists && can('shopCode') && (
                <p className="mt-1 text-xs text-gray-500">
                  Ito na ang <strong>username</strong> ng franchisee, kaya hindi na ito
                  mababago. Kung mali ito, kailangang gumawa ng bagong login.
                </p>
              )}
            </div>
          )}

          {can('deliverySchedule') ? (
            <Select
              label="Delivery Schedule"
              options={DELIVERY_SCHEDULE_OPTIONS}
              value={deliverySchedule}
              onChange={(e) => setDeliverySchedule(e.target.value as DeliverySchedule | '')}
            />
          ) : (
            <ReadOnly
              label="Delivery Schedule"
              value={
                application.deliverySchedule
                  ? DELIVERY_SCHEDULE_LABELS[application.deliverySchedule]
                  : undefined
              }
            />
          )}

          {/* ── Remarks — one per department, each owned solely by it. ── */}
          {can('remarksPdSd') ? (
            <div className="sm:col-span-2">
              <Input label="Remarks (PD/SD)" value={remarksPdSd} onChange={(e) => setRemarksPdSd(e.target.value)} />
            </div>
          ) : (
            <div className="sm:col-span-2"><ReadOnly label="Remarks (PD/SD)" value={application.remarksPdSd} /></div>
          )}

          {can('remarksAs') ? (
            <div className="sm:col-span-2">
              <Input label="Remarks (Area Supervisor)" value={remarksAs} onChange={(e) => setRemarksAs(e.target.value)} />
            </div>
          ) : (
            <div className="sm:col-span-2"><ReadOnly label="Remarks (Area Supervisor)" value={application.remarksAs} /></div>
          )}

          {can('remarksOs') ? (
            <div className="sm:col-span-2">
              <Input label="Remarks (Operations Supervisor)" value={remarksOs} onChange={(e) => setRemarksOs(e.target.value)} />
            </div>
          ) : (
            <div className="sm:col-span-2"><ReadOnly label="Remarks (Operations Supervisor)" value={application.remarksOs} /></div>
          )}
        </dl>
      </CardContent>

      {canEditAnyField(role) && (
        <CardFooter className="flex items-center justify-end gap-3">
          {dirty && (
            <>
              <span className="mr-auto text-xs text-amber-600">
                May mga hindi pa na-save na pagbabago.
              </span>
              <Button variant="outline" onClick={reset} disabled={saving} iconLeft={<Undo2 size={15} />}>
                Discard
              </Button>
            </>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!dirty}
            iconLeft={<Save size={16} />}
          >
            Save
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
