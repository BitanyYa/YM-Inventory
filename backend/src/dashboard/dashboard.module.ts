import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [InventoryModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
