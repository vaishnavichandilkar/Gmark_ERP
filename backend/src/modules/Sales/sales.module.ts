import { Module } from '@nestjs/common';
import { SalesOrderModule } from './sales-order/sales-order.module';
import { SalesInvoiceMainModule } from './sales-invoice/sales-invoice.module';

@Module({
    imports: [SalesOrderModule, SalesInvoiceMainModule],
})
export class SalesModule { }
