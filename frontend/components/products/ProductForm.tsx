'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { CreateCategoryModal } from '../categories/CreateCategoryModal';

interface ProductFormProps {
  initialValues?: ProductItem;
  isEdit?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const BRAND_OPTIONS: { label: string; value: string }[] = [
  { label: 'Apple', value: 'Apple' },
  { label: 'Samsung', value: 'Samsung' },
  { label: 'Xiaomi', value: 'Xiaomi' },
  { label: 'Tecno', value: 'Tecno' },
  { label: 'Infinix', value: 'Infinix' },
  { label: 'Itel', value: 'Itel' },
  { label: 'Huawei', value: 'Huawei' },
  { label: 'Nokia', value: 'Nokia' },
  { label: 'Sony', value: 'Sony' },
  { label: 'Dell', value: 'Dell' },
  { label: 'HP', value: 'HP' },
  { label: 'Lenovo', value: 'Lenovo' },
  { label: 'Generic', value: 'Generic' },
  { label: '+ Custom / Other Brand…', value: 'OTHER' },
];

const PRODUCT_TYPE_OPTIONS: { label: string; value: ProductType }[] = [
  { label: 'Accessory / Repair Part', value: 'ACCESSORY' },
  { label: 'Phone', value: 'PHONE' },
  { label: 'Tablet', value: 'TABLET' },
  { label: 'Laptop', value: 'LAPTOP' },
  { label: 'Smart Watch', value: 'SMART_WATCH' },
  { label: 'Other', value: 'OTHER' },
];

interface CustomSelectProps {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select option…',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full max-w-full">
      {label && <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] shadow-2xs hover:border-[#0071E3]/50 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] disabled:bg-[#F5F5F7] disabled:text-[#86868B]"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <span className="ml-2 text-[#86868B] text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 w-full max-w-full overflow-y-auto rounded-xl border border-[#E8E8ED] bg-white p-1 shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                opt.value === value
                  ? 'bg-[#0071E3] font-medium text-white'
                  : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <span className="ml-2 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const selectCls =
  'w-full max-w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] disabled:bg-[#F5F5F7] disabled:text-[#86868B] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] truncate box-border';

const labelCls = 'block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1';

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
  const [isCustomBrand, setIsCustomBrand] = useState(
    initialValues?.brand
      ? !BRAND_OPTIONS.some((b) => b.value === initialValues.brand && b.value !== 'OTHER')
      : false
  );
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

  const handleCategoryCreated = (newCat: Category) => { loadCategories(newCat.id); };

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
        name: name.trim(), brand: brand.trim(), categoryId,
        sellingPrice: priceNum, minimumStock: minStockNum,
        description: description.trim() || undefined, isActive,
      };
      await onSubmit(payload);
    } else {
      const payload: CreateProductRequest & { initialStock?: number } = {
        name: name.trim(), brand: brand.trim(), categoryId,
        productType, trackingType, sellingPrice: priceNum, minimumStock: minStockNum,
        description: description.trim() || undefined,
        initialStock: parseInt(initialStock || '0', 10) || undefined,
      };
      await onSubmit(payload);
    }
  };

  return (
    <>
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4 max-w-full overflow-hidden">

        {(formError || categoriesError) && (
          <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
            {formError ?? categoriesError}
          </div>
        )}

        {/* product information */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868B]">Product Information</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-full">
            <Input label="Product Name *" placeholder="e.g. Samsung A15 Screen"
              value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="min-w-0 max-w-full">
              <CustomSelect
                label="Brand *"
                value={
                  isCustomBrand
                    ? 'OTHER'
                    : BRAND_OPTIONS.some((b) => b.value === brand)
                      ? brand
                      : brand
                        ? 'OTHER'
                        : ''
                }
                placeholder="Select brand…"
                options={BRAND_OPTIONS}
                onChange={(val) => {
                  if (val === 'OTHER') {
                    setIsCustomBrand(true);
                    if (BRAND_OPTIONS.some((b) => b.value === brand)) {
                      setBrand('');
                    }
                  } else {
                    setIsCustomBrand(false);
                    setBrand(val);
                  }
                }}
              />
              {(isCustomBrand || (!BRAND_OPTIONS.some((b) => b.value === brand) && brand)) && (
                <div className="mt-1.5">
                  <Input
                    placeholder="Type custom brand name…"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="min-w-0 max-w-full">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls.replace(' mb-1', '')}>Category *</label>
                <button type="button" onClick={() => setIsCreateCategoryOpen(true)}
                  className="text-[11px] text-[#0071E3] hover:text-[#0077ED]">+ New</button>
              </div>
              <CustomSelect
                value={categoryId}
                placeholder={isCategoriesLoading ? 'Loading…' : categories.length === 0 ? 'No categories' : 'Select category'}
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
                onChange={(val) => setCategoryId(val)}
                disabled={isCategoriesLoading}
              />
            </div>

            <div className="min-w-0 max-w-full">
              {isEdit ? (
                <Input
                  label="Product Type *"
                  value={PRODUCT_TYPE_OPTIONS.find(o => o.value === productType)?.label ?? productType}
                  disabled
                />
              ) : (
                <CustomSelect
                  label="Product Type *"
                  value={productType}
                  options={PRODUCT_TYPE_OPTIONS}
                  onChange={(val) => {
                    const newType = val as ProductType;
                    setProductType(newType);
                    if (newType === 'ACCESSORY' || newType === 'OTHER') {
                      setTrackingType('QUANTITY');
                    } else if (['PHONE', 'TABLET', 'LAPTOP', 'SMART_WATCH'].includes(newType)) {
                      setTrackingType('SERIALIZED');
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* pricing & stock */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868B]">Pricing & Stock</p>
          <div className={`grid grid-cols-1 gap-3 ${!isEdit ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Input label="Selling Price (ETB) *" type="number" step="0.01" min="0.01" placeholder="0.00"
              value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
            {!isEdit && (
              <Input label="Initial Stock" type="number" min="0" placeholder="0"
                value={initialStock} onChange={(e) => setInitialStock(e.target.value)}
                helperText="Opening warehouse qty" />
            )}
            <Input label="Minimum Stock *" type="number" min="0" placeholder="5"
              value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)}
              helperText="Alert threshold" required />
          </div>
        </div>

        {/* tracking type */}
        {!isEdit && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868B]">Tracking Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(['QUANTITY', 'SERIALIZED'] as TrackingType[]).map((t) => (
                <button key={t} type="button" onClick={() => setTrackingType(t)}
                  className={`flex flex-col rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    trackingType === t
                      ? 'border-[#0071E3] bg-[#0071E3] text-white'
                      : 'border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                  }`}>
                  <span className="text-sm font-semibold">{t === 'QUANTITY' ? 'Quantity' : 'Serialized'}</span>
                  <span className={`mt-0.5 text-[11px] leading-snug ${trackingType === t ? 'opacity-80' : 'text-[#86868B]'}`}>
                    {t === 'QUANTITY' ? 'Bulk count screens, parts, cables' : 'Per-unit IMEI phones, tablets, laptops'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* active toggle */}
        {isEdit && (
          <div className="flex items-center gap-2.5">
            <input type="checkbox" id="isActiveToggle" checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#D2D2D7] accent-[#0071E3]" />
            <label htmlFor="isActiveToggle" className="cursor-pointer text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
              Active, uncheck to deactivate product
            </label>
          </div>
        )}

        {/* description */}
        <div>
          <label className={labelCls}>Description <span className="text-[#86868B]">(optional)</span></label>
          <textarea rows={2}
            className="w-full rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
            placeholder="e.g. Original AMOLED for Samsung Galaxy A15, OEM quality…"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

      </form>

      <CreateCategoryModal isOpen={isCreateCategoryOpen} onClose={() => setIsCreateCategoryOpen(false)} onSuccess={handleCategoryCreated} />
    </>
  );
};
