'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option…',
  disabled = false,
  className = '',
  size = 'md',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const py = size === 'sm' ? 'py-1.5 px-2.5 text-xs' : 'py-2 px-3 text-xs';

  return (
    <div ref={containerRef} className={`relative min-w-0 max-w-full ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-xl border border-[#D2D2D7] bg-white text-[#1D1D1F] transition-colors hover:border-[#0071E3]/50 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] disabled:bg-[#F5F5F7] disabled:text-[#86868B] ${py}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <span className="ml-1.5 shrink-0 text-[#86868B] text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 w-full max-w-full overflow-y-auto rounded-xl border border-[#E8E8ED] bg-white p-1 shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setOpen(false);
                }
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                opt.value === value
                  ? 'bg-[#0071E3] font-medium text-white'
                  : opt.disabled
                  ? 'text-[#86868B] opacity-50 cursor-not-allowed'
                  : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <span className="ml-2 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
