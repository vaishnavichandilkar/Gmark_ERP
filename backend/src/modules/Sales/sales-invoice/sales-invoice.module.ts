import { Module } from '@nestjs/common';
import { SalesInvoiceModule } from './invoice/invoice.module';
import { ChallanModule } from './Challan/challan.module';

@Module({
  imports: [SalesInvoiceModule, ChallanModule],
  exports: [SalesInvoiceModule, ChallanModule],
})
export class SalesInvoiceMainModule { }
