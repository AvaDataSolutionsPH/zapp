import { useState, useCallback, useRef, useEffect, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (variant: ToastVariant, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Sound (Web Audio — no asset files needed)                          */
/* ------------------------------------------------------------------ */

// Two-tone rising chime for success, falling tone for error, single
// soft beep for info / warning. Synthesized via Web Audio API so we
// don't ship any audio assets. Browsers gate audio behind a user
// gesture — addToast is always called from a click handler, so the
// gesture is satisfied.
const TONES: Record<ToastVariant, number[]> = {
  success: [523.25, 783.99], // C5 → G5
  error: [415.3, 311.13],    // G#4 → D#4
  warning: [659.25],          // E5
  info: [523.25],             // C5
};

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  const Ctor =
    window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
  if (!Ctor) return null;
  sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

function playToastSound(variant: ToastVariant): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const sequence = TONES[variant];
  sequence.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + 0.18);
    osc.start(start);
    osc.stop(start + 0.2);
  });
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

// The hook is intentionally co-located with its provider so consumers import
// both from the same module path. Splitting would force every consumer to
// update imports.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (variant: ToastVariant, message: string, duration = 4000) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
      playToastSound(variant);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Single Toast                                                       */
/* ------------------------------------------------------------------ */

const iconMap: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-yellow-500" />,
  info: <Info size={18} className="text-blue-500" />,
};

const bgMap: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
  info: 'border-blue-200 bg-blue-50',
};

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(onRemove, toast.duration);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.duration, onRemove]);

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 rounded-lg border p-3 shadow-lg animate-in slide-in-from-right fade-in duration-300 min-w-[300px] max-w-md bg-white',
        bgMap[toast.variant]
      )}
    >
      <span className="shrink-0 mt-0.5">{iconMap[toast.variant]}</span>
      <p className="flex-1 text-sm text-gray-800">{toast.message}</p>
      <button
        onClick={onRemove}
        className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Container                                                          */
/* ------------------------------------------------------------------ */

function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext)!;

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[100] flex flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
