import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-movements')
  @ApiOperation({
    summary:
      'Get aggregated stock movement reports by period, movement type, and product breakdown',
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
}
