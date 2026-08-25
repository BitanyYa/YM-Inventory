'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { UnitDetailsModal } from '../../components/products/UnitDetailsModal';
import { productService } from '../../services/product.service';
import { categoryService } from '../../services/category.service';
import { Category, ProductType, Location, ProductUnitItem, PaginationMeta } from '../../types/api';
import { formatCurrency } from '../../lib/utils';
import { SearchIcon, AlertTriangleIcon } from '../../components/ui/Icons';

type UnitStatusFilter = 'ALL' | 'AVAILABLE' | 'IN_SHOP' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'UNACCOUNTED';

function unitStatusVariant(status: string) {
  switch (status) {
    case 'AVAILABLE': return 'success' as const;
    case 'IN_SHOP': return 'info' as const;
    case 'SOLD': return 'neutral' as const;
    case 'RETURNED': return 'warning' as const;
    case 'DAMAGED':
    case 'UNACCOUNTED': return 'danger' as const;
    default: return 'neutral' as const;
  }
}

function unitStatusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'Available';
    case 'IN_SHOP': return 'In Shop';
    case 'SOLD': return 'Sold';
    case 'RETURNED': return 'Returned';
    case 'DAMAGED': return 'Damaged';
    case 'UNACCOUNTED': return 'Unaccounted';
    default: return status.replace('_', ' ');
  }
}

function SkelRow() {
  return (
    <tr className="border-b border-[#F1F5F9] dark:border-[#334155]">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3.5 py-3">
          <div className="h-4 animate-pulse rounded bg-[#EFF6FF]/60 dark:bg-[#334155]" style={{ width: i === 0 ? '70%' : '50%' }} />
        </td>
      ))}
    </tr>
  );
}

export default function UnitsPage() {
  const [units, setUnits] = useState<ProductUnitItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  /* ── Filter state ── */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>('ALL');
  const [locationFilter, setLocationFilter] = useState<Location | ''>('');
  const [productTypeFilter, setProductTypeFilter] = useState<ProductType | ''>('');
  const [categoryIdFilter, setCategoryIdFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  /* ── UI state ── */
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Modal state ── */
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  /* ── Debounce search input ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Fetch categories on mount ── */
  useEffect(() => {
    categoryService.getCategories().then(setCategories).catch(() => { /* non-critical */ });
  }, []);

  /* ── Fetch units ── */
  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isImeiOrSerial = /^[a-zA-Z0-9]{6,}$/.test(debouncedSearch.trim());
      const res = await productService.getUnits({
        imei: isImeiOrSerial ? debouncedSearch.trim() : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        location: locationFilter || undefined,
      });

      let items = res.data ?? [];

      // Client-side filtering by search, productType, and categoryId
      if (debouncedSearch.trim()) {
        const queryLower = debouncedSearch.trim().toLowerCase();
        items = items.filter((u) => {
          const imeiMatch = u.imei?.toLowerCase().includes(queryLower);
          const serialMatch = u.serialNumber?.toLowerCase().includes(queryLower);
          const nameMatch = u.product?.name?.toLowerCase().includes(queryLower);
          const brandMatch = u.product?.brand?.toLowerCase().includes(queryLower);
          return imeiMatch || serialMatch || nameMatch || brandMatch;
        });
      }

      if (productTypeFilter) {
        items = items.filter((u) => u.product?.productType === productTypeFilter);
      }

      if (categoryIdFilter) {
        items = items.filter((u) => u.product?.category?.id === categoryIdFilter);
      }

      setUnits(items);
      setMeta({
        page,
        limit: 20,
        total: items.length,
        totalPages: Math.ceil(items.length / 20) || 1,
      });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load serialized units.');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, locationFilter, productTypeFilter, categoryIdFilter]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const hasFilters = !!(search || statusFilter !== 'ALL' || locationFilter || productTypeFilter || categoryIdFilter);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setLocationFilter('');
    setProductTypeFilter('');
    setCategoryIdFilter('');
    setPage(1);
  };

  const handleViewUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
    setIsDetailOpen(true);
  };

  const selectCls =
    'rounded-xl border border-[#CBD5E1] bg-[#EFF6FF]/60 px-3 py-1.5 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC]';

  return (
    <AppShell>
      <div className="space-y-3.5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Units & IMEI</h2>
            <p className="text-xs font-semibold text-[#64748B]">
              Track serialized devices and their lifecycle {meta.total > 0 ? `(${meta.total} unit${meta.total !== 1 ? 's' : ''})` : ''}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchUnits} isLoading={isLoading}>
            Refresh
          </Button>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-[#DC2626]/20 bg-[#FEE2E2] px-3.5 py-2 text-xs font-semibold text-[#991B1B] dark:border-[#DC2626]/20 dark:bg-[#450A0A] dark:text-[#F87171]">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon size={14} className="shrink-0" />
              {error}
            </div>
            <Button variant="secondary" size="sm" onClick={fetchUnits}>
              Retry
            </Button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-2.5 shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

            {/* Search Input */}
            <div className="relative flex-1">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search IMEI, serial, product or brand..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#EFF6FF]/60 py-1.5 pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] dark:border-[#475569] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                size="sm"
                className="w-32"
                value={statusFilter}
                placeholder="All Statuses"
                options={[
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'Available', value: 'AVAILABLE' },
                  { label: 'In Shop', value: 'IN_SHOP' },
                  { label: 'Sold', value: 'SOLD' },
                  { label: 'Returned', value: 'RETURNED' },
                  { label: 'Damaged', value: 'DAMAGED' },
                  { label: 'Unaccounted', value: 'UNACCOUNTED' },
                ]}
                onChange={(val) => { setStatusFilter(val as UnitStatusFilter); setPage(1); }}
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
                value={productTypeFilter}
                placeholder="All Types"
                options={[
                  { label: 'All Types', value: '' },
                  { label: 'Phone', value: 'PHONE' },
                  { label: 'Tablet', value: 'TABLET' },
                  { label: 'Laptop', value: 'LAPTOP' },
                  { label: 'Smart Watch', value: 'SMART_WATCH' },
                  { label: 'Accessory', value: 'ACCESSORY' },
                  { label: 'Other', value: 'OTHER' },
                ]}
                onChange={(val) => { setProductTypeFilter(val as ProductType | ''); setPage(1); }}
              />

              <Select
                size="sm"
                className="w-36"
                value={categoryIdFilter}
                placeholder="All Categories"
                options={[
                  { label: 'All Categories', value: '' },
                  ...categories.map((c) => ({ label: c.name, value: c.id })),
                ]}
                onChange={(val) => { setCategoryIdFilter(val); setPage(1); }}
              />

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Units Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A]">
                <th className="px-4 py-3">IMEI / Serial</th>
                <th className="px-3.5 py-3">Product</th>
                <th className="px-3.5 py-3">Category</th>
                <th className="px-3.5 py-3">Specs</th>
                <th className="px-3.5 py-3">Location</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3 text-right">Purchase Price</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkelRow key={i} />)
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-xs font-semibold text-[#64748B]">No serialized units found.</p>
                    {hasFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-2 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8]"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                units.slice((page - 1) * meta.limit, page * meta.limit).map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-[#EFF6FF]/40 dark:hover:bg-[#334155]/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {unit.imei ? (
                        <span className="block font-semibold">{unit.imei}</span>
                      ) : unit.serialNumber ? (
                        <span className="block font-semibold">{unit.serialNumber}</span>
                      ) : (
                        <span className="text-[#64748B]">No ID</span>
                      )}
                      {unit.imei && unit.serialNumber && (
                        <span className="block text-[10px] text-[#64748B]">{unit.serialNumber}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      <span className="block truncate max-w-[160px]">{unit.product?.name ?? '—'}</span>
                      <span className="block text-[10px] font-medium text-[#64748B]">{unit.product?.brand}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-[#64748B] font-medium">
                      {unit.product?.category?.name ?? '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-[#0F172A] dark:text-[#F8FAFC] font-medium">
                      {[unit.storage ? `${unit.storage} GB` : null, unit.color].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant="info" size="sm" className="font-bold">
                        {unit.location === 'WAREHOUSE' ? 'Warehouse' : 'Shop'}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant={unitStatusVariant(unit.status)} size="sm" className="font-bold">
                        {unitStatusLabel(unit.status)}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {unit.purchasePrice != null ? formatCurrency(unit.purchasePrice) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewUnit(unit.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!isLoading && meta.totalPages > 1 && (
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
            <span className="text-xs font-semibold text-[#64748B]">
              Showing {Math.min((page - 1) * meta.limit + 1, meta.total)}–
              {Math.min(page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Unit Details & Lifecycle History Modal */}
        <UnitDetailsModal
          unitId={selectedUnitId}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedUnitId(null);
          }}
        />

      </div>
    </AppShell>
  );
}
