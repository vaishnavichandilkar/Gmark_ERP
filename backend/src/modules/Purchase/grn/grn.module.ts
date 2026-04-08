import { Module } from '@nestjs/common';
import { GrnController } from './grn.controller';
import { GrnService } from './grn.service';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { PurchaseOrderModule } from '../purchase-order/purchase-order.module';
import { PurchaseInvoiceModule } from '../purchase-invoice/purchase-invoice.module';

@Module({
  imports: [PrismaModule, PurchaseOrderModule, PurchaseInvoiceModule],
  controllers: [GrnController],
  providers: [GrnService],
})
export class GrnModule {}
