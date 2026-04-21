import { Module } from '@nestjs/common';
import { ChallanController } from './challan.controller';
import { ChallanService } from './challan.service';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { SalesOrderModule } from '../../sales-order/sales-order.module';
import { SalesInvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, SalesOrderModule, SalesInvoiceModule],
  controllers: [ChallanController],
  providers: [ChallanService],
})
export class ChallanModule { }
