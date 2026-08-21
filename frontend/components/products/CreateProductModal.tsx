'use client';

import React, { useState } from 'react';
import { CreateProductRequest } from '../../types/api';
import { productService } from '../../services/product.service';
import { apiClient } from '../../lib/api-client';
import { ProductForm } from './ProductForm';
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
      const createdResponse = await productService.createProduct(data);
      const createdProduct: any = (createdResponse as any)?.data || createdResponse;

      // Automatically populate initial warehouse stock if entered > 0
      if (data.initialStock && data.initialStock > 0 && createdProduct?.id) {
        try {
          await apiClient('/stock/receive', {
            method: 'POST',
            body: JSON.stringify({
              productId: createdProduct.id,
              quantity: data.initialStock,
              note: 'Initial product creation stock',
            }),
          });
        } catch (stockErr) {
          console.error('Failed to post initial stock receipt:', stockErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create product.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content - Spacious Container */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Add New Product & Initial Inventory
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Create a product catalog entry and specify its initial opening warehouse stock.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6">
          <ProductForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
