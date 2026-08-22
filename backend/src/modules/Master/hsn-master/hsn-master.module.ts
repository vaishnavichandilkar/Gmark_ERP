import { Module } from '@nestjs/common';
import { HsnMasterService } from './hsn-master.service';
import { HsnMasterController } from './hsn-master.controller';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { ImportValidationModule } from '../../../common/services/import-validation.module';

@Module({
    imports: [PrismaModule, ImportValidationModule],
    providers: [HsnMasterService],
    controllers: [HsnMasterController],
    exports: [HsnMasterService],
})
export class HsnMasterModule { }
