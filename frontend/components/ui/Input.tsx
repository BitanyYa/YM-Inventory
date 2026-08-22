import React, { useId } from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:placeholder:text-[#48484A] ${
            error
              ? 'border-[#FF3B30] focus:ring-[#FF3B30]/40 focus:border-[#FF3B30]'
              : 'border-[#D2D2D7] dark:border-[#38383A]'
          } ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-xs text-[#FF3B30] dark:text-[#FF453A]">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-[#86868B]">{helperText}</span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
