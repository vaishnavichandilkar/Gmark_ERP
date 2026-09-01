import { Module } from '@nestjs/common';
import { CostCentreMasterController } from './cost-centre-master.controller';
import { CostCentreMasterService } from './cost-centre-master.service';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CostCentreMasterController],
    providers: [CostCentreMasterService],
    exports: [CostCentreMasterService],
})
export class CostCentreMasterModule { }
