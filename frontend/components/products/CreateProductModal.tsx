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

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (data: CreateProductRequest & { initialStock?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.createProduct(data);
      const created = (res as { data?: { id?: string } })?.data ?? (res as { id?: string });

      if (data.initialStock && data.initialStock > 0 && created?.id) {
        try {
          await apiClient('/stock/receive', {
            method: 'POST',
            body: JSON.stringify({
              productId: created.id,
              quantity: data.initialStock,
              note: 'Initial stock on product creation',
            }),
          });
        } catch {
          /* non-critical — product was created */
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to create product.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative my-8 flex w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">

        {/* sticky header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add Product</h3>
            <p className="mt-0.5 text-xs text-slate-500">Add a product to your inventory catalog.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 112px)' }}>
          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}
          <ProductForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>

        {/* sticky footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="product-form" isLoading={isLoading}>
            Create Product
          </Button>
        </div>

      </div>
    </div>
  );
};
