import { Module } from '@nestjs/common';
import { PurchaseInvoiceService } from './invoice.service';
import { PurchaseInvoiceController } from './invoice.controller';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { PurchaseOrderModule } from '../purchase-order/purchase-order.module';
import { FinanceModule } from '../../Finance/finance.module';

@Module({
  imports: [PrismaModule, PurchaseOrderModule, FinanceModule],
  controllers: [PurchaseInvoiceController],
  providers: [PurchaseInvoiceService],
  exports: [PurchaseInvoiceService],
})
export class PurchaseInvoiceModule { }
