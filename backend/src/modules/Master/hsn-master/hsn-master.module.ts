import { Module } from '@nestjs/common';
import { HsnMasterService } from './hsn-master.service';
import { HsnMasterController } from './hsn-master.controller';

@Module({
    providers: [HsnMasterService],
    controllers: [HsnMasterController],
    exports: [HsnMasterService],
})
export class HsnMasterModule { }
