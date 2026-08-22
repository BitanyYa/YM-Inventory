import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variants = {
    /* Apple gray */
    neutral:
      'bg-[#E8E8ED] text-[#1D1D1F] dark:bg-[#3A3A3C] dark:text-[#F5F5F7]',
    /* Apple green */
    success:
      'bg-[#E9F9EE] text-[#1A7A3A] dark:bg-[#0A2E1A] dark:text-[#30D158]',
    /* Apple orange */
    warning:
      'bg-[#FFF4E0] text-[#995E00] dark:bg-[#2E1E00] dark:text-[#FF9F0A]',
    /* Apple red */
    danger:
      'bg-[#FFECEB] text-[#CC2B22] dark:bg-[#2E0A09] dark:text-[#FF453A]',
    /* Apple blue/teal */
    info:
      'bg-[#EBF8FE] text-[#005A99] dark:bg-[#00263A] dark:text-[#5AC8FA]',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
    md: 'px-2 py-0.5 text-xs font-semibold tracking-wide',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
