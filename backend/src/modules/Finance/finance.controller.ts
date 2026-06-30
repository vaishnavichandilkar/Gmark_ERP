import { Controller, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionType, BalanceType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(
    private transactionService: TransactionService,
    private prisma: PrismaService
  ) {}

  @Post('payment')
  @ApiOperation({ summary: 'Create a payment transaction' })
  async createPayment(@Body() data: any, @Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    
    return this.prisma.$transaction(async (tx) => {
      // Verify account and bank/cash belong to user
      const account = await tx.accountMaster.findFirst({
        where: { id: data.accountId, userId }
      });
      if (!account) {
        throw new BadRequestException('Account not found or unauthorized');
      }
      if (data.bankCashAccountId) {
        const bankCash = await tx.accountMaster.findFirst({
          where: { id: data.bankCashAccountId, userId }
        });
        if (!bankCash) {
          throw new BadRequestException('Bank/Cash account not found or unauthorized');
        }
      }

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
  @ApiOperation({ summary: 'Create a receipt transaction' })
  async createReceipt(@Body() data: any, @Request() req: any) {
    const userId = req.user?.userId || req.user?.id;

    return this.prisma.$transaction(async (tx) => {
      // Verify account and bank/cash belong to user
      const account = await tx.accountMaster.findFirst({
        where: { id: data.accountId, userId }
      });
      if (!account) {
        throw new BadRequestException('Account not found or unauthorized');
      }
      if (data.bankCashAccountId) {
        const bankCash = await tx.accountMaster.findFirst({
          where: { id: data.bankCashAccountId, userId }
        });
        if (!bankCash) {
          throw new BadRequestException('Bank/Cash account not found or unauthorized');
        }
      }

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

