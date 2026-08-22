'use client';

import React, { useState } from 'react';
import { Category } from '../../types/api';
import { categoryService, CreateCategoryRequest } from '../../services/category.service';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CloseIcon } from '../ui/Icons';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCategory: Category) => void;
}

const PRESETS = ['Screens', 'ICs', 'Batteries', 'Charging Ports', 'Flex Cables', 'Speakers', 'Connectors', 'Accessories', 'Cameras', 'Earphones', 'Cases'];

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => { setName(''); setDescription(''); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Category name is required.'); return; }
    setIsLoading(true);
    try {
      const payload: CreateCategoryRequest = { name: name.trim(), description: description.trim() || undefined };
      const created = await categoryService.createCategory(payload);
      reset(); onSuccess(created); onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to create category.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#D2D2D7] bg-white shadow-xl dark:border-[#38383A] dark:bg-[#1C1C1E]">

        <div className="flex items-start justify-between border-b border-[#E8E8ED] px-4 py-3 dark:border-[#2C2C2E]">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">New Category</h3>
            <p className="mt-0.5 text-[11px] text-[#6E6E73]">Add a product category to your catalog.</p>
          </div>
          <button onClick={handleClose} className="ml-3 rounded-lg p-1 text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-[#2C2C2E]">
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FFECEB] px-3 py-2 text-xs text-[#CC2B22] dark:border-[#FF453A]/20 dark:bg-[#2E0A09] dark:text-[#FF453A]">
              {error}
            </div>
          )}

          <Input label="Category Name *" placeholder="e.g. Screens, Batteries, ICs"
            value={name} onChange={(e) => setName(e.target.value)} required />

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#86868B]">Quick presets</p>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setName(p)}
                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    name === p
                      ? 'border-[#0071E3] bg-[#0071E3] text-white'
                      : 'border-[#D2D2D7] bg-[#F5F5F7] text-[#1D1D1F] hover:border-[#0071E3]/40 dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
              Description <span className="text-[#86868B]">(optional)</span>
            </label>
            <textarea rows={2}
              className="w-full rounded-lg border border-[#D2D2D7] bg-white px-3 py-1.5 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50 focus:border-[#0071E3] dark:border-[#38383A] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              placeholder="Brief description…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>Create Category</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
