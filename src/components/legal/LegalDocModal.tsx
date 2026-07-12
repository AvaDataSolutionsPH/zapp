// ============================================================
// ZAPP Donuts ERP - LegalDocModal
// ============================================================
//
// Read-only, scrollable modal that renders one legal document
// (Consignment Agreement / Privacy Notice / Terms of Use).
//
// Self-contained (its own fixed overlay) so it works identically on
// the public /apply flow and inside the dashboard onboarding form,
// without depending on the dashboard's Modal chrome.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LEGAL_DOCS, type LegalDocKey } from '@/data/legalContent';

interface LegalDocModalProps {
  /** Which document to show, or null when closed. */
  docKey: LegalDocKey | null;
  onClose: () => void;
}

export default function LegalDocModal({ docKey, onClose }: LegalDocModalProps) {
  // Close on Escape.
  useEffect(() => {
    if (!docKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docKey, onClose]);

  if (!docKey) return null;
  const doc = LEGAL_DOCS[docKey];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{doc.title}</h2>
            {doc.meta && <p className="mt-0.5 text-xs text-gray-500">{doc.meta}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5">
          <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {doc.body}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-zapp-orange px-4 py-2 text-sm font-semibold text-white hover:bg-zapp-orange/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
