'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/product.service';
import { categoryService } from '../../services/category.service';
import {
  Category, ProductItem, PaginationMeta,
  ProductType, TrackingType, InventoryStockStatus,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CreateProductModal } from '../../components/products/CreateProductModal';
import { EditProductModal } from '../../components/products/EditProductModal';
import { CreateCategoryModal } from '../../components/categories/CreateCategoryModal';
import { EditCategoryModal } from '../../components/categories/EditCategoryModal';
import { formatCurrency } from '../../lib/utils';
import { SearchIcon, AlertTriangleIcon } from '../../components/ui/Icons';

function StockBadge({ status }: { status: InventoryStockStatus }) {
  if (status === 'IN_STOCK') return <Badge variant="success" size="sm">In Stock</Badge>;
  if (status === 'LOW_STOCK') return <Badge variant="warning" size="sm">Low</Badge>;
  return <Badge variant="danger" size="sm">Out</Badge>;
}

function SkelRow() {
  return (
    <tr>
      {[45, 25, 20, 14, 14, 14, 18, 16, 10].map((w, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('true');
  const [stockStatusFilter, setStockStatusFilter] = useState<InventoryStockStatus | ''>('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCategories = useCallback(async () => {
    try { setCategories((await categoryService.getCategories()) ?? []); }
    catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const isActive = isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined;
      const res = await productService.getProducts({
        page, limit: 25,
        search: debouncedSearch,
        productType: productType || undefined,
        trackingType: trackingType || undefined,
        categoryId: categoryId || undefined,
        isActive,
        stockStatus: stockStatusFilter || undefined,
      });
      setProducts(res.data ?? []);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Failed to load products.');
    } finally { setIsLoading(false); }
  }, [page, debouncedSearch, productType, trackingType, categoryId, isActiveFilter, stockStatusFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const showSuccess = (msg: string) => { setSuccessBanner(msg); setTimeout(() => setSuccessBanner(null), 4000); };
  const resetFilters = () => { setSearch(''); setProductType(''); setTrackingType(''); setCategoryId(''); setIsActiveFilter('true'); setStockStatusFilter(''); setPage(1); };
  const hasFilters = !!(debouncedSearch || productType || trackingType || categoryId || stockStatusFilter || isActiveFilter !== 'true');

  return (
    <AppShell>
      <div className="space-y-3">

        {/* ── header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Products</h2>
            <p className="text-xs text-slate-500">
              {meta.total} product{meta.total !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsCreateCategoryOpen(true)}>
                + Category
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsCreateProductOpen(true)}>
                + Product
              </Button>
            </div>
          )}
        </div>

        {/* ── banners ── */}
        {successBanner && (
          <div className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="font-bold">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            <div className="flex items-center gap-2"><AlertTriangleIcon size={14} />{error}</div>
            <Button variant="secondary" size="sm" onClick={fetchProducts}>Retry</Button>
          </div>
        )}

        {/* ── category pills ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[{ id: '', name: 'All' }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`shrink-0 rounded px-3 py-1 text-xs font-semibold transition-colors ${
                categoryId === cat.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {cat.name}
              {'productCount' in cat && cat.productCount !== undefined && (
                <span className={`ml-1.5 text-[10px] ${categoryId === cat.id ? 'opacity-75' : 'text-slate-400'}`}>
                  {cat.productCount}
                </span>
              )}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setIsCreateCategoryOpen(true)}
              className="shrink-0 rounded border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:border-slate-500"
            >
              + New
            </button>
          )}
        </div>

        {/* ── filter bar ── */}
        <div className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                value: productType, onChange: (v: string) => { setProductType(v as ProductType | ''); setPage(1); },
                options: [
                  ['', 'All Types'], ['PHONE', 'Phone'], ['ACCESSORY', 'Accessory'],
                  ['TABLET', 'Tablet'], ['LAPTOP', 'Laptop'], ['SMART_WATCH', 'Smart Watch'], ['OTHER', 'Other'],
                ],
              },
              {
                value: trackingType, onChange: (v: string) => { setTrackingType(v as TrackingType | ''); setPage(1); },
                options: [['', 'All Tracking'], ['QUANTITY', 'Quantity'], ['SERIALIZED', 'Serialized']],
              },
              {
                value: stockStatusFilter, onChange: (v: string) => { setStockStatusFilter(v as InventoryStockStatus | ''); setPage(1); },
                options: [['', 'All Status'], ['IN_STOCK', 'In Stock'], ['LOW_STOCK', 'Low Stock'], ['OUT_OF_STOCK', 'Out of Stock']],
              },
              {
                value: isActiveFilter, onChange: (v: string) => { setIsActiveFilter(v); setPage(1); },
                options: [['true', 'Active'], ['false', 'Inactive'], ['all', 'All']],
              },
            ].map((sel, i) => (
              <select
                key={i}
                value={sel.value}
                onChange={(e) => sel.onChange(e.target.value)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
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
                  {['Product', 'Category', 'Type', 'WH', 'Shop', 'Total', 'Status', 'Price', ''].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkelRow key={i} />)
                  : products.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangleIcon size={20} className="text-slate-300" />
                          <p className="text-xs font-medium text-slate-500">No products found</p>
                          {hasFilters && <button onClick={resetFilters} className="text-xs text-slate-700 underline">Clear filters</button>}
                        </div>
                      </td>
                    </tr>
                  )
                  : products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5">
                        <Link href={`/products/${p.id}`} className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-slate-400">{p.brand}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{p.category?.name ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                          {p.trackingType === 'SERIALIZED' ? 'Serial' : 'Qty'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-800 dark:text-slate-200">{p.inventory.warehouseQuantity}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-800 dark:text-slate-200">{p.inventory.shopQuantity}</td>
                      <td className="px-3 py-2.5 tabular-nums font-bold text-slate-900 dark:text-slate-100">{p.inventory.totalQuantity}</td>
                      <td className="px-3 py-2.5"><StockBadge status={p.stockStatus} /></td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(p.sellingPrice)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/products/${p.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          {isAdmin && (
                            <Button variant="secondary" size="sm" onClick={() => setEditingProduct(p)}>Edit</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse p-3 space-y-1.5">
                  <div className="h-3.5 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
            ) : products.map((p) => (
              <div key={p.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${p.id}`} className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">{p.brand} · {p.category?.name ?? 'Uncategorized'}</p>
                  </div>
                  <StockBadge status={p.stockStatus} />
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">WH: <strong className="text-slate-800 dark:text-slate-200">{p.inventory.warehouseQuantity}</strong></span>
                  <span className="text-slate-500">Shop: <strong className="text-slate-800 dark:text-slate-200">{p.inventory.shopQuantity}</strong></span>
                  <span className="text-slate-500">Total: <strong className="text-slate-900 dark:text-slate-100">{p.inventory.totalQuantity}</strong></span>
                  <span className="ml-auto font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(p.sellingPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={p.trackingType === 'SERIALIZED' ? 'info' : 'neutral'} size="sm">
                    {p.trackingType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}
                  </Badge>
                  <div className="flex gap-1.5">
                    <Link href={`/products/${p.id}`}><Button variant="ghost" size="sm">View</Button></Link>
                    {isAdmin && <Button variant="secondary" size="sm" onClick={() => setEditingProduct(p)}>Edit</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <span className="text-xs text-slate-500">
                Page {meta.page} of {meta.totalPages} · {meta.total} items
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* modals */}
      <CreateProductModal isOpen={isCreateProductOpen} onClose={() => setIsCreateProductOpen(false)}
        onSuccess={() => { showSuccess('Product created.'); fetchProducts(); fetchCategories(); }} />
      <EditProductModal product={editingProduct} isOpen={!!editingProduct} onClose={() => setEditingProduct(null)}
        onSuccess={() => { showSuccess('Product updated.'); fetchProducts(); fetchCategories(); }} />
      <CreateCategoryModal isOpen={isCreateCategoryOpen} onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={(cat) => { showSuccess(`Category "${cat.name}" created.`); fetchCategories(); setCategoryId(cat.id); }} />
      <EditCategoryModal category={editingCategory} isOpen={!!editingCategory} onClose={() => setEditingCategory(null)}
        onSuccess={(cat) => { showSuccess(`Category "${cat.name}" updated.`); fetchCategories(); fetchProducts(); }} />
    </AppShell>
  );
}
