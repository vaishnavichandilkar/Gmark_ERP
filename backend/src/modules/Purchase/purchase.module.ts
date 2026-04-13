import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { PurchaseInvoiceModule } from './purchase-invoice/invoice.module';
import { GrnModule } from './purchase-invoice/grn/grn.module';

@Module({
  imports: [PurchaseOrderModule, PurchaseInvoiceModule, GrnModule],
  exports: [PurchaseOrderModule, PurchaseInvoiceModule, GrnModule],
})
export class PurchaseModule { }
