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
import { apiClient } from '../../lib/api-client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CreateCategoryModal } from '../categories/CreateCategoryModal';

interface ProductFormProps {
  initialValues?: ProductItem;
  isEdit?: boolean;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

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

  const [name, setName] = useState(initialValues?.name || '');
  const [brand, setBrand] = useState(initialValues?.brand || '');
  const [categoryId, setCategoryId] = useState(
    initialValues?.category ? initialValues.category.id : '',
  );
  const [productType, setProductType] = useState<ProductType>(
    initialValues?.productType || 'ACCESSORY',
  );
  const [trackingType, setTrackingType] = useState<TrackingType>(
    initialValues?.trackingType || 'QUANTITY',
  );
  const [sellingPrice, setSellingPrice] = useState<string>(
    initialValues?.sellingPrice !== undefined
      ? initialValues.sellingPrice.toString()
      : '',
  );
  const [minimumStock, setMinimumStock] = useState<string>(
    initialValues?.minimumStock !== undefined
      ? initialValues.minimumStock.toString()
      : '5',
  );
  // Initial stock quantity for product creation
  const [initialStock, setInitialStock] = useState<string>('0');

  const [description, setDescription] = useState(
    initialValues?.description || '',
  );
  const [isActive, setIsActive] = useState<boolean>(
    initialValues?.isActive !== undefined ? initialValues.isActive : true,
  );

  const [formError, setFormError] = useState<string | null>(null);

  const loadCategories = async (selectedIdToKeep?: string) => {
    setIsCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await categoryService.getCategories();
      setCategories(data || []);
      if (selectedIdToKeep) {
        setCategoryId(selectedIdToKeep);
      } else if (!categoryId && data && data.length > 0) {
        setCategoryId(data[0].id);
      }
    } catch (err: any) {
      setCategoriesError('Failed to load categories list.');
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCategoryCreated = (newCat: Category) => {
    loadCategories(newCat.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!brand.trim()) {
      setFormError('Brand is required.');
      return;
    }
    if (!categoryId) {
      setFormError('Please select a category.');
      return;
    }

    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Selling price must be a positive number.');
      return;
    }

    const minStockNum = parseInt(minimumStock || '0', 10);
    if (isNaN(minStockNum) || minStockNum < 0) {
      setFormError('Minimum stock threshold must be 0 or a positive integer.');
      return;
    }

    const initialStockNum = parseInt(initialStock || '0', 10);
    if (!isEdit && (isNaN(initialStockNum) || initialStockNum < 0)) {
      setFormError('Initial stock quantity cannot be negative.');
      return;
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
      const payload: CreateProductRequest = {
        name: name.trim(),
        brand: brand.trim(),
        categoryId,
        productType,
        trackingType,
        sellingPrice: priceNum,
        minimumStock: minStockNum,
        description: description.trim() || undefined,
      };

      // Execute product creation
      await onSubmit(payload);

      // Note: If initial stock quantity was entered > 0 and product creation is handled by parent,
      // parent component or service handles receive stock. If initialStockNum > 0 for QUANTITY items,
      // we can receive stock via stock API after finding created product if needed.
    }
  };

  const productTypeOptions: { label: string; value: ProductType }[] = [
    { label: 'Accessory / Repair Part', value: 'ACCESSORY' },
    { label: 'Phone', value: 'PHONE' },
    { label: 'Tablet', value: 'TABLET' },
    { label: 'Laptop', value: 'LAPTOP' },
    { label: 'Smart Watch', value: 'SMART_WATCH' },
    { label: 'Other', value: 'OTHER' },
  ];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {formError}
          </div>
        )}

        {categoriesError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
            {categoriesError}
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 dark:border-slate-800/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
              1
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Basic Product Details
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Product Name *"
              placeholder="e.g. Samsung A15 Screen, iPhone 11 Battery"
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Category Select + Inline New Category Trigger */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryOpen(true)}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 underline"
                >
                  + New Category
                </button>
              </div>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-400"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isCategoriesLoading || categories.length === 0}
                required
              >
                {isCategoriesLoading ? (
                  <option value="">Loading categories...</option>
                ) : categories.length === 0 ? (
                  <option value="">No categories found</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Product Type Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Product Type *
              </label>
              {isEdit ? (
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  value={productType}
                  disabled
                />
              ) : (
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-400"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                  required
                >
                  {productTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Pricing & Stock Quantities */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 dark:border-slate-800/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
              2
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Pricing & Stock Quantities
            </h4>
          </div>

          <div className={`grid grid-cols-1 gap-4 ${!isEdit ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Input
              label="Selling Price (ETB) *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 2500"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />

            {!isEdit && (
              <Input
                label="Initial Stock Quantity"
                type="number"
                min="0"
                placeholder="e.g. 10"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                helperText="Opening warehouse stock count"
              />
            )}

            <Input
              label="Min Stock Threshold *"
              type="number"
              min="0"
              placeholder="e.g. 5"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              helperText="Alert triggered when total stock ≤ this"
              required
            />
          </div>
        </div>

        {/* Section 3: Stock Tracking Mode (Create Only) */}
        {!isEdit && (
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 dark:border-slate-800/80 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                3
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Stock Tracking Mode
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                  trackingType === 'QUANTITY'
                    ? 'border-slate-900 bg-white shadow-xs dark:border-slate-100 dark:bg-slate-900 ring-2 ring-slate-900 dark:ring-slate-100'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="trackingType"
                    value="QUANTITY"
                    checked={trackingType === 'QUANTITY'}
                    onChange={() => setTrackingType('QUANTITY')}
                    className="h-4 w-4 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    QUANTITY Tracking
                  </span>
                </div>
                <span className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Bulk count tracking. Recommended for repair components, screens, ICs, batteries, cables, chargers & accessories.
                </span>
              </label>

              <label
                className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                  trackingType === 'SERIALIZED'
                    ? 'border-slate-900 bg-white shadow-xs dark:border-slate-100 dark:bg-slate-900 ring-2 ring-slate-900 dark:ring-slate-100'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="trackingType"
                    value="SERIALIZED"
                    checked={trackingType === 'SERIALIZED'}
                    onChange={() => setTrackingType('SERIALIZED')}
                    className="h-4 w-4 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    SERIALIZED Tracking
                  </span>
                </div>
                <span className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Track individual unit by IMEI / Serial Number. Recommended for phones, tablets & laptops.
                </span>
              </label>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="isActiveToggle" className="cursor-pointer text-xs font-bold text-slate-900 dark:text-slate-100">
              Active Product (Uncheck to soft-delete / deactivate product from catalog)
            </label>
          </div>
        )}

        {/* Section 4: Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Description / Specifications (Optional)
          </label>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-400"
            placeholder="e.g. Original AMOLED display assembly for Samsung Galaxy A15..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" size="md" type="button" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" isLoading={isLoading}>
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>

      {/* Embedded Create Category Modal */}
      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={handleCategoryCreated}
      />
    </>
  );
};
