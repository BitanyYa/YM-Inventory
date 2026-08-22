'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dashboardService } from '../../services/dashboard.service';
import { StockMovementItem, MovementType, PaginationMeta } from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SearchIcon, AlertTriangleIcon } from '../../components/ui/Icons';
import { formatDate } from '../../lib/utils';
import { apiClient } from '../../lib/api-client';

/* re-use apiClient directly for paginated movements — dashboard service only fetches 5 */
interface MovementsResponse {
  data: StockMovementItem[];
  meta: PaginationMeta;
}

function movementBadgeVariant(type: MovementType): 'info' | 'neutral' | 'success' | 'warning' | 'danger' {
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

function SkelRow() {
  return (
    <tr>
      {[18, 40, 12, 18, 20, 22].map((w, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMovements = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      q.append('page', page.toString());
      q.append('limit', '25');
      if (debouncedSearch.trim()) q.append('search', debouncedSearch.trim());
      if (movementType) q.append('movementType', movementType);
      const res = await apiClient<MovementsResponse>(`/stock/movements?${q.toString()}`);
      setMovements(res.data ?? []);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Failed to load movements.');
    } finally { setIsLoading(false); }
  }, [page, debouncedSearch, movementType]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const hasFilters = !!(debouncedSearch || movementType);
  const resetFilters = () => { setSearch(''); setMovementType(''); setPage(1); };

  return (
    <AppShell>
      <div className="space-y-3">

        {/* ── header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Movements</h2>
            <p className="text-xs text-slate-500">
              {isLoading ? 'Loading…' : `${meta.total} record${meta.total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchMovements} isLoading={isLoading}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            <div className="flex items-center gap-2"><AlertTriangleIcon size={14} />{error}</div>
            <Button variant="secondary" size="sm" onClick={fetchMovements}>Retry</Button>
          </div>
        )}

        {/* ── filter bar ── */}
        <div className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex gap-1.5">
            <select
              value={movementType}
              onChange={(e) => { setMovementType(e.target.value as MovementType | ''); setPage(1); }}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">All Types</option>
              <option value="STOCK_IN">Stock In</option>
              <option value="TRANSFER">Transfer</option>
              <option value="SALE">Sale</option>
              <option value="RETURN">Return</option>
              <option value="DAMAGE">Damage</option>
              <option value="LOSS">Loss</option>
            </select>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── table ── */}
        <div className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {/* desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                  {['Type', 'Product', 'Qty', 'Flow', 'By', 'Date'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkelRow key={i} />)
                  : movements.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <p className="text-xs text-slate-400">No movements found.{hasFilters && ' Try clearing filters.'}</p>
                        {hasFilters && <button onClick={resetFilters} className="mt-1 text-xs text-slate-700 underline">Clear filters</button>}
                      </td>
                    </tr>
                  )
                  : movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5">
                        <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                          {m.movementType.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {m.product ? (
                          <Link href={`/products/${m.productId}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                            {m.product.name}
                          </Link>
                        ) : <span className="text-slate-400">—</span>}
                        {m.product?.brand && <span className="ml-1 text-slate-400">· {m.product.brand}</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-800 dark:text-slate-200">{m.quantity}</td>
                      <td className="px-3 py-2.5 text-slate-500">{locationFlow(m)}</td>
                      <td className="px-3 py-2.5 text-slate-500">{m.createdBy?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse p-3 space-y-1.5">
                  <div className="h-3.5 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
              : movements.map((m) => (
                <div key={m.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                      {m.movementType.replace('_', ' ')}
                    </Badge>
                    <span className="text-[11px] text-slate-400">{formatDate(m.createdAt)}</span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {m.product?.name ?? '—'}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>Qty: <strong className="text-slate-700 dark:text-slate-300">{m.quantity}</strong></span>
                    <span>{locationFlow(m)}</span>
                    {m.createdBy && <span>by {m.createdBy.name}</span>}
                  </div>
                  {m.note && <p className="text-[11px] text-slate-400 italic">{m.note}</p>}
                </div>
              ))}
          </div>

          {/* pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <span className="text-xs text-slate-500">
                Page {meta.page} of {meta.totalPages} · {meta.total} records
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
