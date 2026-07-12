// ============================================================
// ZAPP Donuts ERP - LegalConsent
// ============================================================
//
// Registration-form consent block. Per the ZAPP Donuts design:
//   - DO NOT dump the full legal text inline on the form.
//   - Show clickable "Privacy Notice" and "Terms and Conditions"
//     links that open the full document in a modal.
//   - A single checkbox: "I agree to the ZAPP Donuts Consignment
//     Agreement" (the Agreement itself is also a clickable link).
//
// Used by both the public /apply form and the internal Franchisee
// Onboarding form. The checkbox state lives in the parent; this
// component owns only the which-doc-is-open modal state.

import { useState } from 'react';
import type { LegalDocKey } from '@/data/legalContent';
import LegalDocModal from './LegalDocModal';

interface LegalConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  /**
   * When true, phrase the checkbox as an admin confirming on the
   * franchisee's behalf (internal onboarding) instead of first-person.
   */
  confirmingForOther?: boolean;
  className?: string;
}

export default function LegalConsent({
  checked,
  onChange,
  error,
  confirmingForOther = false,
  className = '',
}: LegalConsentProps) {
  const [openDoc, setOpenDoc] = useState<LegalDocKey | null>(null);

  const linkClass =
    'font-semibold text-zapp-orange underline underline-offset-2 hover:text-zapp-orange/80';

  return (
    <div className={`rounded-xl border border-gray-200 bg-gray-50 p-5 ${className}`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-zapp-orange focus:ring-zapp-orange"
        />
        <span className="text-sm text-gray-700">
          {confirmingForOther ? (
            <>
              I confirm the franchisee has read and agreed to the ZAPP Donuts{' '}
            </>
          ) : (
            <>I agree to the ZAPP Donuts{' '}</>
          )}
          <button type="button" onClick={() => setOpenDoc('consignment')} className={linkClass}>
            Consignment Agreement
          </button>
          .
        </span>
      </label>

      <p className="mt-3 pl-7 text-xs text-gray-500">
        Please review our{' '}
        <button type="button" onClick={() => setOpenDoc('privacy')} className={linkClass}>
          Privacy Notice
        </button>{' '}
        and{' '}
        <button type="button" onClick={() => setOpenDoc('terms')} className={linkClass}>
          Terms and Conditions
        </button>
        .
      </p>

      {error && <p className="mt-2 pl-7 text-xs text-red-600">{error}</p>}

      <LegalDocModal docKey={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
}
