import { Module } from '@nestjs/common';
import { SalesInvoiceService } from './invoice.service';
import { SalesInvoiceController } from './invoice.controller';
import { PrismaModule } from '../../../../infrastructure/prisma/prisma.module';
import { SalesOrderModule } from '../../sales-order/sales-order.module';
import { FinanceModule } from '../../../Finance/finance.module';

@Module({
  imports: [PrismaModule, SalesOrderModule, FinanceModule],
  controllers: [SalesInvoiceController],
  providers: [SalesInvoiceService],
  exports: [SalesInvoiceService],
})
export class SalesInvoiceModule { }
