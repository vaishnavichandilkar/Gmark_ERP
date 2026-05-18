import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/prisma/prisma.module';
import { FinanceModule } from '../finance.module';
import { ReceiptVoucherService } from './receipt-voucher/receipt-voucher.service';
import { ReceiptVoucherController } from './receipt-voucher/receipt-voucher.controller';
import { PaymentVoucherService } from './payment-voucher/payment-voucher.service';
import { PaymentVoucherController } from './payment-voucher/payment-voucher.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => FinanceModule)],
  controllers: [ReceiptVoucherController, PaymentVoucherController],
  providers: [ReceiptVoucherService, PaymentVoucherService],
})
export class VoucherModule {}
