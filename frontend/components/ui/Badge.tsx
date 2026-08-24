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
    /* Slate neutral */
    neutral:
      'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] dark:bg-[#334155] dark:text-[#E2E8F0] dark:border-[#475569]',
    /* Emerald tertiary green */
    success:
      'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] dark:bg-[#022C22] dark:text-[#34D399] dark:border-[#065F46]',
    /* Amber secondary gold */
    warning:
      'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] dark:bg-[#451A03] dark:text-[#FBBF24] dark:border-[#78350F]',
    /* Red danger */
    danger:
      'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] dark:bg-[#450A0A] dark:text-[#F87171] dark:border-[#7F1D1D]',
    /* Precision Blue info */
    info:
      'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#60A5FA] dark:border-[#1E3A8A]',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-md',
    md: 'px-2.5 py-0.5 text-xs font-semibold tracking-wide rounded-lg',
  };

  return (
    <span
      className={`inline-flex items-center justify-center ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
