import { Module } from '@nestjs/common';
import { SalesOrderModule } from './sales-order/sales-order.module';

@Module({
    imports: [SalesOrderModule],
})
export class SalesModule { }
