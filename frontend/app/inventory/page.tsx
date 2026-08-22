'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventory.service';
import { categoryService } from '../../services/category.service';
import {
  Category,
  InventoryAlert,
  InventoryProductItem,
  InventoryStockStatus,
  PaginationMeta,
  ProductType,
  TrackingType,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SearchIcon, AlertTriangleIcon, InventoryIcon } from '../../components/ui/Icons';
import { ReceiveStockModal } from '../../components/inventory/ReceiveStockModal';
import { TransferStockModal } from '../../components/inventory/TransferStockModal';
import { SellStockModal } from '../../components/inventory/SellStockModal';
import { ReturnStockModal } from '../../components/inventory/ReturnStockModal';
import { DamageLossModal } from '../../components/inventory/DamageLossModal';

/* ─── types ─────────────────────────────────────────────────────────────── */

type ModalType = 'receive' | 'transfer' | 'sell' | 'return' | 'damage' | null;
type LocationTab = 'ALL' | 'WAREHOUSE' | 'SHOP';
type PageTab = 'inventory' | 'alerts';

/* ─── small helpers ──────────────────────────────────────────────────────── */

function StockBadge({ status }: { status: InventoryStockStatus }) {
  if (status === 'IN_STOCK')
    return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK')
    return <Badge variant="warning" size="sm">Low Stock</Badge>;
  return <Badge variant="danger" size="sm">Out of Stock</Badge>;
}

function SkelRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-2.5">
          <div
            className="h-3.5 animate-pulse rounded bg-[#F5F5F7] dark:bg-[#2C2C2E]"
            style={{ width: `${[50, 30, 18, 15, 15, 18, 16][i] ?? 20}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ─── action menu ────────────────────────────────────────────────────────── */

interface ActionMenuProps {
  product: InventoryProductItem;
  isAdmin: boolean;
  onAction: (type: ModalType, product: InventoryProductItem) => void;
}

function ActionMenu({ product, isAdmin, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: 'Receive Stock', type: 'receive' as ModalType, adminOnly: true },
    { label: 'Transfer to Shop', type: 'transfer' as ModalType, adminOnly: true },
    { label: 'Sell', type: 'sell' as ModalType, adminOnly: false },
    { label: 'Return', type: 'return' as ModalType, adminOnly: false },
    { label: 'Damage / Loss', type: 'damage' as ModalType, adminOnly: false, danger: true },
  ].filter((a) => !a.adminOnly || isAdmin);

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        Manage ▾
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#E8E8ED] bg-white shadow-lg dark:border-[#38383A] dark:bg-[#1C1C1E]">
          <Link
            href={`/products/${product.id}`}
            className="block px-4 py-2.5 text-left text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
            onMouseDown={() => setOpen(false)}
          >
            View Product
          </Link>
          {items.map((a) => (
            <button
              key={a.type}
              onMouseDown={() => { setOpen(false); onAction(a.type, product); }}
              className={`block w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                a.danger
                  ? 'text-[#FF3B30] hover:bg-[#FFECEB] dark:text-[#FF453A] dark:hover:bg-[#2E0A09]'
                  : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  /* ── page-level tabs ── */
  const [pageTab, setPageTab] = useState<PageTab>('inventory');

  /* ── inventory state ── */
  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<{
    totalProducts: number; warehouseUnits: number; shopUnits: number;
    lowStockProducts: number; outOfStockProducts: number;
  } | null>(null);

  /* ── alerts state ── */
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [alertsMeta, setAlertsMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertsPage, setAlertsPage] = useState(1);

  /* ── inventory filters ── */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationTab, setLocationTab] = useState<LocationTab>('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | ''>('');
  const [page, setPage] = useState(1);

  /* ── ui state ── */
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  /* ── modal state ── */
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductItem | null>(null);

  /* ── for the receive modal opened from the header button ── */
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  /* ── debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── fetch categories ── */
  const fetchCategories = useCallback(async () => {
    try { setCategories((await categoryService.getCategories()) || []); }
    catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /* ── fetch summary ── */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await inventoryService.getInventorySummary();
      setSummary({
        totalProducts: res.data.totalProducts,
        warehouseUnits: res.data.warehouseUnits,
        shopUnits: res.data.shopUnits,
        lowStockProducts: res.data.lowStockProducts,
        outOfStockProducts: res.data.outOfStockProducts,
      });
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  /* ── fetch inventory ── */
  const fetchInventory = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await inventoryService.getInventory({
        page, limit: 20,
        search: debouncedSearch,
        categoryId: categoryId || undefined,
        location: locationTab !== 'ALL' ? locationTab : undefined,
        productType: productType || undefined,
        trackingType: trackingType || undefined,
        stockStatus: stockStatus || undefined,
        isActive: true,
      });
      setProducts(res.data || []);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load inventory.');
    } finally { setIsLoading(false); }
  }, [page, debouncedSearch, categoryId, locationTab, productType, trackingType, stockStatus]);
  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  /* ── fetch alerts ── */
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true); setAlertsError(null);
    try {
      const res = await inventoryService.getInventoryAlerts({ page: alertsPage, limit: 20 });
      setAlerts(res.data || []);
      setAlertsMeta(res.meta);
    } catch (err: unknown) {
      setAlertsError((err as { message?: string })?.message || 'Failed to load alerts.');
    } finally { setAlertsLoading(false); }
  }, [alertsPage]);

  useEffect(() => {
    if (pageTab === 'alerts') fetchAlerts();
  }, [pageTab, fetchAlerts]);

  /* ── handlers ── */
  const showSuccess = (msg: string) => {
    setSuccessBanner(msg); setTimeout(() => setSuccessBanner(null), 4000);
  };
  const handleOpSuccess = (label: string) => {
    showSuccess(`${label} recorded.`); fetchInventory(); fetchSummary();
  };
  const openModal = (type: ModalType, p: InventoryProductItem) => {
    setSelectedProduct(p); setActiveModal(type);
  };
  const closeModal = () => { setActiveModal(null); setSelectedProduct(null); };

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch(''); setLocationTab('ALL');
    setCategoryId(''); setProductType(''); setTrackingType(''); setStockStatus(''); setPage(1);
  };
  const hasFilters = !!(debouncedSearch || locationTab !== 'ALL' || categoryId || productType || trackingType || stockStatus);

  /* ── shared class ── */
  const selectCls = 'rounded-lg border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]';

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <AppShell>
      <div className="space-y-3">

        {/* ── page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Inventory</h2>
            <p className="text-xs text-[#6E6E73]">Manage stock across warehouse and shop.</p>
          </div>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={() => setIsReceiveOpen(true)}>
              + Receive Stock
            </Button>
          )}
        </div>

        {/* ── banners ── */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-[#30D158]/30 bg-[#E9F9EE] px-3 py-2 text-xs font-medium text-[#1A7A3A] dark:border-[#30D158]/20 dark:bg-[#0A2E1A] dark:text-[#30D158]">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}>✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon size={14} className="shrink-0" />{error}
            </div>
            <Button variant="secondary" size="sm" onClick={fetchInventory}>Retry</Button>
          </div>
        )}

        {/* ── summary strip ── */}
        {summary && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[#E8E8ED] bg-white px-4 py-2.5 text-xs dark:border-[#38383A] dark:bg-[#1C1C1E]">
            <span className="text-[#86868B]">
              Products: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{summary.totalProducts}</strong>
            </span>
            <span className="text-[#86868B]">
              Warehouse: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{summary.warehouseUnits.toLocaleString()}</strong>
            </span>
            <span className="text-[#86868B]">
              Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{summary.shopUnits.toLocaleString()}</strong>
            </span>
            {summary.outOfStockProducts > 0 && (
              <span className="font-medium text-[#FF3B30] dark:text-[#FF453A]">
                {summary.outOfStockProducts} out of stock
              </span>
            )}
            {summary.lowStockProducts > 0 && (
              <span className="font-medium text-[#FF9F0A]">
                {summary.lowStockProducts} low stock
              </span>
            )}
          </div>
        )}

        {/* ── page tabs: Inventory / Alerts ── */}
        <div className="flex items-center gap-1 border-b border-[#E8E8ED] dark:border-[#38383A]">
          {([
            { key: 'inventory', label: 'Inventory' },
            {
              key: 'alerts',
              label: 'Stock Alerts',
              badge: summary && (summary.lowStockProducts + summary.outOfStockProducts) > 0
                ? summary.lowStockProducts + summary.outOfStockProducts
                : null,
            },
          ] as { key: PageTab; label: string; badge?: number | null }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-medium transition-colors ${
                pageTab === t.key
                  ? 'border-[#0071E3] text-[#0071E3]'
                  : 'border-transparent text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
              }`}
            >
              {t.label}
              {t.badge != null && (
                <span className="rounded-full bg-[#FF3B30] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── INVENTORY TAB ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {pageTab === 'inventory' && (
          <>
            {/* location tabs */}
            <div className="flex items-center gap-1">
              {(['ALL', 'WAREHOUSE', 'SHOP'] as LocationTab[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocationTab(loc); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    locationTab === loc
                      ? 'bg-[#0071E3] text-white'
                      : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {loc === 'ALL' ? 'All Locations' : loc.charAt(0) + loc.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {[{ id: '', name: 'All Categories' }, ...categories].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setPage(1); }}
                  className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    categoryId === cat.id
                      ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
                      : 'border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* filter bar */}
            <div className="flex flex-col gap-2 rounded-xl border border-[#E8E8ED] bg-white p-2.5 dark:border-[#38383A] dark:bg-[#1C1C1E] sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by product name or brand…"
                  className="w-full rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] py-1.5 pl-8 pr-3 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <select value={productType} onChange={(e) => { setProductType(e.target.value as ProductType | ''); setPage(1); }} className={selectCls}>
                  <option value="">All Types</option>
                  <option value="PHONE">Phone</option>
                  <option value="ACCESSORY">Accessory / Repair</option>
                  <option value="TABLET">Tablet</option>
                  <option value="LAPTOP">Laptop</option>
                  <option value="SMART_WATCH">Smart Watch</option>
                  <option value="OTHER">Other</option>
                </select>
                <select value={trackingType} onChange={(e) => { setTrackingType(e.target.value as TrackingType | ''); setPage(1); }} className={selectCls}>
                  <option value="">All Tracking</option>
                  <option value="QUANTITY">Quantity</option>
                  <option value="SERIALIZED">Serialized</option>
                </select>
                <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value as InventoryStockStatus | ''); setPage(1); }} className={selectCls}>
                  <option value="">All Status</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
                {hasFilters && (
                  <button onClick={resetFilters} className={`${selectCls} hover:bg-[#F5F5F7]`}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* inventory table */}
            <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
              {isLoading ? (
                /* skeleton */
                <div className="overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                        {['Product', 'Category', 'WH', 'Shop', 'Total', 'Status', 'Tracking', ''].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                      {Array.from({ length: 7 }).map((_, i) => <SkelRow key={i} cols={8} />)}
                    </tbody>
                  </table>
                </div>
              ) : products.length === 0 ? (
                /* empty */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <InventoryIcon size={22} className="text-[#D2D2D7]" />
                  <p className="mt-2 text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">No inventory found</p>
                  <p className="mt-0.5 text-xs text-[#6E6E73]">
                    {hasFilters ? 'Try changing your filters.' : 'Receive stock to get started.'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {hasFilters && (
                      <Button variant="secondary" size="sm" onClick={resetFilters}>Reset Filters</Button>
                    )}
                    {isAdmin && (
                      <Button variant="primary" size="sm" onClick={() => setIsReceiveOpen(true)}>
                        + Receive Stock
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                          {['Product', 'Category', 'WH', 'Shop', 'Total', 'Status', 'Tracking', ''].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                        {products.map((p) => (
                          <tr key={p.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                            <td className="px-4 py-2.5">
                              <Link href={`/products/${p.id}`} className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                                {p.name}
                              </Link>
                              {p.brand && <span className="block text-[11px] text-[#86868B]">{p.brand}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-[#6E6E73]">{p.category?.name || '—'}</td>
                            <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {p.inventory.warehouseQuantity}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {p.inventory.shopQuantity}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {p.inventory.totalQuantity}
                            </td>
                            <td className="px-4 py-2.5">
                              <StockBadge status={p.stockStatus} />
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                                {p.trackingType === 'SERIALIZED' ? 'Serial' : 'Qty'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* mobile cards */}
                  <div className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E] md:hidden">
                    {products.map((p) => (
                      <div key={p.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/products/${p.id}`} className="block truncate text-sm font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                              {p.name}
                            </Link>
                            <p className="text-[11px] text-[#86868B]">
                              {[p.brand, p.category?.name].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <StockBadge status={p.stockStatus} />
                        </div>

                        <div className="flex items-center gap-3 rounded-lg bg-[#F5F5F7] px-3 py-2 text-xs dark:bg-[#2C2C2E]">
                          <span className="text-[#6E6E73]">
                            WH: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.warehouseQuantity}</strong>
                          </span>
                          <span className="text-[#6E6E73]">
                            Shop: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.shopQuantity}</strong>
                          </span>
                          <span className="text-[#6E6E73]">
                            Total: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{p.inventory.totalQuantity}</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                            {p.trackingType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}
                          </Badge>
                          <ActionMenu product={p} isAdmin={isAdmin} onAction={openModal} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* pagination */}
                  {meta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                      <span className="text-xs text-[#6E6E73]">
                        Page {meta.page} of {meta.totalPages} · {meta.total} items
                      </span>
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                          Prev
                        </Button>
                        <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                  {meta.totalPages <= 1 && meta.total > 0 && (
                    <div className="border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                      <span className="text-xs text-[#86868B]">{meta.total} item{meta.total !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── ALERTS TAB ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {pageTab === 'alerts' && (
          <div className="rounded-xl border border-[#E8E8ED] bg-white dark:border-[#38383A] dark:bg-[#1C1C1E]">
            {/* alerts header */}
            <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-2.5 dark:border-[#38383A]">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon size={14} className="text-[#FF9F0A]" />
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Stock Alerts</span>
                {!alertsLoading && alertsMeta.total > 0 && (
                  <Badge variant="danger" size="sm">{alertsMeta.total}</Badge>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={fetchAlerts} isLoading={alertsLoading}>
                Refresh
              </Button>
            </div>

            {alertsLoading ? (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                  {Array.from({ length: 5 }).map((_, i) => <SkelRow key={i} cols={4} />)}
                </tbody>
              </table>
            ) : alertsError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs text-[#CC2B22]">{alertsError}</p>
                <Button variant="secondary" size="sm" onClick={fetchAlerts}>Retry</Button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">All stock levels are healthy</p>
                <p className="mt-0.5 text-xs text-[#6E6E73]">No low-stock or out-of-stock products.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7] dark:border-[#38383A] dark:bg-[#2C2C2E]">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Product</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Category</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Stock</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Min</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Shortage</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F7] dark:divide-[#2C2C2E]">
                      {alerts.map((a) => (
                        <tr key={a.product.id} className="hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]">
                          <td className="px-4 py-2.5">
                            <Link href={`/products/${a.product.id}`} className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] dark:text-[#F5F5F7]">
                              {a.product.name}
                            </Link>
                            {a.product.brand && (
                              <span className="block text-[11px] text-[#86868B]">{a.product.brand}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#6E6E73]">
                            {a.product.category?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {a.inventory.totalQuantity}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#6E6E73]">
                            {a.product.minimumStock}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#FF3B30] dark:text-[#FF453A]">
                            {a.shortage > 0 ? `-${a.shortage}` : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <StockBadge status={a.stockStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* alerts pagination */}
                {alertsMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-[#F5F5F7] px-4 py-2.5 dark:border-[#38383A] dark:bg-[#2C2C2E]">
                    <span className="text-xs text-[#6E6E73]">
                      Page {alertsMeta.page} of {alertsMeta.totalPages} · {alertsMeta.total} alerts
                    </span>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" disabled={alertsPage <= 1 || alertsLoading} onClick={() => setAlertsPage((p) => Math.max(1, p - 1))}>
                        Prev
                      </Button>
                      <Button variant="secondary" size="sm" disabled={alertsPage >= alertsMeta.totalPages || alertsLoading} onClick={() => setAlertsPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ── stock operation modals ── */}

      {/* header "Receive Stock": product=null triggers product-search phase */}
      <ReceiveStockModal
        isOpen={isReceiveOpen}
        product={null}
        onClose={() => setIsReceiveOpen(false)}
        onSuccess={() => { showSuccess('Stock received.'); fetchInventory(); fetchSummary(); }}
      />

      {/* row-level "Receive Stock": product pre-selected, goes straight to form */}
      <ReceiveStockModal
        isOpen={activeModal === 'receive'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOpSuccess('Stock receipt')}
      />
      <TransferStockModal
        isOpen={activeModal === 'transfer'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOpSuccess('Transfer')}
      />
      <SellStockModal
        isOpen={activeModal === 'sell'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOpSuccess('Sale')}
      />
      <ReturnStockModal
        isOpen={activeModal === 'return'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOpSuccess('Return')}
      />
      <DamageLossModal
        isOpen={activeModal === 'damage'}
        product={selectedProduct}
        onClose={closeModal}
        onSuccess={() => handleOpSuccess('Adjustment')}
      />
    </AppShell>
  );
}
