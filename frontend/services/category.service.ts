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

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    return apiClient<Category[]>('/categories');
  },

  async getCategory(id: string): Promise<Category> {
    return apiClient<Category>(`/categories/${id}`);
  },

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return apiClient<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    return apiClient<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: string): Promise<void> {
    return apiClient<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },
};
