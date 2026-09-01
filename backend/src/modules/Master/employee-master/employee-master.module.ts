import { Module } from '@nestjs/common';
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterService } from './employee-master.service';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [EmployeeMasterController],
    providers: [EmployeeMasterService],
    exports: [EmployeeMasterService],
})
export class EmployeeMasterModule { }
