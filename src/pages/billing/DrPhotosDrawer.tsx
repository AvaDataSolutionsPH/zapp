// ============================================================
// DR Photos drawer (billing — view-only report verification)
// ============================================================
// Opened from a per-DR row on the billing user's Billing page so billing can
// pull up the Beginning DR slip + Beginning/Ending donut-crate photos captured
// by the store for that delivery, and double-check that the store's reported
// inventory is correct. Read-only — mirrors the "Delivery Photos" section of
// DeliveryDetailDrawer (same fields, same signed-URL rendering), scoped to a
// single delivery/DR.

import { ImageOff } from 'lucide-react';
import { Drawer } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { useStorageUrl } from '@/lib/useStorageUrl';

// View-only thumbnail for a stored photo ref (private-bucket refs are re-signed
// on render via useStorageUrl). Its own component so the hook runs once per
// image instead of inside a bare .map(). Click opens the full-size image.
function StoragePhoto({ imageRef, alt }: { imageRef: string; alt: string }) {
  const url = useStorageUrl(imageRef);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
      title={alt}
    >
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <ImageOff size={20} />
        </div>
      )}
    </a>
  );
}

export interface DrPhotoTarget {
  deliveryId: string;
  drNumber: string;
  date: string;      // pre-formatted display string
  shopName: string;
}

interface DrPhotosDrawerProps {
  target: DrPhotoTarget | null;
  onClose: () => void;
}

export default function DrPhotosDrawer({ target, onClose }: DrPhotosDrawerProps) {
  const { beginningInventories, endingInventories } = useStore();

  if (!target) {
    return <Drawer open={false} onClose={onClose} />;
  }

  // Evidence captured during inventory for this delivery. DR slip + crate photos
  // live on the Beginning Inventory; the Ending Inventory adds its own crates.
  const beginningInv = beginningInventories.find((bi) => bi.deliveryId === target.deliveryId);
  const endingInv = endingInventories.find((ei) => ei.deliveryId === target.deliveryId);
  const drSlipRef = beginningInv?.drImageUrl;
  const beginningCratePhotos = beginningInv?.crateImageUrls ?? [];
  const endingCratePhotos = endingInv?.crateImageUrls ?? [];
  const hasPhotos =
    !!drSlipRef || beginningCratePhotos.length > 0 || endingCratePhotos.length > 0;

  return (
    <Drawer open={!!target} onClose={onClose} title={`DR Photos — ${target.drNumber}`} width="max-w-xl">
      <div className="space-y-6">
        {/* Context header */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">DR Number</p>
            <p className="font-medium text-gray-900 font-mono">{target.drNumber}</p>
          </div>
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-900">{target.date}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">Shop</p>
            <p className="font-medium text-gray-900">{target.shopName}</p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          View-only evidence captured by the store for this DR. Use it to
          double-check that the store's reported inventory is correct.
        </p>

        {hasPhotos ? (
          <div className="space-y-4">
            {drSlipRef && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Beginning DR Slip</p>
                <div className="grid grid-cols-3 gap-2">
                  <StoragePhoto imageRef={drSlipRef} alt="Beginning DR slip" />
                </div>
              </div>
            )}

            {beginningCratePhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Beginning Crate Photos ({beginningCratePhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {beginningCratePhotos.map((ref, i) => (
                    <StoragePhoto key={`bi-${i}`} imageRef={ref} alt={`Beginning crate photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}

            {endingCratePhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Ending Crate Photos ({endingCratePhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {endingCratePhotos.map((ref, i) => (
                    <StoragePhoto key={`ei-${i}`} imageRef={ref} alt={`Ending crate photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
            <ImageOff size={22} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              Wala pang naka-upload na photo para sa DR na ito.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Lalabas dito ang Beginning DR slip at donut-crate photos kapag nag-submit
              na ng inventory ang store.
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
