import { Module } from '@nestjs/common';
import { DepartmentMasterController } from './department-master.controller';
import { DepartmentMasterService } from './department-master.service';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [DepartmentMasterController],
    providers: [DepartmentMasterService],
    exports: [DepartmentMasterService],
})
export class DepartmentMasterModule { }
