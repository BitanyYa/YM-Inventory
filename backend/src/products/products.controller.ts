import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryProductUnitDto } from './dto/query-product-unit.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden for normal users' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get paginated products with optional filters (page, limit, search, productType, trackingType, categoryId, isActive, stockStatus)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of products ordered newest first with current inventory breakdown and calculated stockStatus',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. page < 1, limit < 1, limit > 100, or invalid enum filter)',
  })
  async findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('units')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Search ProductUnits with optional filters (imei, serialNumber, productId, location, status)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching ProductUnits ordered newest first with product details',
  })
  async findAllUnits(@Query() query: QueryProductUnitDto) {
    return this.productsService.findAllUnits(query);
  }

  @Get('units/:unitId/history')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get complete stock movement lifecycle history of a ProductUnit by ID' })
  @ApiParam({ name: 'unitId', description: 'ProductUnit UUID' })
  @ApiResponse({
    status: 200,
    description: 'Chronological stock movement history of the product unit',
  })
  @ApiResponse({ status: 404, description: 'ProductUnit not found' })
  async findUnitHistory(@Param('unitId') unitId: string) {
    return this.productsService.findUnitHistory(unitId);
  }

  @Get('units/:unitId')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get ProductUnit details by unit ID' })
  @ApiParam({ name: 'unitId', description: 'ProductUnit UUID' })
  @ApiResponse({
    status: 200,
    description: 'ProductUnit details with associated product info',
  })
  @ApiResponse({ status: 404, description: 'ProductUnit not found' })
  async findUnit(@Param('unitId') unitId: string) {
    return this.productsService.findUnit(unitId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary:
      'Get complete product overview by ID including category, inventory breakdown, dynamic stockStatus, unitSummary, serialized units, and stock movementSummary counts',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Product details with category, current inventory quantities, unit summary, serialized units, and movement summary counts',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/units')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get all ProductUnits for a SERIALIZED product ordered by creation date',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of product units belonging to the serialized product',
  })
  @ApiResponse({
    status: 400,
    description: 'Product is QUANTITY-tracked (units only apply to SERIALIZED products)',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findUnits(@Param('id') id: string) {
    return this.productsService.findUnits(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({ summary: 'Update product active status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden for normal users' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({ summary: 'Update product by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden for normal users' })
  @ApiResponse({ status: 404, description: 'Product or Category not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
  @ApiOperation({ summary: 'Soft delete product by ID (sets isActive=false, Admin only)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product soft deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden for normal users' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
