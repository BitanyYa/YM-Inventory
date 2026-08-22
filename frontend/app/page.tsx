'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { StockSummaryData, InventoryAlert, StockMovementItem, MovementType } from '../types/api';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../lib/utils';
import { AlertTriangleIcon, SearchIcon } from '../components/ui/Icons';

/* ── movement badge ── */
function movementBadgeVariant(type: MovementType) {
  switch (type) {
    case 'STOCK_IN': return 'info';
    case 'TRANSFER': return 'neutral';
    case 'SALE': return 'success';
    case 'RETURN': return 'warning';
    case 'DAMAGE':
    case 'LOSS': return 'danger';
    default: return 'neutral';
  }
}

function locationFlow(m: StockMovementItem): string {
  if (m.movementType === 'STOCK_IN') return `→ ${m.toLocation ?? 'WH'}`;
  if (m.movementType === 'TRANSFER') return `${m.fromLocation ?? 'WH'} → ${m.toLocation ?? 'SHOP'}`;
  if (m.movementType === 'SALE') return `${m.fromLocation ?? 'SHOP'} → SOLD`;
  if (m.movementType === 'RETURN') return `→ ${m.toLocation ?? 'WH'}`;
  if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') return m.fromLocation ?? '—';
  return [m.fromLocation, m.toLocation].filter(Boolean).join(' → ') || '—';
}

/* ── skeleton row ── */
function SkelRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-3.5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: i === 0 ? '60%' : '40%' }} />
        </td>
      ))}
    </tr>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<StockSummaryData | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try { setSummary((await dashboardService.getSummary()).data); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Failed to load summary'); }
    finally { setSummaryLoading(false); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try { setAlerts((await dashboardService.getAlerts(8)).data ?? []); }
    catch { /* non-critical */ }
    finally { setAlertsLoading(false); }
  }, []);

  const fetchMovements = useCallback(async () => {
    setMovementsLoading(true);
    try { setMovements((await dashboardService.getRecentMovements(10)).data ?? []); }
    catch { /* non-critical */ }
    finally { setMovementsLoading(false); }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchSummary(), fetchAlerts(), fetchMovements()]);
    setRefreshing(false);
  }, [fetchSummary, fetchAlerts, fetchMovements]);

  useEffect(() => { refresh(); }, [refresh]);

  const s = summary;

  return (
    <AppShell>
      <div className="space-y-4">

        {/* ── page heading ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
            </h2>
            <p className="text-xs text-slate-500">Stock overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={refresh} isLoading={refreshing}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            <AlertTriangleIcon size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── compact stats bar ── */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { label: 'Total Products', value: s?.products.total, loading: summaryLoading },
            { label: 'Warehouse', value: s?.inventory.warehouseQuantity, loading: summaryLoading },
            { label: 'Shop Floor', value: s?.inventory.shopQuantity, loading: summaryLoading },
            { label: 'Low Stock', value: s?.alerts.lowStockProducts, loading: summaryLoading, warn: true },
            { label: 'Out of Stock', value: s?.alerts.outOfStockProducts, loading: summaryLoading, danger: true },
            { label: 'Sales Revenue', value: s ? formatCurrency(s.sales.totalRevenue) : null, loading: summaryLoading },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded border bg-white px-3 py-2.5 dark:bg-slate-900 ${
                stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                  ? 'border-red-200 dark:border-red-900/50'
                  : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                  ? 'border-amber-200 dark:border-amber-900/50'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
              {stat.loading ? (
                <div className="mt-1 h-5 w-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ) : (
                <p className={`mt-0.5 text-base font-bold tabular-nums ${
                  stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                    ? 'text-red-600 dark:text-red-400'
                    : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {stat.value ?? '—'}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── quick actions ── */}
        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Quick:</span>
          {[
            { label: '+ Receive', href: '/inventory' },
            { label: '⇄ Transfer', href: '/inventory' },
            { label: '$ Sell', href: '/inventory' },
            { label: '↩ Return', href: '/inventory' },
            { label: '⚠ Damage/Loss', href: '/inventory', danger: true },
          ].map((a) => (
            <Link key={a.label} href={a.href}>
              <Button
                variant={a.danger ? 'danger' : 'secondary'}
                size="sm"
              >
                {a.label}
              </Button>
            </Link>
          ))}
          <span className="ml-auto text-[10px] text-slate-400">Select a product in Inventory to operate</span>
        </div>

        {/* ── two column: alerts + movements ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* stock alerts */}
          <div className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon size={14} className="text-amber-500" />
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Stock Alerts</span>
                {!alertsLoading && alerts.length > 0 && (
                  <Badge variant="danger" size="sm">{alerts.length}</Badge>
                )}
              </div>
              <Link href="/inventory?stockStatus=LOW_STOCK" className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                View all →
              </Link>
            </div>

            {alertsLoading ? (
              <table className="w-full text-xs"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkelRow key={i} cols={4} />)}</tbody></table>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">All stock levels are healthy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Product</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-400">Total</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-400">Min</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {alerts.map((a) => (
                      <tr key={a.product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2">
                          <Link href={`/products/${a.product.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                            {a.product.name}
                          </Link>
                          {a.product.category && (
                            <span className="ml-1 text-slate-400">· {a.product.category.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {a.inventory.totalQuantity}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {a.product.minimumStock}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={a.stockStatus === 'OUT_OF_STOCK' ? 'danger' : 'warning'} size="sm">
                            {a.stockStatus === 'OUT_OF_STOCK' ? 'Out' : 'Low'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* recent movements */}
          <div className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Recent Movements</span>
              <Link href="/movements" className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                View all →
              </Link>
            </div>

            {movementsLoading ? (
              <table className="w-full text-xs"><tbody>{Array.from({ length: 5 }).map((_, i) => <SkelRow key={i} cols={4} />)}</tbody></table>
            ) : movements.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No movements recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Type</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Product</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Flow</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2">
                          <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                            {m.movementType.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 max-w-[120px]">
                          <span className="truncate block">{m.product?.name ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{m.quantity}</td>
                        <td className="px-3 py-2 text-slate-500">{locationFlow(m)}</td>
                        <td className="px-3 py-2 text-slate-400 hidden sm:table-cell whitespace-nowrap">{formatDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
