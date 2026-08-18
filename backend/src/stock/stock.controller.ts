import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { StockService } from './stock.service';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { SellStockDto } from './dto/sell-stock.dto';
import { ReturnStockDto } from './dto/return-stock.dto';
import { QueryStockMovementDto } from './dto/query-stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockTransferDto } from './dto/query-stock-transfer.dto';
import { QueryStockReceiptDto } from './dto/query-stock-receipt.dto';
import { QueryStockSaleDto } from './dto/query-stock-sale.dto';
import { QueryStockReturnDto } from './dto/query-stock-return.dto';
import { QueryMovementSummaryDto } from './dto/query-movement-summary.dto';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements/summary')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get aggregated stock movement dashboard summary statistics (total movements, total units, counts & quantities by movement type, location breakdown, 5 recent movements, top 5 products)',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock movement summary statistics retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. startDate > endDate)',
  })
  async getMovementSummary(@Query() query: QueryMovementSummaryDto) {
    return this.stockService.getMovementSummary(query);
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated stock movement history with optional filters (page, limit, productId, movementType, fromLocation, toLocation, date, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock movements ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, or limit > 100)',
  })
  async getMovements(@Query() query: QueryStockMovementDto) {
    return this.stockService.findMovements(query);
  }

  @Get('transfers')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated stock transfer history with optional filters (page, limit, productId, fromLocation, toLocation, date, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock transfers ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, or limit > 100 or startDate > endDate)',
  })
  async getTransfers(@Query() query: QueryStockTransferDto) {
    return this.stockService.findTransfers(query);
  }

  @Get('receipts')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated stock-in / receiving history with optional filters (page, limit, productId, location, date, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock receipts ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, limit > 100, or startDate > endDate)',
  })
  async getReceipts(@Query() query: QueryStockReceiptDto) {
    return this.stockService.findReceipts(query);
  }

  @Get('sales')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated sales transaction history with optional filters (page, limit, productId, productType, trackingType, search, date, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of sale transactions ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, limit > 100, or startDate > endDate)',
  })
  async getSales(@Query() query: QueryStockSaleDto) {
    return this.stockService.findSales(query);
  }

  @Get('returns')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated stock return history with optional filters (page, limit, productId, location, productType, trackingType, search, date, startDate, endDate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stock returns ordered newest first with metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, limit > 100, or startDate > endDate)',
  })
  async getReturns(@Query() query: QueryStockReturnDto) {
    return this.stockService.findReturns(query);
  }

  @Get('movements/:id')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get detailed stock movement information by ID',
  })
  @ApiParam({ name: 'id', description: 'Stock Movement UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Stock movement details with product, creator, batch, and associated units',
  })
  @ApiResponse({ status: 404, description: 'Stock movement not found' })
  async findMovementById(@Param('id') id: string) {
    return this.stockService.findMovementById(id);
  }

  @Post('receive')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({
    summary: 'Receive stock (stock in) for QUANTITY or SERIALIZED products into Warehouse',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully received into warehouse',
  })
  @ApiResponse({ status: 400, description: 'Validation or logic error' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Batch reference or IMEI duplicate conflict' })
  async receiveStock(
    @Body() dto: ReceiveStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.receiveStock(dto, userId);
  }

  @Post('transfer')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({
    summary: 'Transfer stock from Warehouse to Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully transferred from Warehouse to Shop',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, insufficient warehouse stock, or invalid unit status/location',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async transferStock(
    @Body() dto: TransferStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.transferStock(dto, userId);
  }

  @Post('sell')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Sell stock from Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully sold from Shop',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, insufficient shop stock, or invalid unit status/location',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async sellStock(
    @Body() dto: SellStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.sellStock(dto, userId);
  }

  @Post('return')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({
    summary: 'Return sold stock to Warehouse or Shop for QUANTITY or SERIALIZED products',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully returned to destination location',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, invalid destination location, inactive product, or invalid unit status (must be SOLD)',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async returnStock(
    @Body() dto: ReturnStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.returnStock(dto, userId);
  }

  @Post('adjust')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({
    summary: 'Adjust stock for DAMAGE or LOSS (QUANTITY or SERIALIZED products)',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock successfully adjusted for DAMAGE or LOSS',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, invalid movement type, or insufficient stock / invalid unit status',
  })
  @ApiResponse({ status: 404, description: 'Product or ProductUnit not found' })
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.stockService.adjustStock(dto, userId);
  }
}
