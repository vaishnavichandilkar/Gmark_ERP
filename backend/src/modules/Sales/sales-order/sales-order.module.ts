import { Module } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';
import { ImportValidationModule } from '../../../common/services/import-validation.module';

@Module({
    imports: [ImportValidationModule],
    controllers: [SalesOrderController],
    providers: [SalesOrderService],
    exports: [SalesOrderService],
})
export class SalesOrderModule { }
