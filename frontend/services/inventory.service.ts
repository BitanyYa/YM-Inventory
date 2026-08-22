import { apiClient } from '../lib/api-client';
import {
  InventoryListResponse,
  InventoryProductItem,
  InventorySummaryResponse,
  PaginationMeta,
  QueryInventoryParams,
  ReceiveStockRequest,
  TransferStockRequest,
  SellStockRequest,
  ReturnStockRequest,
  DamageLossStockRequest,
  ProductDetailResponse,
} from '../types/api';

/**
 * Raw shape returned by GET /inventory.
 * The backend nests product fields under a `product` key alongside
 * `inventory`, `stockStatus`, and `unitSummary` at the top level.
 */
interface RawInventoryItem {
  product: {
    id: string;
    name: string;
    brand: string;
    productType: string;
    trackingType: string;
    sellingPrice: number;
    minimumStock: number;
    isActive: boolean;
    description?: string | null;
    image?: string | null;
    category?: { id: string; name: string } | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  inventory: {
    warehouseQuantity: number;
    shopQuantity: number;
    totalQuantity: number;
  };
  stockStatus: string;
  unitSummary?: {
    totalAvailable: number;
    warehouseAvailable: number;
    shopAvailable: number;
  } | null;
}

interface RawInventoryListResponse {
  data: RawInventoryItem[];
  meta: PaginationMeta;
}

/** Flatten nested backend shape → flat InventoryProductItem */
function flattenItem(raw: RawInventoryItem): InventoryProductItem {
  return {
    ...raw.product,
    productType: raw.product.productType as InventoryProductItem['productType'],
    trackingType: raw.product.trackingType as InventoryProductItem['trackingType'],
    inventory: raw.inventory,
    stockStatus: raw.stockStatus as InventoryProductItem['stockStatus'],
    unitSummary: raw.unitSummary ?? null,
  };
}

export const inventoryService = {
  /**
   * GET /inventory
   * Backend returns { data: [{ product, inventory, stockStatus, unitSummary }] }.
   * We flatten each item into the InventoryProductItem shape expected by the UI.
   */
  async getInventory(params: QueryInventoryParams = {}): Promise<InventoryListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search?.trim()) q.append('search', params.search.trim());
    if (params.categoryId) q.append('categoryId', params.categoryId);
    if (params.productType) q.append('productType', params.productType);
    if (params.trackingType) q.append('trackingType', params.trackingType);
    if (params.location) q.append('location', params.location);
    if (params.stockStatus) q.append('stockStatus', params.stockStatus);
    if (params.isActive !== undefined) {
      q.append('isActive', params.isActive.toString());
    }
    const qs = q.toString();
    const raw = await apiClient<RawInventoryListResponse>(`/inventory${qs ? `?${qs}` : ''}`);
    return {
      data: (raw.data ?? []).map(flattenItem),
      meta: raw.meta,
    };
  },

  /**
   * GET /inventory/summary
   * Aggregate counts: total products, warehouse units, shop units, alerts.
   */
  async getInventorySummary(): Promise<InventorySummaryResponse> {
    return apiClient<InventorySummaryResponse>('/inventory/summary');
  },

  /**
   * GET /inventory/products/:productId
   * Detailed inventory view for a single product (used in modals to load units).
   */
  async getProductInventoryDetail(productId: string): Promise<ProductDetailResponse> {
    return apiClient<ProductDetailResponse>(`/inventory/products/${productId}`);
  },

  /* ─── Stock Mutations ───────────────────────────────────────────────────── */

  /**
   * POST /stock/receive
   * Receive new stock into WAREHOUSE.
   */
  async receiveStock(data: ReceiveStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/transfer
   * Transfer stock from WAREHOUSE → SHOP.
   */
  async transferStock(data: TransferStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/sell
   * Sell stock from SHOP.
   */
  async sellStock(data: SellStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/return
   * Return sold stock back to WAREHOUSE or SHOP.
   */
  async returnStock(data: ReturnStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/return', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/damage
   * Mark stock as damaged at a specific location.
   */
  async damageStock(data: DamageLossStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/damage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * POST /stock/loss
   * Record a stock loss at a specific location.
   */
  async lossStock(data: DamageLossStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/loss', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
