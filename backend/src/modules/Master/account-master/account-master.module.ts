import { Module } from '@nestjs/common';
import { AccountMasterService } from './account-master.service';
import { AccountMasterController } from './account-master.controller';
import { GroupMasterModule } from '../group-master/group-master.module';

@Module({
  imports: [GroupMasterModule],
  providers: [AccountMasterService],
  controllers: [AccountMasterController]
})
export class AccountMasterModule {}
