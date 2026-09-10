import { Module } from '@nestjs/common';
import { ShiftMasterController } from './shift-master.controller';
import { ShiftMasterService } from './shift-master.service';

@Module({
    controllers: [ShiftMasterController],
    providers: [ShiftMasterService],
    exports: [ShiftMasterService],
})
export class ShiftMasterModule {}
