import { Module } from '@nestjs/common';
import { CategoryMasterService } from './services/category-master.service';
import { CategoryMasterController } from './controllers/category-master.controller';
import { CategoryMasterRepository } from './repositories/category-master.repository';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { ImportValidationModule } from '../../../common/services/import-validation.module';

@Module({
  imports: [PrismaModule, ImportValidationModule],
  providers: [CategoryMasterService, CategoryMasterRepository],
  controllers: [CategoryMasterController],
  exports: [CategoryMasterService]
})
export class CategoryMasterModule { }
