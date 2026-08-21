'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/product.service';
import { categoryService } from '../../services/category.service';
import {
  Category,
  ProductItem,
  PaginationMeta,
  ProductType,
  TrackingType,
  InventoryStockStatus,
} from '../../types/api';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CreateProductModal } from '../../components/products/CreateProductModal';
import { EditProductModal } from '../../components/products/EditProductModal';
import { CreateCategoryModal } from '../../components/categories/CreateCategoryModal';
import { EditCategoryModal } from '../../components/categories/EditCategoryModal';
import { formatCurrency } from '../../lib/utils';
import { ProductsIcon, SearchIcon } from '../../components/ui/Icons';

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRIMARY_ADMIN';

  // Data State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [trackingType, setTrackingType] = useState<TrackingType | ''>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('true'); // 'true', 'false', 'all'
  const [stockStatusFilter, setStockStatusFilter] = useState<InventoryStockStatus | ''>('');
  const [page, setPage] = useState(1);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modal States
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load categories dynamically
  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let activeVal: boolean | string | undefined = undefined;
      if (isActiveFilter === 'true') activeVal = true;
      if (isActiveFilter === 'false') activeVal = false;

      const res = await productService.getProducts({
        page,
        limit: 10,
        search: debouncedSearch,
        productType: productType || undefined,
        trackingType: trackingType || undefined,
        categoryId: categoryId || undefined,
        isActive: activeVal,
        stockStatus: stockStatusFilter || undefined,
      });

      setProducts(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, productType, trackingType, categoryId, isActiveFilter, stockStatusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProductSuccess = () => {
    setSuccessBanner('Product created successfully!');
    fetchProducts();
    fetchCategories();
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleEditProductSuccess = () => {
    setSuccessBanner('Product updated successfully!');
    fetchProducts();
    fetchCategories();
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleCreateCategorySuccess = (newCategory: Category) => {
    setSuccessBanner(`Category "${newCategory.name}" created successfully!`);
    fetchCategories();
    setCategoryId(newCategory.id);
    setPage(1);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleEditCategorySuccess = (updatedCategory: Category) => {
    setSuccessBanner(`Category "${updatedCategory.name}" updated successfully!`);
    fetchCategories();
    fetchProducts();
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const resetFilters = () => {
    setSearch('');
    setProductType('');
    setTrackingType('');
    setCategoryId('');
    setIsActiveFilter('true');
    setStockStatusFilter('');
    setPage(1);
  };

  const getStockStatusBadge = (status: InventoryStockStatus) => {
    switch (status) {
      case 'IN_STOCK':
        return <Badge variant="success" size="sm">IN STOCK</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="warning" size="sm">LOW STOCK</Badge>;
      case 'OUT_OF_STOCK':
        return <Badge variant="danger" size="sm">OUT OF STOCK</Badge>;
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Products & Repair Inventory
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage phones, repair parts (Screens, ICs, Batteries), and accessories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsCreateCategoryOpen(true)}
                >
                  + Add Category
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsCreateProductOpen(true)}
                >
                  + Add Product
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Category Navigation Bar / Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => {
              setCategoryId('');
              setPage(1);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              categoryId === ''
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span>All Products</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setCategoryId(cat.id);
                setPage(1);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                categoryId === cat.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{cat.name}</span>
              {cat.productCount !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    categoryId === cat.id
                      ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {cat.productCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="font-bold text-emerald-700 dark:text-emerald-300">
              ✕
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={fetchProducts}>
              Retry
            </Button>
          </div>
        )}

        {/* Search & Filter Bar Card */}
        <Card className="p-4">
          <div className="flex flex-col gap-3.5">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by product name, repair component, or brand (e.g. Samsung A15 Screen)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-400"
              />
              <SearchIcon size={18} className="absolute left-3 top-2.5 text-slate-400" />
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {/* Category Dropdown Filter */}
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Product Type Filter */}
              <select
                value={productType}
                onChange={(e) => {
                  setProductType(e.target.value as ProductType | '');
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Types</option>
                <option value="ACCESSORY">Accessory / Repair</option>
                <option value="PHONE">Phone</option>
                <option value="TABLET">Tablet</option>
                <option value="LAPTOP">Laptop</option>
                <option value="SMART_WATCH">Smart Watch</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Tracking Type Filter */}
              <select
                value={trackingType}
                onChange={(e) => {
                  setTrackingType(e.target.value as TrackingType | '');
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Tracking</option>
                <option value="QUANTITY">Quantity</option>
                <option value="SERIALIZED">Serialized</option>
              </select>

              {/* Active Status Filter */}
              <select
                value={isActiveFilter}
                onChange={(e) => {
                  setIsActiveFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
                <option value="all">All Statuses</option>
              </select>

              {/* Stock Health Filter */}
              <select
                value={stockStatusFilter}
                onChange={(e) => {
                  setStockStatusFilter(e.target.value as InventoryStockStatus | '');
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">All Stock Health</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Products Table Card */}
        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <ProductsIcon size={24} />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
                No products found
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                No inventory items match your current search and category filters.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetFilters}
                className="mt-4 text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3.5">Item & Brand</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-center">Current Stock</th>
                      <th className="px-4 py-3.5 text-center">Health</th>
                      <th className="px-4 py-3.5 text-right">Selling Price</th>
                      <th className="px-4 py-3.5 text-center">Tracking</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
                          >
                            {product.name}
                          </Link>
                          <span className="block text-xs text-slate-500">
                            {product.brand}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {product.category?.name || '—'}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-900 dark:text-slate-100">
                          {product.inventory?.totalQuantity || 0}
                          <span className="block text-[10px] font-normal text-slate-500">
                            (WH: {product.inventory?.warehouseQuantity || 0} / Shop: {product.inventory?.shopQuantity || 0})
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStockStatusBadge(product.stockStatus)}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(product.sellingPrice)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            variant={
                              product.trackingType === 'SERIALIZED'
                                ? 'info'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {product.trackingType}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            variant={product.isActive ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {product.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/products/${product.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                            {isAdmin && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingProduct(product)}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Items */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {products.map((product) => (
                  <div key={product.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/products/${product.id}`}
                          className="font-bold text-sm text-slate-900 hover:underline dark:text-slate-100"
                        >
                          {product.name}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {product.brand} • {product.category?.name || 'Uncategorized'}
                        </span>
                      </div>
                      {getStockStatusBadge(product.stockStatus)}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-950">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Stock</span>
                        <strong className="text-sm text-slate-900 dark:text-slate-100">
                          {product.inventory?.totalQuantity || 0} units
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Selling Price</span>
                        <strong className="text-sm text-slate-900 dark:text-slate-100">
                          {formatCurrency(product.sellingPrice)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="neutral" size="sm">
                          {product.productType}
                        </Badge>
                        <Badge
                          variant={
                            product.trackingType === 'SERIALIZED'
                              ? 'info'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {product.trackingType}
                        </Badge>
                      </div>
                      <Badge variant={product.isActive ? 'success' : 'neutral'} size="sm">
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <Link href={`/products/${product.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
                      {isAdmin && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingProduct(product)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Showing page {meta.page} of {meta.totalPages || 1} ({meta.total} items total)
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={meta.page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={meta.page >= meta.totalPages || isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Modals */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSuccess={handleCreateProductSuccess}
      />

      <EditProductModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={handleEditProductSuccess}
      />

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={handleCreateCategorySuccess}
      />

      <EditCategoryModal
        category={editingCategory}
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        onSuccess={handleEditCategorySuccess}
      />
    </AppShell>
  );
}
