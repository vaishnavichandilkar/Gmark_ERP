import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateVoucherDto } from '../dto/voucher.dto';
import { TransactionService } from '../../transaction.service';
import { TransactionType, BalanceType, MasterStatus } from '@prisma/client';

@Injectable()
export class ContraVoucherService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TransactionService))
    private transactionService: TransactionService,
  ) {}

  async generateVoucherNumber(userId: number): Promise<string> {
    const prefix = 'CV-';
    const lastVoucher = await this.prisma.contraVoucher.findFirst({
      orderBy: { id: 'desc' },
      select: { voucherNumber: true },
    });

    let nextNumber = 1;
    if (lastVoucher) {
      const lastNumberStr = lastVoucher.voucherNumber.replace(prefix, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    while (true) {
      const candidate = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      const existing = await this.prisma.contraVoucher.findUnique({
        where: { voucherNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      nextNumber++;
    }
  }

  async create(createDto: CreateVoucherDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Generate Voucher Number
      const voucherNumber = await this.generateVoucherNumber(userId);

      // 2. Validate Bank/Cash Giver Ledger
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: createDto.bankCashLedgerId, userId },
      });

      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash Giver account');
      }

      const totalAmount = createDto.items.reduce((sum, item) => sum + item.amount, 0);

      // 3. Create Voucher
      const voucher = await tx.contraVoucher.create({
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
      // Credit Bank/Cash Giver Account (Giver hands out cash)
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: createDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(createDto.voucherDate),
          invoiceNumber: voucherNumber,
          transactionType: TransactionType.Contra,
          amount: totalAmount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      // Debit Receiver Accounts (Receiver receives cash)
      for (const item of createDto.items) {
        const account = await tx.accountMaster.findFirst({ where: { id: item.accountId, userId } });
        if (!account) {
          throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
        }

        if (item.amount > 0) {
          await this.transactionService.recordTransaction({
            accountId: item.accountId,
            userId,
            bookingDate: new Date(createDto.voucherDate),
            invoiceNumber: voucherNumber,
            transactionType: TransactionType.Contra,
            amount: item.amount,
            entryType: BalanceType.Dr,
          }, tx);
        }
      }

      return voucher;
    });
  }

  async findAll(userId: number) {
    return this.prisma.contraVoucher.findMany({
      where: { 
        createdBy: userId,
        totalAmount: { gt: 0 }
      },
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
    const voucher = await this.prisma.contraVoucher.findFirst({
      where: { id, createdBy: userId },
      include: {
        items: {
          include: { account: { select: { accountName: true, accountType: true, groupName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
    });

    if (!voucher) throw new NotFoundException('Contra Voucher not found');

    const transactions = await this.prisma.transaction.findMany({
      where: { invoiceNumber: voucher.voucherNumber, userId },
    });

    const itemsWithData = voucher.items.map(item => {
      const itemTx = transactions.find(t => t.accountId === item.accountId);
      return {
        ...item,
        accountType: 'BANK',
        settlements: [],
      };
    });

    return {
      ...voucher,
      items: itemsWithData,
    };
  }

  async update(id: number, updateDto: CreateVoucherDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findOne(id, userId);

      // Delete old transactions
      await this.transactionService.deleteTransaction({
        userId,
        accountId: existing.bankCashLedgerId,
        invoiceNumber: existing.voucherNumber,
        transactionType: TransactionType.Contra,
      }, tx);

      for (const item of existing.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Contra,
        }, tx);
      }

      const totalAmount = updateDto.items.reduce((sum, item) => sum + item.amount, 0);

      // Validate Bank/Cash Giver Ledger
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: updateDto.bankCashLedgerId, userId },
      });
      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash Giver account');
      }

      // Update Voucher
      const updated = await tx.contraVoucher.update({
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
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: updateDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(updateDto.voucherDate),
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Contra,
          amount: totalAmount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      for (const item of updateDto.items) {
        const account = await tx.accountMaster.findFirst({ where: { id: item.accountId, userId } });
        if (!account) {
          throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
        }

        if (item.amount > 0) {
          await this.transactionService.recordTransaction({
            accountId: item.accountId,
            userId,
            bookingDate: new Date(updateDto.voucherDate),
            invoiceNumber: existing.voucherNumber,
            transactionType: TransactionType.Contra,
            amount: item.amount,
            entryType: BalanceType.Dr,
          }, tx);
        }
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
        transactionType: TransactionType.Contra,
      }, tx);

      for (const item of voucher.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: voucher.voucherNumber,
          transactionType: TransactionType.Contra,
        }, tx);
      }

      return tx.contraVoucher.delete({ where: { id } });
    });
  }
}
