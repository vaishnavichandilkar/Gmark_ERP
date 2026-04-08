import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { PurchaseInvoiceModule } from './purchase-invoice/purchase-invoice.module';
import { GrnModule } from './grn/grn.module';

@Module({
  imports: [PurchaseOrderModule, PurchaseInvoiceModule, GrnModule],
  exports: [PurchaseOrderModule, PurchaseInvoiceModule, GrnModule],
})
export class PurchaseModule {}
