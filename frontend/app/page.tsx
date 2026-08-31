'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { StockSummaryData, StockMovementItem, MovementType } from '../types/api';
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
    case 'ADJUSTMENT': return 'warning' as const;
    default: return 'neutral' as const;
  }
}

function locationFlow(m: StockMovementItem): string {
  if (m.movementType === 'STOCK_IN') return `→ ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'TRANSFER') return `${m.fromLocation ?? 'WAREHOUSE'} → ${m.toLocation ?? 'SHOP'}`;
  if (m.movementType === 'SALE') return `${m.fromLocation ?? 'SHOP'} → SOLD`;
  if (m.movementType === 'RETURN') return `→ ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') return m.fromLocation ?? '—';
  return [m.fromLocation, m.toLocation].filter(Boolean).join(' → ') || '—';
}

function SkelRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded bg-[#F1F5F9] animate-pulse dark:bg-[#334155]" style={{ width: i === 0 ? '60%' : '40%' }} />
        </td>
      ))}
    </tr>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<StockSummaryData | null>(null);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try { setSummary((await dashboardService.getSummary()).data); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Failed to load summary'); }
    finally { setSummaryLoading(false); }
  }, []);

  const fetchMovements = useCallback(async () => {
    setMovementsLoading(true);
    try { setMovements((await dashboardService.getRecentMovements(15)).data ?? []); }
    catch { /* non-critical */ }
    finally { setMovementsLoading(false); }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchSummary(), fetchMovements()]);
    setRefreshing(false);
  }, [fetchSummary, fetchMovements]);

  useEffect(() => { refresh(); }, [refresh]);

  const s = summary;

  return (
    <AppShell>
      <div className="space-y-4">

        {/* heading */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
            </h2>
            <p className="text-xs font-semibold text-[#64748B]">
              Precision Logistics & Repair · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={refresh} isLoading={refreshing}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-[#DC2626]/20 bg-[#FEE2E2] px-3 py-2 text-xs text-[#991B1B] dark:border-[#DC2626]/20 dark:bg-[#450A0A] dark:text-[#F87171]">
            <AlertTriangleIcon size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* stats bar */}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {[
            { label: 'Total Products', value: s?.products.total, loading: summaryLoading },
            { label: 'Warehouse Qty', value: s?.inventory.warehouseQuantity, loading: summaryLoading },
            { label: 'Shop Floor Qty', value: s?.inventory.shopQuantity, loading: summaryLoading },
            { label: 'Low Stock Alerts', value: s?.alerts.lowStockProducts, loading: summaryLoading, warn: true },
            { label: 'Out of Stock', value: s?.alerts.outOfStockProducts, loading: summaryLoading, danger: true },
            { label: 'Sales Revenue', value: s ? formatCurrency(s.sales.totalRevenue) : null, loading: summaryLoading },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border bg-white p-3 shadow-xs dark:bg-[#1E293B] ${
                stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                  ? 'border-[#DC2626]/30 dark:border-[#DC2626]/30 bg-[#FEE2E2]/20'
                  : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                  ? 'border-[#F59E0B]/30 dark:border-[#F59E0B]/30 bg-[#FEF3C7]/20'
                  : 'border-[#E2E8F0] dark:border-[#334155]'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{stat.label}</p>
              {stat.loading ? (
                <div className="mt-1.5 h-5 w-12 animate-pulse rounded bg-[#F1F5F9] dark:bg-[#334155]" />
              ) : (
                <p className={`mt-1 text-base font-extrabold tabular-nums ${
                  stat.danger && (s?.alerts.outOfStockProducts ?? 0) > 0
                    ? 'text-[#DC2626] dark:text-[#F87171]'
                    : stat.warn && (s?.alerts.lowStockProducts ?? 0) > 0
                    ? 'text-[#D97706] dark:text-[#FBBF24]'
                    : 'text-[#0F172A] dark:text-[#F8FAFC]'
                }`}>
                  {stat.value ?? '—'}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* quick actions */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-[#EFF6FF]/60 px-4 py-3 dark:border-[#334155] dark:bg-[#1E293B]">
          <span className="text-xs font-bold text-[#2563EB] mr-1">Quick Stock Actions:</span>
          {[
            { label: '+ Receive Stock', href: '/inventory' },
            { label: '⇄ Transfer to Shop', href: '/inventory' },
            { label: '$ Sell Item', href: '/inventory' },
            { label: '↩ Return Item', href: '/inventory' },
            { label: '⚠ Damage/Loss', href: '/inventory', danger: true },
          ].map((a) => (
            <Link key={a.label} href={a.href}>
              <Button variant={a.danger ? 'danger' : 'secondary'} size="sm">{a.label}</Button>
            </Link>
          ))}
          <span className="ml-auto text-[11px] font-semibold text-[#64748B]">Select product row in Inventory to perform operations</span>
        </div>

        {/* recent movements full width */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3 dark:border-[#334155]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Recent Movements</span>
            </div>
            <Link href="/movements" className="text-[11px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
              View All Movements →
            </Link>
          </div>

          {movementsLoading ? (
            <table className="w-full text-xs">
              <tbody>{Array.from({ length: 6 }).map((_, i) => <SkelRow key={i} cols={6} />)}</tbody>
            </table>
          ) : movements.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs font-semibold text-[#64748B]">No stock movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0F172A]">
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#64748B]">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#64748B]">Product</th>
                    <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-[#64748B]">Quantity</th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#64748B]">Flow</th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#64748B]">Logged By</th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#64748B]">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#EFF6FF]/40 dark:hover:bg-[#334155]/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                          {m.movementType.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/products/${m.product?.id}`} className="font-semibold text-[#0F172A] hover:text-[#2563EB] dark:text-[#F8FAFC]">
                          {m.product?.name ?? '—'}
                        </Link>
                        {[m.product?.brand, m.product?.category?.name].filter(Boolean).length > 0 && (
                          <span className="ml-1 text-[11px] text-[#64748B]">
                            · {[m.product?.brand, m.product?.category?.name].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {m.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B] font-medium">
                        {locationFlow(m)}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B] font-medium">
                        {m.createdBy?.name ?? 'System'}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B] whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
