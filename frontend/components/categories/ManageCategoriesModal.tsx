'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Category } from '../../types/api';
import { categoryService } from '../../services/category.service';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { CloseIcon, AlertTriangleIcon } from '../ui/Icons';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditCategory: (category: Category) => void;
  onCreateCategory: () => void;
  onCategoriesUpdated: () => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  onClose,
  onEditCategory,
  onCreateCategory,
  onCategoriesUpdated,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await categoryService.getCategories();
      setCategories(data || []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, fetchCategories]);

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    setDeletingId(categoryToDelete.id);
    setError(null);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
      await fetchCategories();
      onCategoriesUpdated();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* modal window */}
      <div className="relative w-full max-w-lg rounded-2xl border border-[#D2D2D7] bg-white shadow-2xl dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* modal header */}
        <div className="flex items-center justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Manage Product Categories
            </h3>
            <p className="text-[11px] text-[#6E6E73]">
              View, edit, or remove empty categories in your catalog.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onCreateCategory();
              }}
            >
              + Category
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {/* modal body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FF3B30]/20 bg-[#FFECEB] p-3 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              <AlertTriangleIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* category delete confirmation callout */}
          {categoryToDelete && (
            <div className="rounded-xl border border-[#FF9F0A]/30 bg-[#FFF9F0] p-3 text-xs text-[#9E6200] dark:border-[#FF9F0A]/20 dark:bg-[#2E1F0A] dark:text-[#FF9F0A] space-y-2">
              <div className="font-semibold">
                Delete Category &quot;{categoryToDelete.name}&quot;?
              </div>
              <p className="text-[11px] leading-relaxed">
                This category is currently empty. Deleting it will permanently remove it from your category list.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={deletingId === categoryToDelete.id}
                  onClick={handleDeleteConfirm}
                >
                  Confirm Delete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!!deletingId}
                  onClick={() => setCategoryToDelete(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-[#0071E3]" />
            </div>
          ) : categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6E6E73]">
              No categories created yet. Click <strong>+ Category</strong> to create one.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E8ED] rounded-xl border border-[#E8E8ED] bg-white dark:divide-[#2C2C2E] dark:border-[#38383A] dark:bg-[#1C1C1E] overflow-hidden">
              {categories.map((cat) => {
                const count = cat.productCount ?? 0;
                const canDelete = count === 0;

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {cat.name}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {count} {count === 1 ? 'product' : 'products'}
                        </Badge>
                      </div>
                      {cat.description && (
                        <p className="mt-0.5 text-[11px] text-[#86868B] truncate">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onEditCategory(cat);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canDelete}
                        title={canDelete ? 'Delete category' : 'Cannot delete category while products are assigned to it'}
                        onClick={() => setCategoryToDelete(cat)}
                        className={!canDelete ? 'opacity-40 cursor-not-allowed text-[#86868B]' : 'text-[#FF3B30] hover:bg-[#FFECEB] dark:text-[#FF453A] dark:hover:bg-[#2E0A09]'}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* modal footer */}
        <div className="flex items-center justify-end border-t border-[#E8E8ED] px-4 py-2.5 dark:border-[#2C2C2E]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>

      </div>
    </div>
  );
};
