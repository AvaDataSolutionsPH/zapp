import { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange: (value: string) => void;
  debounce?: number;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  debounce = 300,
  placeholder = 'Search...',
  className,
  ...props
}: SearchInputProps) {
  const [internal, setInternal] = useState(controlledValue ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync controlled value. The setState-in-effect is required to mirror parent
  // changes into the internal debounce buffer; lifting state up would defeat
  // the debounce. Standard controlled-input pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (controlledValue !== undefined) setInternal(controlledValue);
  }, [controlledValue]);

  const handleChange = (val: string) => {
    setInternal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), debounce);
  };

  const handleClear = () => {
    setInternal('');
    onChange('');
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className={clsx('relative', className)}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange transition-colors"
        {...props}
      />
      {internal && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
