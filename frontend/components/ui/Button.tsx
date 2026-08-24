import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'inverted' | 'outlined' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}, ref) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const variants = {
    /* Primary Precision Blue (#2563EB) */
    primary:
      'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] focus:ring-[#2563EB]/40 shadow-xs font-semibold',
    /* Secondary Tinted (#EFF6FF) */
    secondary:
      'bg-[#EFF6FF] text-[#1E40AF] border border-[#DBEAFE] hover:bg-[#DBEAFE] focus:ring-[#2563EB]/30 dark:bg-[#1E293B] dark:text-[#93C5FD] dark:border-[#334155] dark:hover:bg-[#334155] font-semibold',
    /* Inverted Dark Slate (#1E293B) */
    inverted:
      'bg-[#1E293B] text-white hover:bg-[#0F172A] focus:ring-[#1E293B]/40 active:bg-[#0F172A] font-semibold',
    /* Outlined (#CBD5E1) */
    outlined:
      'bg-white text-[#2563EB] border border-[#CBD5E1] hover:bg-[#EFF6FF] hover:border-[#2563EB] focus:ring-[#2563EB]/30 dark:bg-[#1E293B] dark:text-[#60A5FA] dark:border-[#475569] font-semibold',
    /* Danger Red (#DC2626) */
    danger:
      'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus:ring-[#DC2626]/40 active:bg-[#991B1B] font-semibold',
    /* Ghost */
    ghost:
      'bg-transparent text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] focus:ring-[#2563EB]/30 dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs font-semibold gap-2',
    lg: 'px-5 py-2.5 text-sm font-semibold gap-2',
  };

  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" className="mr-1" />
          <span>Loading…</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
