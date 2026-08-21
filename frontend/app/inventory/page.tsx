'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import {
  Category,
  InventoryProductItem,
  InventoryStockStatus,
  PaginationMeta,
  ProductType,
  TrackingType,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { SearchIcon, AlertTriangleIcon, ArrowRightIcon } from '../../components/ui/Icons';
import { ReceiveStockModal } from '../../components/inventory/ReceiveStockModal';
import { TransferStockModal } from '../../components/inventory/TransferStockModal';
import { SellStockModal } from '../../components/inventory/SellStockModal';
import { ReturnStockModal } from '../../components/inventory/ReturnStockModal';
import { DamageLossModal } from '../../components/inventory/DamageLossModal';
import { cn } from '../../lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type ModalType = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | null;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function stockStatusBadge(status: InventoryStockStatus) {
  if (status === 'IN_STOCK')
    return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK')
    return <Badge variant="warning" size="sm">Low Stock</Badge>;
  return <Badge variant="danger" size="sm">Out of Stock</Badge>;
}

function trackingBadge(type: TrackingType) {
  return (
    <Badge variant="neutral" size="sm">
      {type === 'SERIALIZED' ? 'Serialized' : 'Qty'}
    </Badge>
  );
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PHONE: 'Phone',
  ACCESSORY: 'Accessory',
  TABLET: 'Tablet',
  LAPTOP: 'Laptop',
  SMART_WATCH: 'Smart Watch',
  OTHER: 'Other',
};

/* ─── Skeleton row ───────────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded bg-slate-100 animate-pulse dark:bg-slate-800"
            style={{ width: i === 1 ? '60%' : i === 2 ? '40%' : '50%' }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── Action menu ────────────────────────────────────────────────────────────── */

interface ActionMenuProps {
  product: InventoryProductItem;
  isAdmin: boolean;
  onAction: (type: ModalType, product: InventoryProductItem) => void;
}

function ActionMenu({ product, isAdmin, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);

  const actions: { label: string; type: ModalType; adminOnly?: boolean }[] = [
    { label: 'Receive', type: 'receive', adminOnly: true },
    { label: 'Transfer to Shop', type: 'transfer', adminOnly: true },
    { label: 'Sell', type: 'sell' },
    { label: 'Return', type: 'return' },
    { label: 'Damage / Loss', type: 'damage' },
  ];

  const available = actions.filter((a) => !a.adminOnly || isAdmin);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        aria-label="Open actions menu"
      >
        Manage ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {available.map((a) => (
            <button
              key={a.type}
              onMouseDown={() => {
                setOpen(false);
                onAction(a.type, product);
              }}
              className={cn(
                'block w-full px-3.5 py-2 text-left text-xs font-medium transition-colors',
                a.type === 'damage'
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                'first:rounded-t-lg last:rounded-b-lg',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  /* Data */
  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<{
    totalProducts: number;
    warehouseUnits: number;
    shopUnits: number;
  } | null>(null);

  /* Filters */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'WAREHOUSE' | 'SHOP'>('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [page, setPage] = useState(1);

  /* UI */
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  /* Modal state */
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductItem | null>(null);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Load categories ── */
  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* ── Load summary ── */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await inventoryService.getInventorySummary();
      setSummary({
        totalProducts: res.data.totalProducts,
        warehouseUnits: res.data.warehouseUnits,
        shopUnits: res.data.shopUnits,
      });
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  /* ── Load inventory ── */
  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getInventory({
        page,
        limit: 20,
        search: debouncedSearch,
        categoryId: categoryId || undefined,
        location: locationFilter !== 'ALL' ? locationFilter : undefined,
        stockStatus: stockStatus || undefined,
        trackingType: trackingType || undefined,
        isActive: true,
      });
      setProducts(res.data || []);
      setMeta(res.meta);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load inventory.');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, categoryId, locationFilter, stockStatus, trackingType]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /* ── Handlers ── */
  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleOperationSuccess = (action: string) => {
    showSuccess(`${action} recorded successfully.`);
    fetchInventory();
    fetchSummary();
  };

  const openModal = (type: ModalType, product: InventoryProductItem) => {
    setSelectedProduct(product);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProduct(null);
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setLocationFilter('ALL');
    setCategoryId('');
    setStockStatus('');
    setTrackingType('');
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch || locationFilter !== 'ALL' || categoryId || stockStatus || trackingType;

  /* ─────────────────────────────────────────────────────────────────────────── */
  return (
    <AppShell>
      <div className="space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Inventory
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              What do we have, where is it, and what can I do with it?
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Receive without pre-selecting a product — handled by routing to products page
                  // or can open a product-search receive. For now, guide to per-row Manage button.
                }}
                disabled
                title="Use the Manage button on a product row"
              >
                Receive Stock
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {}}
                disabled
                title="Use the Manage button on a product row"
              >
                Transfer
              </Button>
            </div>
          )}
        </div>

        {/* ── Banners ── */}
        {successBanner && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
            {successBanner}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            <AlertTriangleIcon size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Summary strip ── */}
        {summary && (
          <div className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
            {[
              { label: 'Total Products', value: summary.totalProducts },
              { label: 'Warehouse', value: summary.warehouseUnits },
              { label: 'Shop Floor', value: summary.shopUnits },
            ].map((s) => (
              <div key={s.label} className="px-5 py-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Location tabs ── */}
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800 w-fit">
          {(['ALL', 'WAREHOUSE', 'SHOP'] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => { setLocationFilter(loc); setPage(1); }}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                locationFilter === loc
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {loc === 'ALL' ? 'All Locations' : loc.charAt(0) + loc.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* ── Search & filters ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Search */}
            <div className="relative flex-1">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Category */}
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Stock status */}
            <select
              value={stockStatus}
              onChange={(e) => { setStockStatus(e.target.value as InventoryStockStatus | ''); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>

            {/* Tracking type */}
            <select
              value={trackingType}
              onChange={(e) => { setTrackingType(e.target.value as TrackingType | ''); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">All Types</option>
              <option value="QUANTITY">Quantity</option>
              <option value="SERIALIZED">Serialized</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dynamic category pills */}
          {categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => { setCategoryId(''); setPage(1); }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  !categoryId
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(c.id); setPage(1); }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    categoryId === c.id
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Table / List ── */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">

          {/* Results count */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              {isLoading ? 'Loading…' : `${meta.total} product${meta.total !== 1 ? 's' : ''}`}
              {hasActiveFilters && !isLoading ? ' (filtered)' : ''}
            </span>
            {meta.totalPages > 1 && (
              <span className="text-xs text-slate-500">
                Page {meta.page} of {meta.totalPages}
              </span>
            )}
          </div>

          {/* ─ Desktop Table ─ */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Product', 'Category', 'Tracking', 'Warehouse', 'Shop', 'Total', 'Status', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <div className="mx-auto flex flex-col items-center gap-2">
                        <AlertTriangleIcon size={24} className="text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-500">No products found</p>
                        {hasActiveFilters && (
                          <button
                            onClick={resetFilters}
                            className="mt-1 text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      {/* Product */}
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/products/${p.id}`}
                          className="group flex flex-col gap-0.5"
                        >
                          <span className="font-semibold text-slate-900 group-hover:text-slate-700 dark:text-slate-100 dark:group-hover:text-slate-300">
                            {p.name}
                          </span>
                          {p.brand && (
                            <span className="text-xs text-slate-400">{p.brand}</span>
                          )}
                        </Link>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                        {p.category?.name ?? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Tracking */}
                      <td className="px-4 py-3.5">{trackingBadge(p.trackingType)}</td>

                      {/* Warehouse */}
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {p.inventory.warehouseQuantity}
                      </td>

                      {/* Shop */}
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {p.inventory.shopQuantity}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {p.inventory.totalQuantity}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">{stockStatusBadge(p.stockStatus)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <ActionMenu
                          product={p}
                          isAdmin={isAdmin}
                          onAction={openModal}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ─ Mobile Cards ─ */}
          <div className="md:hidden">
            {isLoading ? (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse p-4 space-y-2">
                    <div className="h-4 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-8 rounded bg-slate-100 dark:bg-slate-800" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14">
                <AlertTriangleIcon size={24} className="text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500">No products found</p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs font-medium text-slate-700 underline underline-offset-2 dark:text-slate-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => (
                  <div key={p.id} className="p-4">
                    {/* Name & badges row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/products/${p.id}`}>
                          <p className="truncate font-semibold text-slate-900 hover:text-slate-700 dark:text-slate-100">
                            {p.name}
                          </p>
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[p.brand, p.category?.name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="shrink-0">{stockStatusBadge(p.stockStatus)}</div>
                    </div>

                    {/* Qty grid */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Warehouse', value: p.inventory.warehouseQuantity },
                        { label: 'Shop', value: p.inventory.shopQuantity },
                        { label: 'Total', value: p.inventory.totalQuantity },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-lg border border-slate-100 bg-slate-50 py-2 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <p className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {s.value}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer row */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {trackingBadge(p.trackingType)}
                        {p.category && (
                          <span className="text-xs text-slate-400">{p.category.name}</span>
                        )}
                      </div>
                      <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─ Pagination ─ */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* ── Low-stock alert strip ── */}
        {!isLoading && products.some((p) => p.stockStatus !== 'IN_STOCK') && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
            <AlertTriangleIcon size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length} out of stock,{' '}
              {products.filter((p) => p.stockStatus === 'LOW_STOCK').length} low stock on this page.
            </p>
            <button
              onClick={() => { setStockStatus('LOW_STOCK'); setPage(1); }}
              className="ml-auto shrink-0 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400"
            >
              View alerts
            </button>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      <ReceiveStockModal
        isOpen={activeModal === 'receive'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Stock receipt')}
      />
      <TransferStockModal
        isOpen={activeModal === 'transfer'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Transfer')}
      />
      <SellStockModal
        isOpen={activeModal === 'sell'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Sale')}
      />
      <ReturnStockModal
        isOpen={activeModal === 'return'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Return')}
      />
      <DamageLossModal
        isOpen={activeModal === 'damage'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOperationSuccess('Adjustment')}
      />
    </AppShell>
  );
}
