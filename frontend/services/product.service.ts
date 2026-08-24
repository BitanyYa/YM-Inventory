import { apiClient } from '../lib/api-client';
import {
  ProductListResponse,
  ProductDetailResponse,
  ProductDetail,
  ProductItem,
  QueryProductParams,
  CreateProductRequest,
  UpdateProductRequest,
} from '../types/api';

export const productService = {
  async getProducts(params: QueryProductParams = {}): Promise<ProductListResponse> {
    const query = new URLSearchParams();

    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.productType) query.append('productType', params.productType);
    if (params.trackingType) query.append('trackingType', params.trackingType);
    if (params.categoryId) query.append('categoryId', params.categoryId);
    if (params.isActive !== undefined && params.isActive !== '') {
      query.append('isActive', params.isActive.toString());
    }
    if (params.stockStatus) query.append('stockStatus', params.stockStatus);

    const queryString = query.toString();
    const endpoint = `/products${queryString ? `?${queryString}` : ''}`;

    return apiClient<ProductListResponse>(endpoint);
  },

  async getProduct(id: string): Promise<ProductDetailResponse> {
    return apiClient<ProductDetailResponse>(`/products/${id}`);
  },

  async createProduct(data: CreateProductRequest): Promise<{ data: ProductItem } | ProductItem> {
    return apiClient<{ data: ProductItem } | ProductItem>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProduct(
    id: string,
    data: UpdateProductRequest,
  ): Promise<{ data: ProductItem } | ProductItem> {
    return apiClient<{ data: ProductItem } | ProductItem>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateProductStatus(
    id: string,
    isActive: boolean,
  ): Promise<{ data: ProductItem } | ProductItem> {
    return apiClient<{ data: ProductItem } | ProductItem>(`/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
};
