import { Module } from '@nestjs/common';
import { UnitMasterService } from './unit-master.service';
import { UnitMasterController } from './unit-master.controller';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { ImportValidationModule } from '../../../common/services/import-validation.module';

@Module({
  imports: [PrismaModule, ImportValidationModule],
  providers: [UnitMasterService],
  controllers: [UnitMasterController]
})
export class UnitMasterModule {}
