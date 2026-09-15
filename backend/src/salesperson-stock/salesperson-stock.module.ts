import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalespersonStockController } from './salesperson-stock.controller';
import { SalespersonStockService } from './salesperson-stock.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalespersonStockController],
  providers: [SalespersonStockService],
  exports: [SalespersonStockService],
})
export class SalespersonStockModule {}
