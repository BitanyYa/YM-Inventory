'use client';

import React, { useState } from 'react';
import { ProductItem, UpdateProductRequest } from '../../types/api';
import { productService } from '../../services/product.service';
import { ProductForm } from './ProductForm';
import { CloseIcon } from '../ui/Icons';

interface EditProductModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const handleSubmit = async (data: UpdateProductRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      await productService.updateProduct(product.id, data);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update product.');
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

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Edit Product Details
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Update pricing, category, minimum stock alert threshold, or active status for {product.name}
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
            initialValues={product}
            isEdit={true}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
