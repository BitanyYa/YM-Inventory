import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    /* Apple Blue — primary action */
    primary:
      'bg-[#0071E3] text-white hover:bg-[#0077ED] focus:ring-[#0071E3]/40 active:bg-[#006CD6]',
    /* Apple system gray — secondary/tonal */
    secondary:
      'bg-white text-[#1D1D1F] border border-[#D2D2D7] hover:bg-[#F5F5F7] focus:ring-[#0071E3]/30 active:bg-[#E8E8ED] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:border-[#38383A] dark:hover:bg-[#3A3A3C]',
    /* Apple Red */
    danger:
      'bg-[#FF3B30] text-white hover:bg-[#E6362B] focus:ring-[#FF3B30]/40 active:bg-[#CC302B]',
    /* Ghost — no background */
    ghost:
      'bg-transparent text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] focus:ring-[#0071E3]/30 dark:text-[#98989D] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-[15px] gap-2',
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
