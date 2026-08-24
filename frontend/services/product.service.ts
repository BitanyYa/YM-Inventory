import { apiClient } from '../lib/api-client';
import {
  ProductListResponse,
  ProductDetailResponse,
  ProductItem,
  QueryProductParams,
  CreateProductRequest,
  UpdateProductRequest,
  ProductUnitItem,
  QueryProductUnitParams,
  UnitHistoryResponse,
  PaginationMeta,
} from '../types/api';

const productCache = new Map<string, { data: ProductListResponse; timestamp: number }>();
const pendingRequests = new Map<string, Promise<ProductListResponse>>();
const CACHE_TTL_MS = 15000; // 15s cache TTL for instant UI response

export interface UnitListResponse {
  data: ProductUnitItem[];
  meta?: PaginationMeta;
}

export const productService = {
  async getProducts(params: QueryProductParams = {}, forceRefresh = false): Promise<ProductListResponse> {
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

    if (!forceRefresh) {
      const cached = productCache.get(endpoint);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
      if (pendingRequests.has(endpoint)) {
        return pendingRequests.get(endpoint)!;
      }
    }

    const promise = apiClient<ProductListResponse>(endpoint)
      .then((data) => {
        productCache.set(endpoint, { data, timestamp: Date.now() });
        pendingRequests.delete(endpoint);
        return data;
      })
      .catch((err) => {
        pendingRequests.delete(endpoint);
        throw err;
      });

    pendingRequests.set(endpoint, promise);
    return promise;
  },

  async getProduct(id: string): Promise<ProductDetailResponse> {
    return apiClient<ProductDetailResponse>(`/products/${id}`);
  },

  async getUnits(params: QueryProductUnitParams = {}): Promise<UnitListResponse> {
    const query = new URLSearchParams();
    if (params.imei?.trim()) query.append('imei', params.imei.trim());
    if (params.serialNumber?.trim()) query.append('serialNumber', params.serialNumber.trim());
    if (params.productId) query.append('productId', params.productId);
    if (params.location) query.append('location', params.location);
    if (params.status) query.append('status', params.status);

    const queryString = query.toString();
    const res = await apiClient<ProductUnitItem[] | UnitListResponse>(`/products/units${queryString ? `?${queryString}` : ''}`);
    
    if (Array.isArray(res)) {
      return { data: res };
    }
    return res;
  },

  async getUnit(unitId: string): Promise<ProductUnitItem> {
    return apiClient<ProductUnitItem>(`/products/units/${unitId}`);
  },

  async getUnitHistory(unitId: string): Promise<UnitHistoryResponse> {
    return apiClient<UnitHistoryResponse>(`/products/units/${unitId}/history`);
  },

  async createProduct(data: CreateProductRequest): Promise<{ data: ProductItem } | ProductItem> {
    const res = await apiClient<{ data: ProductItem } | ProductItem>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    productCache.clear();
    return res;
  },

  async updateProduct(
    id: string,
    data: UpdateProductRequest,
  ): Promise<{ data: ProductItem } | ProductItem> {
    const res = await apiClient<{ data: ProductItem } | ProductItem>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    productCache.clear();
    return res;
  },

  async updateProductStatus(
    id: string,
    isActive: boolean,
  ): Promise<{ data: ProductItem } | ProductItem> {
    const res = await apiClient<{ data: ProductItem } | ProductItem>(`/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    productCache.clear();
    return res;
  },

  clearCache(): void {
    productCache.clear();
    pendingRequests.clear();
  },
};
