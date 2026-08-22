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
import { AlertTriangleIcon } from '../components/ui/Icons';

function movementBadgeVariant(type: MovementType) {
  switch (type) {
    case 'STOCK_IN': return 'info' as const;
    case 'TRANSFER': return 'neutral' as const;
    case 'SALE': return 'success' as const;
    case 'RETURN': return 'warning' as const;
    case 'DAMAGE':
    case 'LOSS': return 'danger' as const;
    default: return 'neutral' as const;
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

function SkelRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-3.5 rounded bg-[#F5F5F7] animate-pulse dark:bg-[#2C2C2E]" style={{ width: i === 0 ? '60%' : '40%' }} />
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

        {/* heading */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
            </h2>
            <p className="text-xs text-[#6E6E73]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={refresh} isLoading={refreshing}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            <AlertTriangleIcon size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* stats bar */}
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
              className={`rounded-xl border bg-white px-3 py-2.5 dark:bg-[#1C1C1E] ${
                stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                  ? 'border-[#FF3B30]/30 dark:border-[#FF453A]/30'
                  : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                  ? 'border-[#FF9F0A]/30 dark:border-[#FF9F0A]/30'
                  : 'border-[#E8E8ED] dark:border-[#38383A]'
              }`}
            >
              <p className="text-[10px] font-medium text-[#6E6E73]">{stat.label}</p>
              {stat.loading ? (
                <div className="mt-1 h-5 w-12 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
              ) : (
                <p className={`mt-0.5 text-base font-bold tabular-nums ${
                  stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                    ? 'text-[#FF3B30] dark:text-[#FF453A]'
                    : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                    ? 'text-[#FF9F0A]'
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}>
                  {stat.value ?? '—'}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* quick actions */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E8E8ED] bg-white px-4 py-3 dark:border-[#38383A] dark:bg-[#1C1C1E]">
          <span className="text-xs font-medium text-[#86868B] mr-1">Quick:</span>
          {[
            { label: '+ Receive', href: '/inventory' },
            { label: '⇄ Transfer', href: '/inventory' },
            { label: '$ Sell', href: '/inventory' },
            { label: '↩ Return', href: '/inventory' },
            { label: '⚠ Damage/Loss', href: '/inventory', danger: true },
          ].map((a) => (
            <Link key={a.label} href={a.href}>
              <Button variant={a.danger ? 'danger' : 'secondary'} size="sm">{a.label}</Button>
            </Link>
          ))}
          <span className="ml-auto text-[10px] text-[#86868B]">Select a product in Inventory to operate</span>
        </div>

        {/* two-column tables */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* stock alerts */}
          <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
            <div className="flex items-center justify-between border-b border-[#F5F5F7] px-4 py-2.5 dark:border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon size={14} className="text-[#FF9F0A]" />
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Stock Alerts</span>
                {!alertsLoading && alerts.length > 0 && (
                  <Badge variant="danger" size="sm">{alerts.length}</Badge>
                )}
              </div>
              <Link href="/inventory" className="text-[10px] font-semibold text-[#0071E3] hover:text-[#0077ED]">
                View all →
              </Link>
            </div>

            {alertsLoading ? (
              <table className="w-full text-xs"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkelRow key={i} cols={4} />)}</tbody></table>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#86868B]">All stock levels are healthy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F5F5F7] dark:border-[#2C2C2E]">
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">Product</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[#86868B]">Total</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[#86868B]">Min</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                    {alerts.map((a) => (
                      <tr key={a.product.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                        <td className="px-4 py-2">
                          <Link href={`/products/${a.product.id}`} className="font-medium text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                            {a.product.name}
                          </Link>
                          {a.product.category && (
                            <span className="ml-1 text-[#86868B]">· {a.product.category.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {a.inventory.totalQuantity}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#6E6E73]">
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
          <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
            <div className="flex items-center justify-between border-b border-[#F5F5F7] px-4 py-2.5 dark:border-[#2C2C2E]">
              <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Recent Movements</span>
              <Link href="/movements" className="text-[10px] font-semibold text-[#0071E3] hover:text-[#0077ED]">
                View all →
              </Link>
            </div>

            {movementsLoading ? (
              <table className="w-full text-xs"><tbody>{Array.from({ length: 5 }).map((_, i) => <SkelRow key={i} cols={5} />)}</tbody></table>
            ) : movements.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#86868B]">No movements recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F5F5F7] dark:border-[#2C2C2E]">
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">Type</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">Product</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[#86868B]">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B]">Flow</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#86868B] hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                        <td className="px-4 py-2">
                          <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                            {m.movementType.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium text-[#1D1D1F] dark:text-[#F5F5F7] max-w-[120px]">
                          <span className="truncate block">{m.product?.name ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">{m.quantity}</td>
                        <td className="px-3 py-2 text-[#6E6E73]">{locationFlow(m)}</td>
                        <td className="px-3 py-2 text-[#86868B] hidden sm:table-cell whitespace-nowrap">{formatDate(m.createdAt)}</td>
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
