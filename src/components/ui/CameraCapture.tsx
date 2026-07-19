// ============================================================
// ZAPP Donuts ERP — In-app camera capture
// ============================================================
//
// A real camera, not a file picker.
//
// WHY THIS EXISTS. `FileUpload` used `<input capture="environment">`. That
// attribute is a HINT that only phones honour — on a desktop browser it is
// ignored entirely and the button opens the file dialog. The boss pressed "Use
// Camera" on a laptop, got his Downloads folder, and reported the camera as
// broken. It was not broken; it never existed on desktop.
//
// The ask was "tanggalin mo na download. use camera lang para actual talaga" —
// the point being that a verification photo must be taken NOW, not chosen from
// whatever image is already on the device.
//
// So this opens the live camera via getUserMedia, on desktop and phone alike,
// and hands back a File built from a single frame.
//
// ⚠️ It cannot be the ONLY path. getUserMedia needs a secure context (https or
// localhost) and can be refused by hardware, by permission, or by an in-app
// browser. Removing the file fallback outright would leave those users with no
// way to submit at all — so `FileUpload` reveals the picker only when the camera
// genuinely cannot run, and says why.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** 'environment' = rear (documents, crates), 'user' = front (selfie). */
  facingMode?: 'environment' | 'user';
  /** Shown above the preview so the person knows what to frame. */
  hint?: string;
  /**
   * Fired when the camera cannot run at all (no hardware, blocked permission).
   * The parent uses this to re-open the file picker, so a person without a
   * working camera is never left with no way to submit.
   */
  onUnavailable?: () => void;
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  facingMode = 'environment',
  hint,
  onUnavailable,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // ⚠️ Held in a ref, NOT read directly in `start`. Callers pass an inline
  // arrow, so a direct dependency gives `start` a new identity every parent
  // render; the open/start effect then re-runs on every render, tearing the
  // stream down and calling setShot(null) — which wiped the photo the instant
  // it was taken and left the camera restarting in a loop.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  // Releasing the track is not optional — an unreleased camera keeps the
  // recording indicator lit and blocks other apps from opening the device.
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      // Distinguish the two cases the user can act on: a refused permission is
      // fixable in the browser, missing hardware is not.
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Naka-block ang camera. Payagan ito sa browser settings, tapos subukan ulit.'
          : 'Walang magamit na camera sa device na ito.',
      );
      stop();
      onUnavailableRef.current?.();
    } finally {
      setStarting(false);
    }
  }, [facingMode, stop]);

  useEffect(() => {
    if (open) {
      setShot(null);
      void start();
    } else {
      stop();
    }
    return stop;
  }, [open, start, stop]);

  const take = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    // Capture at the sensor's own resolution — scaling to the CSS box would
    // hand the reviewer a photo too small to read an ID from.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setShot(canvas.toDataURL('image/jpeg', 0.92));
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        // Timestamped name so several captures in one session never collide.
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        stop();
        onClose();
      },
      'image/jpeg',
      0.92,
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Camera size={16} className="text-zapp-orange" /> Kunan ng Litrato
          </h3>
          <button
            type="button"
            onClick={() => { stop(); onClose(); }}
            className="cursor-pointer rounded-lg border-none bg-transparent p-1 text-gray-400 hover:text-gray-600"
            aria-label="Isara"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {hint && <p className="mb-3 text-xs text-gray-500">{hint}</p>}

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-4 text-sm text-red-700">{error}</div>
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-black">
              {/* Both stay mounted: the video must keep streaming behind the
                  still so "Ulitin" can go straight back to a live preview. */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={shot ? 'hidden' : 'block max-h-[60vh] w-full object-contain'}
              />
              {shot && (
                <img src={shot} alt="Nakuhang litrato" className="block max-h-[60vh] w-full object-contain" />
              )}
              {starting && !shot && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  Binubuksan ang camera…
                </p>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {!error && (
            <div className="mt-4 flex justify-end gap-2">
              {shot ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShot(null)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw size={15} /> Ulitin
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-zapp-orange px-3 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark"
                  >
                    <Check size={15} /> Gamitin ito
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={take}
                  disabled={starting}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-zapp-orange px-4 py-2 text-sm font-medium text-white hover:bg-zapp-orange-dark disabled:opacity-50"
                >
                  <Camera size={15} /> Kunan
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
