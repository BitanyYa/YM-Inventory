import { apiClient } from '../lib/api-client';
import {
  InventoryAlertsResponse,
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
  AdjustStockRequest,
  ProductDetailResponse,
  ProductUnitItem,
  ReconcileStockRequest,
  ReconcileStockResponse,
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

const inventoryCache = new Map<string, { data: InventoryListResponse; timestamp: number }>();
const inventoryPendingRequests = new Map<string, Promise<InventoryListResponse>>();
const INVENTORY_CACHE_TTL_MS = 15000;

let cachedSummary: { data: InventorySummaryResponse; timestamp: number } | null = null;
let pendingSummaryPromise: Promise<InventorySummaryResponse> | null = null;

export function invalidateInventoryCache(): void {
  inventoryCache.clear();
  cachedSummary = null;
}

export const inventoryService = {
  /** Invalidate in-memory inventory list and summary caches */
  invalidateCache(): void {
    invalidateInventoryCache();
  },

  /**
   * GET /inventory
   * We flatten each item into the InventoryProductItem shape expected by the UI.
   */
  async getInventory(params: QueryInventoryParams = {}, forceRefresh = false): Promise<InventoryListResponse> {
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
    const endpoint = `/inventory${qs ? `?${qs}` : ''}`;

    if (!forceRefresh) {
      const cached = inventoryCache.get(endpoint);
      if (cached && Date.now() - cached.timestamp < INVENTORY_CACHE_TTL_MS) {
        return cached.data;
      }
      if (inventoryPendingRequests.has(endpoint)) {
        return inventoryPendingRequests.get(endpoint)!;
      }
    }

    const promise = apiClient<RawInventoryListResponse>(endpoint)
      .then((raw) => {
        const result: InventoryListResponse = {
          data: (raw.data ?? []).map(flattenItem),
          meta: raw.meta,
        };
        inventoryCache.set(endpoint, { data: result, timestamp: Date.now() });
        inventoryPendingRequests.delete(endpoint);
        return result;
      })
      .catch((err) => {
        inventoryPendingRequests.delete(endpoint);
        throw err;
      });

    inventoryPendingRequests.set(endpoint, promise);
    return promise;
  },

  /**
   * GET /inventory/alerts
   * Products that are LOW_STOCK or OUT_OF_STOCK, sorted by urgency.
   */
  async getInventoryAlerts(params: {
    page?: number;
    limit?: number;
    alertType?: 'LOW_STOCK' | 'OUT_OF_STOCK';
    search?: string;
    categoryId?: string;
    productType?: string;
    trackingType?: string;
  } = {}): Promise<InventoryAlertsResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.alertType) q.append('alertType', params.alertType);
    if (params.search?.trim()) q.append('search', params.search.trim());
    if (params.categoryId) q.append('categoryId', params.categoryId);
    if (params.productType) q.append('productType', params.productType);
    if (params.trackingType) q.append('trackingType', params.trackingType);
    const qs = q.toString();
    return apiClient<InventoryAlertsResponse>(`/inventory/alerts${qs ? `?${qs}` : ''}`);
  },

  /**
   * GET /inventory/summary
   * Aggregate counts: total products, warehouse units, shop units, alerts.
   */
  async getInventorySummary(forceRefresh = false): Promise<InventorySummaryResponse> {
    if (!forceRefresh) {
      if (cachedSummary && Date.now() - cachedSummary.timestamp < INVENTORY_CACHE_TTL_MS) {
        return cachedSummary.data;
      }
      if (pendingSummaryPromise) {
        return pendingSummaryPromise;
      }
    }
    pendingSummaryPromise = apiClient<InventorySummaryResponse>('/inventory/summary')
      .then((res) => {
        cachedSummary = { data: res, timestamp: Date.now() };
        pendingSummaryPromise = null;
        return res;
      })
      .catch((err) => {
        pendingSummaryPromise = null;
        throw err;
      });
    return pendingSummaryPromise;
  },

  /**
   * GET /inventory/products/:productId
   * Detailed inventory view for a single product (used in modals to load units).
   */
  async getProductInventoryDetail(productId: string): Promise<ProductDetailResponse> {
    const raw = await apiClient<{ units?: ProductUnitItem[]; product?: any; inventory?: any; unitSummary?: any; data?: any }>(`/inventory/products/${productId}`);
    if (raw && raw.data) {
      return raw as ProductDetailResponse;
    }
    return {
      data: {
        ...(raw?.product ?? {}),
        inventory: raw?.inventory ?? {},
        unitSummary: raw?.unitSummary ?? null,
        units: raw?.units ?? [],
      } as any,
    };
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
    invalidateInventoryCache();
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
    invalidateInventoryCache();
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
    invalidateInventoryCache();
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
    invalidateInventoryCache();
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
    invalidateInventoryCache();
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
    invalidateInventoryCache();
  },

  /**
   * POST /stock/adjust
   * Adjust stock for DAMAGE or LOSS at a specific location.
   */
  async adjustStock(data: AdjustStockRequest): Promise<void> {
    await apiClient<unknown>('/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateInventoryCache();
  },

  /**
   * GET /stock/movements
   * Paginated stock movement audit log with support for search, location, type, and date range filters.
   */
  async getMovements(params: import('../types/api').QueryStockMovementParams = {}): Promise<import('../types/api').StockMovementsResponse> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search?.trim()) q.append('search', params.search.trim());
    if (params.productId) q.append('productId', params.productId);
    if (params.productType) q.append('productType', params.productType);
    if (params.trackingType) q.append('trackingType', params.trackingType);
    if (params.movementType) q.append('movementType', params.movementType);
    if (params.location) q.append('location', params.location);
    if (params.fromLocation) q.append('fromLocation', params.fromLocation);
    if (params.toLocation) q.append('toLocation', params.toLocation);
    if (params.createdById) q.append('createdById', params.createdById);
    if (params.date) q.append('date', params.date);
    if (params.startDate) q.append('startDate', params.startDate);
    if (params.endDate) q.append('endDate', params.endDate);
    const qs = q.toString();
    return apiClient<import('../types/api').StockMovementsResponse>(`/stock/movements${qs ? `?${qs}` : ''}`);
  },

  /**
   * GET /stock/movements/:id
   * Complete detail of a single stock movement including creator, category, batch, and serialized units.
   */
  async getMovement(id: string): Promise<import('../types/api').StockMovementDetailResponse> {
    return apiClient<import('../types/api').StockMovementDetailResponse>(`/stock/movements/${id}`);
  },

  /**
   * POST /stock/reconcile
   * Physical inventory audit reconciliation for QUANTITY or SERIALIZED products (ADMIN only).
   */
  async reconcileStock(data: ReconcileStockRequest): Promise<ReconcileStockResponse> {
    const res = await apiClient<ReconcileStockResponse>('/stock/reconcile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateInventoryCache();
    return res;
  },
};

