import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchTransfersController } from './branch-transfers.controller';
import { BranchTransfersService } from './branch-transfers.service';

@Module({
  imports: [PrismaModule],
  controllers: [BranchTransfersController],
  providers: [BranchTransfersService],
  exports: [BranchTransfersService],
})
export class BranchTransfersModule {}
