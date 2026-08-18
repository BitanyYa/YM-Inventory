import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';
import { QuerySalesReportDto } from './dto/query-sales-report.dto';
import { QueryProfitReportDto } from './dto/query-profit-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PRIMARY_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-movements')
  @ApiOperation({
    summary:
      'Get aggregated stock movement reports by period, movement type, and product breakdown (supports single date filter "date")',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock movement report generated successfully',
  })
  async getStockMovementsReport(@Query() query: QueryStockReportDto) {
    return this.reportsService.getStockMovementsReport(query);
  }

  @Get('inventory-value')
  @ApiOperation({
    summary:
      'Get current inventory valuation report (warehouse value, shop value, total inventory value, and per-product valuation)',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory valuation report generated successfully',
  })
  async getInventoryValueReport() {
    return this.reportsService.getInventoryValueReport();
  }

  @Get('sales')
  @ApiOperation({
    summary:
      'Get aggregated sales report (total sales count, total quantity sold, total revenue value, and per-product sales breakdown; supports single date filter "date")',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales report generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. startDate after endDate or invalid enum format)',
  })
  async getSalesReport(@Query() query: QuerySalesReportDto) {
    return this.reportsService.getSalesReport(query);
  }

  @Get('profit')
  @ApiOperation({
    summary:
      'Get gross profit report (revenue, COGS, gross profit, gross margin %, and per-product profit breakdown; supports single date filter "date")',
  })
  @ApiResponse({
    status: 200,
    description: 'Profit report generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. startDate after endDate or invalid enum format)',
  })
  async getProfitReport(@Query() query: QueryProfitReportDto) {
    return this.reportsService.getProfitReport(query);
  }
}
