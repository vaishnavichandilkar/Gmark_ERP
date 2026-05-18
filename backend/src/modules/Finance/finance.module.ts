import { Module, forwardRef } from '@nestjs/common';
import { LedgerModule } from '../Ledger/ledger.module';
import { TransactionService } from './transaction.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { VoucherModule } from './vouchers/voucher.module';

@Module({
  imports: [PrismaModule, LedgerModule, forwardRef(() => VoucherModule)],
  controllers: [FinanceController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class FinanceModule {}
