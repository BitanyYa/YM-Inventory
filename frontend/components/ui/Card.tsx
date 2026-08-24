import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  footer,
}) => {
  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white shadow-xs transition-shadow dark:border-[#334155] dark:bg-[#1E293B] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-3.5 dark:border-[#334155]">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-5 py-3 dark:border-[#334155] dark:bg-[#0F172A] rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
};
