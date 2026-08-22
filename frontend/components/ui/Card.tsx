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
      className={`rounded-xl border border-[#D2D2D7] bg-white shadow-sm dark:border-[#38383A] dark:bg-[#1C1C1E] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-3.5 dark:border-[#2C2C2E]">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="border-t border-[#E8E8ED] bg-[#F5F5F7] px-5 py-3 dark:border-[#2C2C2E] dark:bg-[#2C2C2E]">
          {footer}
        </div>
      )}
    </div>
  );
};
