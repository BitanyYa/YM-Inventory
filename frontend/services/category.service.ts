import { apiClient } from '../lib/api-client';
import { Category } from '../types/api';

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
}

let cachedCategories: Category[] | null = null;
let cachePromise: Promise<Category[]> | null = null;

export const categoryService = {
  async getCategories(forceRefresh = false): Promise<Category[]> {
    if (!forceRefresh && cachedCategories) {
      return cachedCategories;
    }
    if (!forceRefresh && cachePromise) {
      return cachePromise;
    }
    cachePromise = apiClient<Category[]>('/categories')
      .then((data) => {
        cachedCategories = data;
        cachePromise = null;
        return data;
      })
      .catch((err) => {
        cachePromise = null;
        throw err;
      });
    return cachePromise;
  },

  async getCategory(id: string): Promise<Category> {
    return apiClient<Category>(`/categories/${id}`);
  },

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    const created = await apiClient<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    cachedCategories = null;
    return created;
  },

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    const updated = await apiClient<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    cachedCategories = null;
    return updated;
  },

  async deleteCategory(id: string): Promise<void> {
    await apiClient<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
    cachedCategories = null;
  },

  clearCache(): void {
    cachedCategories = null;
    cachePromise = null;
  },
};
