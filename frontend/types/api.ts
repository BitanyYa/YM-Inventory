export type UserRole = 'PRIMARY_ADMIN' | 'ADMIN' | 'USER';
export type MovementType =
  | 'STOCK_IN'
  | 'TRANSFER'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'LOSS'
  | 'ADJUSTMENT';
export type Location = 'WAREHOUSE' | 'SHOP';
export type ProductType =
  | 'PHONE'
  | 'ACCESSORY'
  | 'TABLET'
  | 'LAPTOP'
  | 'SMART_WATCH'
  | 'OTHER';
export type TrackingType = 'QUANTITY' | 'SERIALIZED';
export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* Category Types */
export interface Category {
  id: string;
  name: string;
  description?: string | null;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/* Product Types */
export interface ProductInventorySummary {
  warehouseQuantity: number;
  shopQuantity: number;
  totalQuantity: number;
}

export interface SerializedUnitSummary {
  totalAvailable: number;
  warehouseAvailable: number;
  shopAvailable: number;
}

export interface ProductMovementSummaryCounts {
  stockIn: number;
  transfers: number;
  sales: number;
  returns: number;
  damages: number;
  losses: number;
}

export interface ProductUnitItem {
  id: string;
  imei?: string | null;
  serialNumber?: string | null;
  storage?: number | string | null;
  color?: string | null;
  purchasePrice?: number | null;
  location: Location;
  status: 'AVAILABLE' | 'IN_SHOP' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'UNACCOUNTED' | string;
  createdAt?: string;
  updatedAt?: string;
  product?: {
    id: string;
    name: string;
    brand: string;
    productType?: ProductType;
    trackingType?: TrackingType;
    sellingPrice?: number;
    category?: { id: string; name: string } | null;
  };
}

export interface QueryProductUnitParams {
  page?: number;
  limit?: number;
  imei?: string;
  serialNumber?: string;
  productId?: string;
  location?: Location | '';
  status?: string;
  search?: string;
  productType?: ProductType | '';
  categoryId?: string;
}

export interface UnitHistoryMovementItem {
  movementId: string;
  movementType: MovementType;
  quantity: number;
  fromLocation?: Location | null;
  toLocation?: Location | null;
  costPrice?: number | null;
  note?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export interface UnitHistoryResponse {
  unit: ProductUnitItem;
  summary: {
    totalMovements: number;
    firstMovementAt: string | null;
    lastMovementAt: string | null;
  };
  history: UnitHistoryMovementItem[];
}

export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  description?: string | null;
  image?: string | null;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice: number;
  minimumStock: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
  } | null;
  inventory: ProductInventorySummary;
  stockStatus: InventoryStockStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProductDetail extends ProductItem {
  unitSummary?: SerializedUnitSummary | null;
  units?: ProductUnitItem[];
  movementSummary?: ProductMovementSummaryCounts;
}

export interface ProductListResponse {
  data: ProductItem[];
  meta: PaginationMeta;
}

export interface ProductDetailResponse {
  data: ProductDetail;
}

export interface QueryProductParams {
  page?: number;
  limit?: number;
  search?: string;
  productType?: ProductType | '';
  trackingType?: TrackingType | '';
  categoryId?: string | '';
  isActive?: boolean | string;
  stockStatus?: InventoryStockStatus | '';
}

export interface CreateProductRequest {
  name: string;
  brand: string;
  categoryId: string;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice: number;
  minimumStock?: number;
  description?: string;
  image?: string;
}

export interface UpdateProductRequest {
  name?: string;
  brand?: string;
  categoryId?: string;
  sellingPrice?: number;
  minimumStock?: number;
  description?: string;
  image?: string;
  isActive?: boolean;
}

/* Dashboard & Stock Summary Types */
export interface InventorySummary {
  warehouseQuantity: number;
  shopQuantity: number;
  totalQuantity: number;
}

export interface SerializedUnitsSummary {
  warehouseAvailable: number;
  shopAvailable: number;
  totalAvailable: number;
}

export interface ProductSummary {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
  lowStock: number;
  inStock: number;
}

export interface MovementSummary {
  stockIn: number;
  transfers: number;
  sales: number;
  returns: number;
  damages: number;
  losses: number;
  total: number;
}

export interface SalesSummary {
  totalTransactions: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface ReturnsSummary {
  totalTransactions: number;
  totalQuantity: number;
}

export interface AlertsSummary {
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface StockSummaryData {
  inventory: InventorySummary;
  serializedUnits: SerializedUnitsSummary;
  products: ProductSummary;
  movements: MovementSummary;
  sales: SalesSummary;
  returns: ReturnsSummary;
  alerts: AlertsSummary;
}

export interface StockSummaryResponse {
  data: StockSummaryData;
}

export interface InventoryAlertProduct {
  id: string;
  name: string;
  brand: string;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice: number;
  minimumStock: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface InventoryAlert {
  product: InventoryAlertProduct;
  inventory: InventorySummary;
  unitSummary?: SerializedUnitsSummary | null;
  stockStatus: InventoryStockStatus;
  shortage: number;
}

export interface InventoryAlertsResponse {
  data: InventoryAlert[];
  meta: PaginationMeta;
}

export interface StockMovementProduct {
  id: string;
  name: string;
  brand: string;
  productType: ProductType;
  trackingType: TrackingType;
  sellingPrice?: number;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface StockMovementUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface StockMovementUnitItem {
  id: string;
  imei?: string | null;
  serialNumber?: string | null;
  storage?: string | number | null;
  color?: string | null;
  purchasePrice?: number | null;
  location: Location;
  status: string;
}

export interface StockBatchItem {
  id: string;
  reference?: string | null;
  note?: string | null;
  createdById?: string;
  createdAt?: string;
}

export interface StockMovementItem {
  id: string;
  productId: string;
  movementType: MovementType;
  fromLocation?: Location | null;
  toLocation?: Location | null;
  quantity: number;
  costPrice?: number | null;
  note?: string | null;
  createdById: string;
  createdAt: string;
  product: StockMovementProduct;
  createdBy?: StockMovementUser;
  units?: StockMovementUnitItem[];
  stockBatch?: StockBatchItem | null;
}

export interface StockMovementsResponse {
  data: StockMovementItem[];
  meta: PaginationMeta;
}

export interface StockMovementDetailResponse {
  data: StockMovementItem;
}

export interface QueryStockMovementParams {
  page?: number;
  limit?: number;
  productId?: string;
  productType?: ProductType | '';
  trackingType?: TrackingType | '';
  movementType?: MovementType | '';
  location?: Location | '';
  fromLocation?: Location | '';
  toLocation?: Location | '';
  createdById?: string;
  search?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}

/* ─── Inventory Query & Response Types ─────────────────────────────────────── */

export interface QueryInventoryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  productType?: ProductType | '';
  trackingType?: TrackingType | '';
  location?: Location | '';
  stockStatus?: InventoryStockStatus | '';
  isActive?: boolean;
}

export interface InventoryProductItem extends ProductItem {
  /* ProductItem already carries inventory: ProductInventorySummary
     and unitSummary is optional on the detail response.
     This alias makes intent explicit when used in inventory contexts. */
  unitSummary?: SerializedUnitSummary | null;
}

export interface InventoryListResponse {
  data: InventoryProductItem[];
  meta: PaginationMeta;
}

/* GET /inventory/summary */
export interface InventorySummaryByType {
  PHONE: number;
  ACCESSORY: number;
  TABLET: number;
  LAPTOP: number;
  SMART_WATCH: number;
  OTHER: number;
}

export interface InventorySummaryData {
  totalProducts: number;
  totalUnits: number;
  warehouseUnits: number;
  shopUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface InventorySummaryResponse {
  data: InventorySummaryData;
}

/* ─── Stock Operation Request Types ─────────────────────────────────────────── */

export interface ReceiveUnitRequest {
  imei: string;
  serialNumber?: string;
  storage?: number;
  color?: string;
  purchasePrice: number;
}

export interface ReceiveStockRequest {
  productId: string;
  /* QUANTITY fields */
  quantity?: number;
  purchasePrice?: number;
  /* SERIALIZED fields */
  units?: ReceiveUnitRequest[];
  reference?: string;
  note?: string;
}

export interface TransferStockRequest {
  productId: string;
  fromLocation?: Location;
  toLocation?: Location;
  quantity?: number;
  unitIds?: string[];
  note?: string;
}

export interface SellStockRequest {
  productId: string;
  quantity?: number;
  unitIds?: string[];
  note?: string;
}

export interface ReturnStockRequest {
  productId: string;
  quantity?: number;
  unitIds?: string[];
  location?: Location;
  note?: string;
}

export interface DamageLossStockRequest {
  productId: string;
  quantity?: number;
  unitIds?: string[];
  location: Location;
  note?: string;
}

export interface AdjustStockRequest {
  productId: string;
  movementType?: MovementType;
  type?: MovementType;
  quantity?: number;
  unitIds?: string[];
  location?: Location;
  note?: string;
}

export interface ReconcileStockRequest {
  productId: string;
  location: Location;
  actualCount?: number;
  physicalCount?: number;
  verifiedUnitIds?: string[];
  note?: string;
}

export interface ReconcileStockResponse {
  message: string;
  reconciled: boolean;
  movementId?: string;
  productId: string;
  productName: string;
  location: Location;
  previousQuantity?: number;
  actualCount?: number;
  physicalCount?: number;
  difference: number;
  missingUnitsCount?: number;
  foundUnitsCount?: number;
}

