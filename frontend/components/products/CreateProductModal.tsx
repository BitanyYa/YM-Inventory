'use client';

import React, { useState } from 'react';
import { CreateProductRequest } from '../../types/api';
import { productService } from '../../services/product.service';
import { apiClient } from '../../lib/api-client';
import { ProductForm } from './ProductForm';
import { Button } from '../ui/Button';
import { CloseIcon } from '../ui/Icons';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateProductModal: React.FC<CreateProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (data: CreateProductRequest & { initialStock?: number }) => {
    setIsLoading(true); setError(null);
    try {
      const res = await productService.createProduct(data);
      const created = (res as { data?: { id?: string } })?.data ?? (res as { id?: string });
      if (data.initialStock && data.initialStock > 0 && created?.id) {
        try {
          await apiClient('/stock/receive', {
            method: 'POST',
            body: JSON.stringify({ productId: created.id, quantity: data.initialStock, note: 'Initial stock on product creation' }),
          });
        } catch { /* non-critical */ }
      }
      onSuccess(); onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to create product.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-8 flex w-full max-w-2xl flex-col rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">

        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Add Product</h3>
            <p className="mt-0.5 text-xs text-[#6E6E73]">Add a product to your inventory catalog.</p>
          </div>
          <button onClick={onClose} className="ml-4 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 112px)' }}>
          {error && (
            <div className="mb-4 rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              {error}
            </div>
          )}
          <ProductForm onSubmit={handleSubmit} onCancel={onClose} isLoading={isLoading} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E8E8ED] px-5 py-3 dark:border-[#2C2C2E]">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="product-form" isLoading={isLoading}>Create Product</Button>
        </div>
      </div>
    </div>
  );
};
