'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StockMovementItem, MovementType, Location, PaginationMeta, Category } from '../../types/api';
import { inventoryService } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { MovementDetailsModal } from '../../components/inventory/MovementDetailsModal';
import { SearchIcon, AlertTriangleIcon } from '../../components/ui/Icons';
import { formatDate } from '../../lib/utils';

function movementBadgeVariant(type: MovementType): 'info' | 'neutral' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'STOCK_IN': return 'info';
    case 'TRANSFER': return 'neutral';
    case 'SALE': return 'success';
    case 'RETURN': return 'warning';
    case 'DAMAGE':
    case 'LOSS': return 'danger';
    case 'ADJUSTMENT': return 'warning';
    default: return 'neutral';
  }
}

function locationFlow(m: StockMovementItem): string {
  if (m.movementType === 'STOCK_IN') return `→ ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'TRANSFER') return `${m.fromLocation ?? 'WAREHOUSE'} → ${m.toLocation ?? 'SHOP'}`;
  if (m.movementType === 'SALE') return `${m.fromLocation ?? 'SHOP'} → SOLD`;
  if (m.movementType === 'RETURN') return `SOLD → ${m.toLocation ?? 'WAREHOUSE'}`;
  if (m.movementType === 'DAMAGE' || m.movementType === 'LOSS') return `${m.fromLocation ?? '—'} → —`;
  if (m.movementType === 'ADJUSTMENT') return m.fromLocation || m.toLocation || 'AUDIT';
  return [m.fromLocation, m.toLocation].filter(Boolean).join(' → ') || '—';
}

function adjustmentDirectionLabel(m: StockMovementItem): string | null {
  if (m.movementType !== 'ADJUSTMENT' || !m.note) return null;
  const noteLower = m.note.toLowerCase();
  if (noteLower.includes('surplus') || noteLower.includes('found') || noteLower.includes('+')) {
    return '+Surplus';
  }
  if (noteLower.includes('shortage') || noteLower.includes('missing') || noteLower.includes('-') || noteLower.includes('unaccounted')) {
    return '-Shortage';
  }
  return null;
}

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

function getDateRangeFromPreset(preset: DatePreset): { startDate?: string; endDate?: string } {
  const now = new Date();

  const formatDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  switch (preset) {
    case 'TODAY': {
      const todayStr = formatDateStr(now);
      return { startDate: todayStr, endDate: todayStr };
    }
    case 'YESTERDAY': {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = formatDateStr(yest);
      return { startDate: yestStr, endDate: yestStr };
    }
    case 'THIS_WEEK': {
      const dayOfWeek = now.getDay();
      const distanceToMon = (dayOfWeek + 6) % 7;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - distanceToMon);
      return { startDate: formatDateStr(startOfWeek), endDate: formatDateStr(now) };
    }
    case 'LAST_WEEK': {
      const dayOfWeek = now.getDay();
      const distanceToMon = (dayOfWeek + 6) % 7;
      const endOfLastWeek = new Date(now);
      endOfLastWeek.setDate(now.getDate() - distanceToMon - 1);
      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
      return { startDate: formatDateStr(startOfLastWeek), endDate: formatDateStr(endOfLastWeek) };
    }
    case 'THIS_MONTH': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDateStr(startOfMonth), endDate: formatDateStr(now) };
    }
    case 'LAST_MONTH': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: formatDateStr(startOfLastMonth), endDate: formatDateStr(endOfLastMonth) };
    }
    case 'ALL':
    default:
      return { startDate: undefined, endDate: undefined };
  }
}

function SkelRow() {
  return (
    <tr>
      {[16, 28, 10, 18, 14, 14, 10].map((w, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [locationFilter, setLocationFilter] = useState<Location | ''>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

  useEffect(() => {
    categoryService.getCategories().then((cats) => setCategories(cats || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMovements = useCallback(async () => {
    const currentReqId = ++reqIdRef.current;
    if (movements.length === 0) {
      setIsLoading(true);
    }
    setIsFetching(true);
    setError(null);
    try {
      const res = await inventoryService.getMovements({
        page,
        limit: 25,
        search: debouncedSearch.trim() || undefined,
        categoryId: categoryId || undefined,
        movementType: movementType || undefined,
        location: locationFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (currentReqId === reqIdRef.current) {
        setMovements(res.data ?? []);
        setMeta(res.meta);
      }
    } catch (e: unknown) {
      if (currentReqId === reqIdRef.current) {
        setError((e as { message?: string })?.message ?? 'Failed to load stock movements.');
      }
    } finally {
      if (currentReqId === reqIdRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [page, debouncedSearch, categoryId, movementType, locationFilter, startDate, endDate]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const handlePresetChange = (val: string) => {
    const preset = val as DatePreset;
    setDatePreset(preset);
    if (preset !== 'CUSTOM') {
      const { startDate: s, endDate: e } = getDateRangeFromPreset(preset);
      setStartDate(s || '');
      setEndDate(e || '');
      setPage(1);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('CUSTOM');
    setPage(1);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('CUSTOM');
    setPage(1);
  };

  const hasFilters = !!(debouncedSearch || categoryId || movementType || locationFilter || startDate || endDate);
  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setMovementType('');
    setLocationFilter('');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const selectCls = 'rounded-lg border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]';
  const inputCls = 'rounded-lg border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]';

  return (
    <AppShell>
      <div className="space-y-3">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Stock Movement Audit Log</h2>
            <p className="text-xs font-semibold text-[#64748B]">
              {isLoading ? 'Loading…' : `${meta.total} transaction record${meta.total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchMovements} isLoading={isLoading}>Refresh</Button>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-[#DC2626]/20 bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B] dark:border-[#DC2626]/20 dark:bg-[#450A0A] dark:text-[#F87171]">
            <div className="flex items-center gap-2"><AlertTriangleIcon size={14} />{error}</div>
            <Button variant="secondary" size="sm" onClick={fetchMovements}>Retry</Button>
          </div>
        )}

        {/* filter bar */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-2.5 shadow-xs dark:border-[#334155] dark:bg-[#1E293B] sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or brand…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#EFF6FF]/60 py-1.5 pl-8 pr-8 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] text-xs font-bold px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              size="sm"
              className="w-36"
              value={categoryId}
              placeholder="All Categories"
              options={[
                { label: 'All Categories', value: '' },
                ...categories.map((c) => ({ label: c.name, value: c.id })),
              ]}
              onChange={(val) => { setCategoryId(val); setPage(1); }}
            />

            <Select
              size="sm"
              className="w-36"
              value={movementType}
              placeholder="All Operations"
              options={[
                { label: 'All Operations', value: '' },
                { label: 'Stock In', value: 'STOCK_IN' },
                { label: 'Transfer', value: 'TRANSFER' },
                { label: 'Sale', value: 'SALE' },
                { label: 'Return', value: 'RETURN' },
                { label: 'Damage', value: 'DAMAGE' },
                { label: 'Loss', value: 'LOSS' },
                { label: 'Adjustment', value: 'ADJUSTMENT' },
              ]}
              onChange={(val) => { setMovementType(val as MovementType | ''); setPage(1); }}
            />

            <Select
              size="sm"
              className="w-32"
              value={locationFilter}
              placeholder="All Locations"
              options={[
                { label: 'All Locations', value: '' },
                { label: 'Warehouse', value: 'WAREHOUSE' },
                { label: 'Shop', value: 'SHOP' },
              ]}
              onChange={(val) => { setLocationFilter(val as Location | ''); setPage(1); }}
            />

            <Select
              size="sm"
              className="w-32"
              value={datePreset}
              placeholder="All Time"
              options={[
                { label: 'All Time', value: 'ALL' },
                { label: 'Today', value: 'TODAY' },
                { label: 'Yesterday', value: 'YESTERDAY' },
                { label: 'This Week', value: 'THIS_WEEK' },
                { label: 'Last Week', value: 'LAST_WEEK' },
                { label: 'This Month', value: 'THIS_MONTH' },
                { label: 'Last Month', value: 'LAST_MONTH' },
                { label: 'Custom Range', value: 'CUSTOM' },
              ]}
              onChange={handlePresetChange}
            />

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#86868B]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#86868B]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={inputCls}
              />
            </div>

            {hasFilters && (
              <button onClick={resetFilters} className="rounded-xl border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]">Clear</button>
            )}
          </div>
        </div>

        {/* table */}
        <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                  {['Date', 'Product', 'Operation', 'Qty', 'Location Flow', 'Performed By', ''].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkelRow key={i} />)
                  : movements.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <p className="text-xs text-[#86868B]">No stock movements found.{hasFilters && ' Try clearing filters.'}</p>
                        {hasFilters && <button onClick={resetFilters} className="mt-1 text-xs text-[#0071E3]">Clear filters</button>}
                      </td>
                    </tr>
                  )
                  : movements.map((m) => {
                    const adjDir = adjustmentDirectionLabel(m);

                    return (
                      <tr key={m.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                        <td className="px-3 py-2.5 text-[#86868B] whitespace-nowrap">{formatDate(m.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          {m.product
                            ? <Link href={`/products/${m.productId}`} className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">{m.product.name}</Link>
                            : <span className="text-[#86868B]">—</span>}
                          {m.product?.brand && <span className="ml-1 block text-[11px] text-[#86868B]">{m.product.brand}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                              {m.movementType.replace('_', ' ')}
                            </Badge>
                            {adjDir && (
                              <span className={`text-[10px] font-semibold ${adjDir.startsWith('+') ? 'text-[#30D158]' : 'text-[#FF3B30]'}`}>
                                {adjDir}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{m.quantity}</td>
                        <td className="px-3 py-2.5 font-medium text-[#6E6E73]">{locationFlow(m)}</td>
                        <td className="px-3 py-2.5 text-[#6E6E73]">{m.createdBy?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedMovementId(m.id)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* mobile view */}
          <div className={`divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] md:hidden transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse p-3 space-y-1.5">
                  <div className="h-3.5 w-3/5 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                  <div className="h-3 w-2/5 rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]" />
                </div>
              ))
              : movements.map((m) => {
                const adjDir = adjustmentDirectionLabel(m);

                return (
                  <div key={m.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={movementBadgeVariant(m.movementType)} size="sm">
                          {m.movementType.replace('_', ' ')}
                        </Badge>
                        {adjDir && (
                          <span className={`text-[10px] font-semibold ${adjDir.startsWith('+') ? 'text-[#30D158]' : 'text-[#FF3B30]'}`}>
                            {adjDir}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#86868B]">{formatDate(m.createdAt)}</span>
                    </div>

                    <div>
                      <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{m.product?.name ?? '—'}</p>
                      {m.product?.brand && <p className="text-[11px] text-[#86868B]">{m.product.brand}</p>}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-[#F5F5F7] px-3 py-2 text-xs dark:bg-[#2C2C2E]">
                      <span className="text-[#6E6E73]">Qty: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{m.quantity}</strong></span>
                      <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{locationFlow(m)}</span>
                      {m.createdBy && <span className="text-[#6E6E73]">by {m.createdBy.name}</span>}
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedMovementId(m.id)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
              <span className="text-xs text-[#6E6E73]">Page {meta.page} of {meta.totalPages} · {meta.total} records</span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Movement detail modal */}
      <MovementDetailsModal
        isOpen={!!selectedMovementId}
        movementId={selectedMovementId}
        onClose={() => setSelectedMovementId(null)}
      />
    </AppShell>
  );
}
