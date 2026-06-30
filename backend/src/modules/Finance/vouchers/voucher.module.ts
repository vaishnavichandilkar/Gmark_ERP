import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { FinanceModule } from '../finance.module';
import { ReceiptVoucherService } from './receipt-voucher/receipt-voucher.service';
import { ReceiptVoucherController } from './receipt-voucher/receipt-voucher.controller';
import { PaymentVoucherService } from './payment-voucher/payment-voucher.service';
import { PaymentVoucherController } from './payment-voucher/payment-voucher.controller';
import { JournalVoucherService } from './journal-voucher/journal-voucher.service';
import { JournalVoucherController } from './journal-voucher/journal-voucher.controller';
import { ContraVoucherService } from './contra-voucher/contra-voucher.service';
import { ContraVoucherController } from './contra-voucher/contra-voucher.controller';
import { InvoicesController } from './invoices.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => FinanceModule)],
  controllers: [ReceiptVoucherController, PaymentVoucherController, JournalVoucherController, ContraVoucherController, InvoicesController],
  providers: [ReceiptVoucherService, PaymentVoucherService, JournalVoucherService, ContraVoucherService],
})
export class VoucherModule {}

