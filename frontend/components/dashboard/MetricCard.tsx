import React from 'react';
import { Card } from '../ui/Card';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  accentColor?: string; // e.g. 'border-l-slate-900', 'border-l-emerald-500', 'border-l-amber-500'
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  badge,
  accentColor = 'border-l-slate-900 dark:border-l-slate-100',
  isLoading = false,
}) => {
  return (
    <Card className={`border-l-4 ${accentColor} p-4 sm:p-5 shadow-2xs`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2.5">
        {isLoading ? (
          <div className="h-7 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {value}
            </span>
            {badge && <div>{badge}</div>}
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-1.5">
          {isLoading ? (
            <div className="h-3 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
