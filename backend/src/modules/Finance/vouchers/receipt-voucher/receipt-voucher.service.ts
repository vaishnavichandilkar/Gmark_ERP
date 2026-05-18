import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateVoucherDto } from '../dto/voucher.dto';
import { TransactionService } from '../../transaction.service';
import { TransactionType, BalanceType, MasterStatus } from '@prisma/client';

@Injectable()
export class ReceiptVoucherService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TransactionService))
    private transactionService: TransactionService,
  ) {}

  async generateVoucherNumber(userId: number): Promise<string> {
    const prefix = 'RV-';
    const count = await this.prisma.receiptVoucher.count({
      where: { createdBy: userId },
    });
    return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
  }

  async create(createDto: CreateVoucherDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Generate Voucher Number
      const voucherNumber = await this.generateVoucherNumber(userId);

      // 2. Validate Bank/Cash Ledger
      const bankCashLedger = await tx.accountMaster.findUnique({
        where: { id: createDto.bankCashLedgerId },
      });

      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash account');
      }

      const totalAmount = createDto.items.reduce((sum, item) => sum + item.amount, 0);

      // 3. Create Voucher
      const voucher = await tx.receiptVoucher.create({
        data: {
          voucherNumber,
          voucherDate: new Date(createDto.voucherDate),
          bankCashLedgerId: createDto.bankCashLedgerId,
          paymentMode: createDto.paymentMode,
          narration: createDto.narration,
          totalAmount,
          createdBy: userId,
          items: {
            create: createDto.items.map((item) => ({
              accountId: item.accountId,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 4. Record Accounting Transactions
      // Debit Bank/Cash Account
      await this.transactionService.recordTransaction({
        accountId: createDto.bankCashLedgerId,
        userId,
        bookingDate: new Date(createDto.voucherDate),
        invoiceNumber: voucherNumber,
        transactionType: TransactionType.Receipt,
        amount: totalAmount,
        entryType: BalanceType.Dr,
      }, tx);

      // Credit Customer Accounts
      for (const item of createDto.items) {
        const account = await tx.accountMaster.findUnique({ where: { id: item.accountId } });
        if (!account || account.status !== MasterStatus.ACTIVE) {
          throw new BadRequestException(`Invalid or inactive account ID: ${item.accountId}`);
        }

        await this.transactionService.recordTransaction({
          accountId: item.accountId,
          userId,
          bookingDate: new Date(createDto.voucherDate),
          invoiceNumber: voucherNumber,
          transactionType: TransactionType.Receipt,
          amount: item.amount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      return voucher;
    });
  }

  async findAll(userId: number) {
    return this.prisma.receiptVoucher.findMany({
      where: { createdBy: userId },
      include: {
        items: {
          include: { account: { select: { accountName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const voucher = await this.prisma.receiptVoucher.findFirst({
      where: { id, createdBy: userId },
      include: {
        items: {
          include: { account: { select: { accountName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
    });

    if (!voucher) throw new NotFoundException('Receipt Voucher not found');
    return voucher;
  }

  async update(id: number, updateDto: CreateVoucherDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findOne(id, userId);

      // Delete old transactions
      await this.transactionService.deleteTransaction({
        userId,
        accountId: existing.bankCashLedgerId,
        invoiceNumber: existing.voucherNumber,
        transactionType: TransactionType.Receipt,
      }, tx);

      for (const item of existing.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Receipt,
        }, tx);
      }

      const totalAmount = updateDto.items.reduce((sum, item) => sum + item.amount, 0);

      // Update Voucher
      const updated = await tx.receiptVoucher.update({
        where: { id },
        data: {
          voucherDate: new Date(updateDto.voucherDate),
          bankCashLedgerId: updateDto.bankCashLedgerId,
          paymentMode: updateDto.paymentMode,
          narration: updateDto.narration,
          totalAmount,
          items: {
            deleteMany: {},
            create: updateDto.items.map((item) => ({
              accountId: item.accountId,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // Record new transactions
      await this.transactionService.recordTransaction({
        accountId: updateDto.bankCashLedgerId,
        userId,
        bookingDate: new Date(updateDto.voucherDate),
        invoiceNumber: existing.voucherNumber,
        transactionType: TransactionType.Receipt,
        amount: totalAmount,
        entryType: BalanceType.Dr,
      }, tx);

      for (const item of updateDto.items) {
        await this.transactionService.recordTransaction({
          accountId: item.accountId,
          userId,
          bookingDate: new Date(updateDto.voucherDate),
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Receipt,
          amount: item.amount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      return updated;
    });
  }

  async remove(id: number, userId: number) {
    const voucher = await this.findOne(id, userId);

    return this.prisma.$transaction(async (tx) => {
      // Delete transactions
      await this.transactionService.deleteTransaction({
        userId,
        accountId: voucher.bankCashLedgerId,
        invoiceNumber: voucher.voucherNumber,
        transactionType: TransactionType.Receipt,
      }, tx);

      for (const item of voucher.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: voucher.voucherNumber,
          transactionType: TransactionType.Receipt,
        }, tx);
      }

      return tx.receiptVoucher.delete({ where: { id } });
    });
  }
}
