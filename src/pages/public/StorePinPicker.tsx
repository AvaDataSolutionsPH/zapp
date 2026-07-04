// ============================================================
// StorePinPicker — Grab-style map pin for the /apply Store Info step
// ============================================================
// Applicants drop / drag a single marker on the EXACT location of
// their STORE (not their house). The marker's lat/lng flow back up
// via onChange as fixed-6-decimal strings so the parent form keeps
// storing them as strings (unchanged submit path). Tap-to-place +
// drag-to-adjust only — no geolocation, no external geocoding API.

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, MapPin } from 'lucide-react';

// Fix leaflet's default marker icon under bundlers — same approach as
// GeoHeatmapPage: delete the private _getIconUrl so it falls back to
// the CDN URLs below instead of trying to resolve local assets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Rough province centroids so the map opens near the applicant's area
// before they place a pin. Not exhaustive — anything missing falls back
// to the Bicol default (this is a Bicol-first business).
const DEFAULT_CENTER: [number, number] = [13.1391, 123.7341]; // Legazpi, Albay

const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
  Albay: [13.1391, 123.7341],
  'Camarines Sur': [13.6252, 123.1829],
  Sorsogon: [12.9742, 124.0055],
  Catanduanes: [13.7089, 124.2422],
  Masbate: [12.3686, 123.6417],
  'Metro Manila': [14.5995, 120.9842],
  Cavite: [14.2794, 120.8699],
  Laguna: [14.1697, 121.2436],
  Bulacan: [14.7943, 120.8797],
  Rizal: [14.6037, 121.3084],
  Batangas: [13.7565, 121.0583],
  Pampanga: [15.0794, 120.6200],
};

const round6 = (n: number) => n.toFixed(6);

interface StorePinPickerProps {
  lat: string;
  lng: string;
  province?: string;
  /** Optional map view override (e.g. geocoded from the selected
   *  province/city/barangay) so the map progressively zooms toward the
   *  chosen area. Ignored once a pin is dropped. */
  centerOverride?: [number, number] | null;
  zoomOverride?: number | null;
  onChange: (lat: string, lng: string) => void;
  error?: string;
}

// Captures clicks anywhere on the map and reports the picked point.
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recenters/zooms the map when the target coordinates change — but ONLY
// while no pin has been dropped yet, so we never yank the map away from a
// marker the applicant already placed. Deps are the primitive lat/lng/zoom
// (not a fresh array each render) so unrelated re-renders don't reset the
// user's manual panning.
function Recenter({
  lat,
  lng,
  zoom,
  active,
}: {
  lat: number;
  lng: number;
  zoom: number;
  active: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (active) map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, active, map]);
  return null;
}

export default function StorePinPicker({
  lat,
  lng,
  province,
  centerOverride,
  zoomOverride,
  onChange,
  error,
}: StorePinPickerProps) {
  const hasPin = lat !== '' && lng !== '';
  const pinPos: [number, number] | null = hasPin
    ? [parseFloat(lat), parseFloat(lng)]
    : null;

  const provinceCenter = province ? PROVINCE_CENTROIDS[province] : undefined;
  // Priority: an already-dropped pin > geocoded override (province/city/
  // barangay) > province centroid > national default.
  const center: [number, number] =
    pinPos ?? centerOverride ?? provinceCenter ?? DEFAULT_CENTER;
  const zoom = zoomOverride ?? (province ? 13 : 11);

  const pick = (la: number, ln: number) => onChange(round6(la), round6(ln));

  return (
    <div>
      {/* Store-not-house warning */}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          I-pin ang <span className="font-bold">EKSAKTONG lokasyon ng iyong TINDAHAN</span> — hindi
          ang inyong bahay. I-tap ang mapa o i-drag ang pin papunta sa tamang lugar.
        </p>
      </div>

      <div
        className={`overflow-hidden rounded-lg border ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          style={{ height: '18rem', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onPick={pick} />
          <Recenter lat={center[0]} lng={center[1]} zoom={zoom} active={!hasPin} />
          {pinPos && (
            <Marker
              position={pinPos}
              draggable
              eventHandlers={{
                dragend(e) {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  pick(ll.lat, ll.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Coordinate read-out */}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <MapPin size={16} className={hasPin ? 'text-zapp-orange' : 'text-gray-400'} />
        {hasPin ? (
          <span className="text-gray-700">
            Naka-pin sa <span className="font-mono font-medium">{lat}, {lng}</span>
          </span>
        ) : (
          <span className="text-gray-400">Wala pang pin — i-tap ang mapa sa lokasyon ng tindahan.</span>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
