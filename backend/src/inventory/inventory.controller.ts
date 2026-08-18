import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';
import { QueryProductMovementDto } from './dto/query-product-movement.dto';
import { QueryStockAlertDto } from './dto/query-stock-alert.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get current inventory summary statistics' })
  @ApiResponse({
    status: 200,
    description:
      'Current inventory statistics (totalProducts, totalUnits, warehouseUnits, shopUnits, lowStockProducts, outOfStockProducts, breakdowns, lowStockItems)',
  })
  async getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low-stock products (at or below minimum stock)' })
  @ApiResponse({
    status: 200,
    description: 'Products currently at or below minimum stock',
  })
  async getLowStock(@Query() query: QueryLowStockDto) {
    return this.inventoryService.getLowStock(query);
  }

  @Get('alerts/stock')
  @ApiOperation({
    summary:
      'Get low stock & out-of-stock reorder report (supports status filter, search, productType, trackingType, location, categoryId, page, limit)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated stock alerts retrieved successfully sorted by urgency',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. invalid status enum)',
  })
  async getStockAlerts(@Query() query: QueryStockAlertDto) {
    return this.inventoryService.getStockAlerts(query);
  }

  @Get('products/:productId/movements')
  @ApiOperation({
    summary:
      'Get paginated stock movement history for ONE specific product by ID (supports movementType, fromLocation, toLocation, date, startDate, endDate)',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description: 'Product movement history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductMovementHistory(
    @Param('productId') productId: string,
    @Query() query: QueryProductMovementDto,
  ) {
    return this.inventoryService.getProductMovementHistory(productId, query);
  }

  @Get('products/:productId')
  @ApiOperation({
    summary:
      'Get complete current stock state, unit summary, and active serialized units for ONE product by ID',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description: 'Product inventory state retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductInventoryDetail(@Param('productId') productId: string) {
    return this.inventoryService.getProductInventoryDetail(productId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get paginated & filterable inventory list (supports page, limit, status, search, productType, trackingType, location, productId)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated inventory state retrieved successfully with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (e.g. page < 1, limit < 1, limit > 100, or invalid status/enum format)',
  })
  async getInventory(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findInventory(query);
  }
}
