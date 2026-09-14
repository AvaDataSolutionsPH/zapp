// ============================================================
// Bundled Leaflet marker icons
// ============================================================
// Leaflet resolves its default marker images relative to its own CSS file,
// which breaks under a bundler — the standard fix is to delete the private
// `_getIconUrl` and hand Leaflet explicit URLs instead.
//
// Those URLs used to point at cdnjs. That made the PIN a third-party runtime
// dependency: on any network/browser that blocked the CDN the marker rendered
// as nothing at all, so tapping the map looked like it had done nothing even
// though the coordinates were captured correctly. These imports ship the same
// PNGs from the installed `leaflet` package through Vite, so the marker is
// part of our own bundle and works on any network.

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

/** The bundled image URLs, for callers that build their own `L.icon(...)`. */
export const MARKER_ICON_URLS = { iconUrl, iconRetinaUrl, shadowUrl };

let applied = false;

/** Point Leaflet's default icon at the bundled images. Safe to call repeatedly. */
export function applyDefaultLeafletIcon(): void {
  if (applied) return;
  applied = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions(MARKER_ICON_URLS);
}
