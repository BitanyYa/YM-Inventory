import React from 'react';
import Link from 'next/link';
import { InventoryAlert } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AlertTriangleIcon } from '../ui/Icons';

interface StockAlertsWidgetProps {
  alerts: InventoryAlert[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const StockAlertsWidget: React.FC<StockAlertsWidgetProps> = ({
  alerts,
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <AlertTriangleIcon size={18} className="text-amber-500" />
          <span>Stock Alerts</span>
        </div>
      }
      subtitle="Products requiring immediate reorder or stock replenishment"
      action={
        !isLoading && alerts.length > 0 ? (
          <Badge variant="danger" size="sm">
            {alerts.length} Action Needed
          </Badge>
        ) : null
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
                <div className="h-4 w-36 rounded-md bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-20 rounded-md bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-6 w-20 rounded-md bg-slate-200 dark:bg-slate-800" />
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
            Retry Loading Alerts
          </Button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            ✓
          </div>
          <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            All stock levels look good
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            No low-stock or out-of-stock products currently need attention.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isOutOfStock =
              alert.stockStatus === 'OUT_OF_STOCK' ||
              alert.inventory.totalQuantity === 0;

            return (
              <div
                key={alert.product.id}
                className={`flex flex-col gap-2 rounded-lg border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isOutOfStock
                    ? 'border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/30'
                    : 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${alert.product.id}`}
                    className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100"
                  >
                    {alert.product.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{alert.product.brand}</span>
                    <span>•</span>
                    <span>
                      Stock: <strong>{alert.inventory.totalQuantity}</strong> /{' '}
                      {alert.product.minimumStock} min
                    </span>
                    {alert.shortage > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          Shortage: {alert.shortage}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <Badge
                    variant={isOutOfStock ? 'danger' : 'warning'}
                    size="sm"
                  >
                    {isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
