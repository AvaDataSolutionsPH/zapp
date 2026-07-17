import clsx from 'clsx';
import { Check } from 'lucide-react';

// ============================================================
// ZAPP Donuts ERP — CheckboxGroup
// ============================================================
//
// A tick-list of options. Built for the boss's Market Source request, which
// asked for a checklist that "should support both single-select and
// multi-select, depending on the use case" — hence the `multiple` prop:
//   • multiple (default) — any number of options may be ticked.
//   • single             — ticking one clears the rest (radio-like), but the
//                          same tap can also UN-tick (so the field can go empty).
//
// The value is always a string[] regardless of mode, so callers never branch on
// the mode when reading. Selection is controlled.

export interface CheckboxOption {
  value: string;
  label: string;
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  multiple = true,
  disabled = false,
  columns = 2,
}: {
  label?: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** true = many may be ticked; false = at most one (radio-like). */
  multiple?: boolean;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const toggle = (v: string) => {
    if (disabled) return;
    const isOn = value.includes(v);
    if (multiple) {
      onChange(isOn ? value.filter((x) => x !== v) : [...value, v]);
    } else {
      // Single mode: a second tap on the selected option clears it.
      onChange(isOn ? [] : [v]);
    }
  };

  const colClass =
    columns === 1 ? 'grid-cols-1' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      <div role="group" className={clsx('grid grid-cols-1 gap-1.5', colClass)}>
        {options.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={checked}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={clsx(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                checked
                  ? 'border-zapp-orange bg-zapp-orange/10 text-zapp-brown'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-zapp-orange/50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span
                className={clsx(
                  'flex h-4 w-4 shrink-0 items-center justify-center border',
                  multiple ? 'rounded' : 'rounded-full',
                  checked ? 'border-zapp-orange bg-zapp-orange text-white' : 'border-gray-300 bg-white',
                )}
              >
                {checked && <Check size={12} strokeWidth={3} />}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
