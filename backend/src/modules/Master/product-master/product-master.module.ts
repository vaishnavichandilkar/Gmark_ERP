import { Module } from '@nestjs/common';
import { ProductMasterService } from './services/product-master.service';
import { ProductMasterController } from './controllers/product-master.controller';
import { ProductMasterRepository } from './repositories/product-master.repository';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { HsnMasterModule } from '../hsn-master/hsn-master.module';
import { ImportValidationModule } from '../../../common/services/import-validation.module';

@Module({
  imports: [PrismaModule, HsnMasterModule, ImportValidationModule],
  providers: [ProductMasterService, ProductMasterRepository],
  controllers: [ProductMasterController],
  exports: [ProductMasterService]
})
export class ProductMasterModule { }
