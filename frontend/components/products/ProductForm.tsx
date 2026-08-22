'use client';

import React, { useEffect, useState } from 'react';
import {
  Category,
  CreateProductRequest,
  ProductType,
  TrackingType,
  UpdateProductRequest,
  ProductItem,
} from '../../types/api';
import { categoryService } from '../../services/category.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CreateCategoryModal } from '../categories/CreateCategoryModal';

interface ProductFormProps {
  initialValues?: ProductItem;
  isEdit?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const PRODUCT_TYPE_OPTIONS: { label: string; value: ProductType }[] = [
  { label: 'Accessory / Repair Part', value: 'ACCESSORY' },
  { label: 'Phone', value: 'PHONE' },
  { label: 'Tablet', value: 'TABLET' },
  { label: 'Laptop', value: 'LAPTOP' },
  { label: 'Smart Watch', value: 'SMART_WATCH' },
  { label: 'Other', value: 'OTHER' },
];

/* shared select class */
const selectCls =
  'w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

/* shared label class */
const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

export const ProductForm: React.FC<ProductFormProps> = ({
  initialValues,
  isEdit = false,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);

  const [name, setName] = useState(initialValues?.name ?? '');
  const [brand, setBrand] = useState(initialValues?.brand ?? '');
  const [categoryId, setCategoryId] = useState(initialValues?.category?.id ?? '');
  const [productType, setProductType] = useState<ProductType>(initialValues?.productType ?? 'ACCESSORY');
  const [trackingType, setTrackingType] = useState<TrackingType>(initialValues?.trackingType ?? 'QUANTITY');
  const [sellingPrice, setSellingPrice] = useState(initialValues?.sellingPrice?.toString() ?? '');
  const [minimumStock, setMinimumStock] = useState(initialValues?.minimumStock?.toString() ?? '5');
  const [initialStock, setInitialStock] = useState('0');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCategories = async (selectId?: string) => {
    setIsCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await categoryService.getCategories();
      setCategories(data ?? []);
      if (selectId) {
        setCategoryId(selectId);
      } else if (!categoryId && data && data.length > 0) {
        setCategoryId(data[0].id);
      }
    } catch {
      setCategoriesError('Could not load categories.');
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryCreated = (newCat: Category) => {
    loadCategories(newCat.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) { setFormError('Product name is required.'); return; }
    if (!brand.trim()) { setFormError('Brand is required.'); return; }
    if (!categoryId) { setFormError('Please select a category.'); return; }

    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) { setFormError('Selling price must be a positive number.'); return; }

    const minStockNum = parseInt(minimumStock || '0', 10);
    if (isNaN(minStockNum) || minStockNum < 0) { setFormError('Minimum stock must be 0 or more.'); return; }

    if (!isEdit) {
      const initialStockNum = parseInt(initialStock || '0', 10);
      if (isNaN(initialStockNum) || initialStockNum < 0) { setFormError('Initial stock cannot be negative.'); return; }
    }

    if (isEdit) {
      const payload: UpdateProductRequest = {
        name: name.trim(),
        brand: brand.trim(),
        categoryId,
        sellingPrice: priceNum,
        minimumStock: minStockNum,
        description: description.trim() || undefined,
        isActive,
      };
      await onSubmit(payload);
    } else {
      const payload: CreateProductRequest & { initialStock?: number } = {
        name: name.trim(),
        brand: brand.trim(),
        categoryId,
        productType,
        trackingType,
        sellingPrice: priceNum,
        minimumStock: minStockNum,
        description: description.trim() || undefined,
        initialStock: parseInt(initialStock || '0', 10) || undefined,
      };
      await onSubmit(payload);
    }
  };

  return (
    <>
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">

        {/* error banners */}
        {(formError || categoriesError) && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {formError ?? categoriesError}
          </div>
        )}

        {/* ── section: product information ── */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Information</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Product Name *"
              placeholder="e.g. Samsung A15 Screen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Brand *"
              placeholder="e.g. Samsung, Apple, Generic"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
            />

            {/* category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls.replace(' mb-1', '')}>Category *</label>
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryOpen(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  + New
                </button>
              </div>
              <select
                className={selectCls}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isCategoriesLoading}
                required
              >
                {isCategoriesLoading ? (
                  <option value="">Loading…</option>
                ) : categories.length === 0 ? (
                  <option value="">No categories — create one first</option>
                ) : (
                  <>
                    <option value="" disabled>Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* product type */}
            <div>
              <label className={labelCls}>Product Type *</label>
              {isEdit ? (
                <input
                  className={selectCls + ' cursor-not-allowed'}
                  value={PRODUCT_TYPE_OPTIONS.find(o => o.value === productType)?.label ?? productType}
                  disabled
                />
              ) : (
                <select
                  className={selectCls}
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                  required
                >
                  {PRODUCT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── section: pricing & stock ── */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing & Stock</p>
          <div className={`grid grid-cols-1 gap-3 ${!isEdit ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Input
              label="Selling Price (ETB) *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
            {!isEdit && (
              <Input
                label="Initial Stock"
                type="number"
                min="0"
                placeholder="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                helperText="Opening warehouse qty"
              />
            )}
            <Input
              label="Minimum Stock *"
              type="number"
              min="0"
              placeholder="5"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              helperText="Alert threshold"
              required
            />
          </div>
        </div>

        {/* ── section: tracking type (create only) ── */}
        {!isEdit && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tracking Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(['QUANTITY', 'SERIALIZED'] as TrackingType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrackingType(t)}
                  className={`flex flex-col rounded border px-3 py-2.5 text-left transition-colors ${
                    trackingType === t
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span className="text-sm font-semibold">{t === 'QUANTITY' ? 'Quantity' : 'Serialized'}</span>
                  <span className={`mt-0.5 text-[11px] leading-snug ${trackingType === t ? 'opacity-75' : 'text-slate-400'}`}>
                    {t === 'QUANTITY' ? 'Bulk count — screens, parts, cables' : 'Per-unit IMEI — phones, tablets, laptops'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── active toggle (edit only) ── */}
        {isEdit && (
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="isActiveToggle" className="cursor-pointer text-xs text-slate-600 dark:text-slate-400">
              Active — uncheck to deactivate this product
            </label>
          </div>
        )}

        {/* ── description ── */}
        <div>
          <label className={labelCls}>Description <span className="text-slate-400">(optional)</span></label>
          <textarea
            rows={2}
            className="w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="e.g. Original AMOLED for Samsung Galaxy A15, OEM quality…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

      </form>

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={handleCategoryCreated}
      />
    </>
  );
};
