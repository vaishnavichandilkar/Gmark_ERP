import { Module } from '@nestjs/common';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { PurchaseInvoiceController } from './purchase-invoice.controller';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { PurchaseOrderModule } from '../purchase-order/purchase-order.module';

@Module({
  imports: [PrismaModule, PurchaseOrderModule],
  controllers: [PurchaseInvoiceController],
  providers: [PurchaseInvoiceService],
  exports: [PurchaseInvoiceService],
})
export class PurchaseInvoiceModule {}
