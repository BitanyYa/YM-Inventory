import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryLowStockDto } from './dto/query-low-stock.dto';

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
      'Current inventory statistics (totalProducts, totalUnits, warehouseUnits, shopUnits, lowStockProducts, outOfStockProducts)',
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
