import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionType, BalanceType, AccountType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('finance')
export class FinanceController {
  constructor(
    private transactionService: TransactionService,
    private prisma: PrismaService
  ) {}

  @Post('payment')
  async createPayment(@Body() data: any, @Request() req: any) {
    const userId = req.user?.id || 1;
    
    return this.prisma.$transaction(async (tx) => {
      // Record the payment transaction for the account (Supplier/Bank/Cash)
      const transaction = await this.transactionService.recordTransaction({
        accountId: data.accountId,
        userId: userId,
        bookingDate: new Date(data.bookingDate || new Date()),
        invoiceNumber: data.referenceNumber,
        transactionType: TransactionType.Payment,
        amount: data.amount,
        entryType: BalanceType.Dr,
      }, tx);

      if (data.bankCashAccountId) {
        await this.transactionService.recordTransaction({
          accountId: data.bankCashAccountId,
          userId: userId,
          bookingDate: new Date(data.bookingDate || new Date()),
          invoiceNumber: data.referenceNumber,
          transactionType: TransactionType.Payment,
          amount: data.amount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      return transaction;
    });
  }

  @Post('receipt')
  async createReceipt(@Body() data: any, @Request() req: any) {
    const userId = req.user?.id || 1;

    return this.prisma.$transaction(async (tx) => {
      // Record the receipt transaction for the account (Customer)
      const transaction = await this.transactionService.recordTransaction({
        accountId: data.accountId,
        userId: userId,
        bookingDate: new Date(data.bookingDate || new Date()),
        invoiceNumber: data.referenceNumber,
        transactionType: TransactionType.Receipt,
        amount: data.amount,
        entryType: BalanceType.Cr,
      }, tx);

      if (data.bankCashAccountId) {
        await this.transactionService.recordTransaction({
          accountId: data.bankCashAccountId,
          userId: userId,
          bookingDate: new Date(data.bookingDate || new Date()),
          invoiceNumber: data.referenceNumber,
          transactionType: TransactionType.Receipt,
          amount: data.amount,
          entryType: BalanceType.Dr,
        }, tx);
      }

      return transaction;
    });
  }
}
