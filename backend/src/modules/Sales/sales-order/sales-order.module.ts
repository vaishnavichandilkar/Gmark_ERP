import { Module } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';

@Module({
    controllers: [SalesOrderController],
    providers: [SalesOrderService],
    exports: [SalesOrderService],
})
export class SalesOrderModule { }
