import React, { useId } from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, rightElement, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
          >
            {label}
          </label>
        )}
        <div className="relative w-full">
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-[#EFF6FF]/50 px-3 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:placeholder:text-[#64748B] ${
              rightElement ? 'pr-9' : ''
            } ${
              error
                ? 'border-[#DC2626] focus:ring-[#DC2626]/40 focus:border-[#DC2626]'
                : 'border-[#CBD5E1] dark:border-[#475569]'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <span className="text-xs text-[#DC2626] dark:text-[#F87171]">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-[#64748B]">{helperText}</span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
