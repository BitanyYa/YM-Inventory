import React from 'react';
import Link from 'next/link';
import { StockMovementItem, MovementType } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { MovementsIcon } from '../ui/Icons';
import { formatDate } from '../../lib/utils';

interface RecentMovementsWidgetProps {
  movements: StockMovementItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const RecentMovementsWidget: React.FC<RecentMovementsWidgetProps> = ({
  movements,
  isLoading,
  error,
  onRetry,
}) => {
  const getBadgeVariant = (type: MovementType) => {
    switch (type) {
      case 'STOCK_IN':
        return 'info';
      case 'TRANSFER':
        return 'neutral';
      case 'SALE':
        return 'success';
      case 'RETURN':
        return 'warning';
      case 'DAMAGE':
      case 'LOSS':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const formatLocationFlow = (m: StockMovementItem) => {
    const from = m.fromLocation || null;
    const to = m.toLocation || null;

    if (m.movementType === 'STOCK_IN') {
      return `To ${to || 'WAREHOUSE'}`;
    }
    if (m.movementType === 'TRANSFER') {
      return `${from || 'WAREHOUSE'} → ${to || 'SHOP'}`;
    }
    if (m.movementType === 'SALE') {
      return `${from || 'SHOP'} → SOLD`;
    }
    if (m.movementType === 'RETURN') {
      return `Returned to ${to || 'SHOP'}`;
    }
    if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') {
      return `${from || 'STORE'} → —`;
    }

    if (from && to) return `${from} → ${to}`;
    if (from) return `${from} → —`;
    if (to) return `→ ${to}`;
    return '—';
  };

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <MovementsIcon size={18} className="text-slate-700 dark:text-slate-300" />
          <span>Recent Activity</span>
        </div>
      }
      subtitle="Latest stock movements recorded in the system"
      action={
        <Link
          href="/movements"
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 underline"
        >
          View All
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-slate-100 p-3.5 dark:border-slate-800 animate-pulse"
            >
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-5 w-16 rounded-md bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/60 dark:bg-red-950/60">
          <p className="text-xs font-medium text-red-800 dark:text-red-300">
            {error}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            className="mt-3 text-xs"
          >
            Retry Loading Movements
          </Button>
        </div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <MovementsIcon size={20} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            No recent activity
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Stock movements will appear here as inventory activity occurs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white p-3.5 transition-colors hover:border-slate-200 dark:border-slate-800/80 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={getBadgeVariant(m.movementType)} size="sm">
                    {m.movementType.replace('_', ' ')}
                  </Badge>
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {m.product ? m.product.name : 'Product'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Qty: <strong className="text-slate-700 dark:text-slate-300">{m.quantity}</strong>
                  </span>
                  <span>•</span>
                  <span>{formatLocationFlow(m)}</span>
                  <span>•</span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
