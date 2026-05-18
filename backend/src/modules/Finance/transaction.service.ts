import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TransactionType, BalanceType } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async recordTransaction(data: {
    accountId: number;
    userId: number;
    bookingDate: Date;
    invoiceNumber?: string;
    transactionType: TransactionType;
    amount: number;
    entryType: BalanceType;
  }, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.transaction.create({
      data: {
        accountId: data.accountId,
        userId: data.userId,
        bookingDate: data.bookingDate,
        invoiceNumber: data.invoiceNumber,
        transactionType: data.transactionType,
        amount: data.amount,
        entryType: data.entryType,
      },
    });
  }

  async updateTransaction(where: { 
    userId: number; 
    accountId: number; 
    invoiceNumber: string; 
    transactionType: TransactionType 
  }, data: {
    amount?: number;
    bookingDate?: Date;
    invoiceNumber?: string;
  }, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.transaction.updateMany({
      where: {
        userId: where.userId,
        accountId: where.accountId,
        invoiceNumber: where.invoiceNumber,
        transactionType: where.transactionType,
      },
      data,
    });
  }

  async deleteTransaction(where: {
    userId: number;
    accountId: number;
    invoiceNumber: string;
    transactionType: TransactionType;
  }, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.transaction.deleteMany({
      where: {
        userId: where.userId,
        accountId: where.accountId,
        invoiceNumber: where.invoiceNumber,
        transactionType: where.transactionType,
      },
    });
  }
}
