import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LedgerQueryDto } from './dto/ledger.dto';
import { AccountType, TransactionType, BalanceType, MasterStatus } from '@prisma/client';
import { syncBankCashAccounts } from '../../utils/sync-bank-cash';

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async getCreditorsSummary(query: LedgerQueryDto, userId: number) {
    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        OR: [
          { accountType: AccountType.Creditor },
          { groupName: { has: 'SUNDRY_CREDITORS' } },
          { supplierCode: { not: null } }
        ],
        accountName: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
      },
      include: {
        transactions: {
          where: {
            bookingDate: {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            },
          },
        },
      },
    });

    return accounts.map((account) => {
      const openingBalance = account.supplierBalanceType === BalanceType.Dr ? -Number(account.supplierOpeningBalance || 0) : Number(account.supplierOpeningBalance || 0);
      const debit = account.transactions
        .filter((t) => t.transactionType === TransactionType.Payment)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const credit = account.transactions
        .filter((t) => t.transactionType === TransactionType.Purchase)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const closingBalance = openingBalance + credit - debit;

      return {
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        openingBalance,
        debit,
        credit,
        closingBalance,
      };
    }).filter(acc => acc.debit !== 0 || acc.credit !== 0);
  }

  async getDebtorsSummary(query: LedgerQueryDto, userId: number) {
    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        OR: [
          { accountType: AccountType.Debtor },
          { groupName: { has: 'SUNDRY_DEBTORS' } },
          { customerCode: { not: null } }
        ],
        accountName: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
      },
      include: {
        transactions: {
          where: {
            bookingDate: {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            },
          },
        },
      },
    });

    return accounts.map((account) => {
      const openingBalance = account.customerBalanceType === BalanceType.Cr ? -Number(account.customerOpeningBalance || 0) : Number(account.customerOpeningBalance || 0);
      const debit = account.transactions
        .filter((t) => t.transactionType === TransactionType.Sales)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const credit = account.transactions
        .filter((t) => t.transactionType === TransactionType.Receipt)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const closingBalance = openingBalance + debit - credit;

      return {
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        openingBalance,
        debit,
        credit,
        closingBalance,
      };
    }).filter(acc => acc.debit !== 0 || acc.credit !== 0);
  }

  async getBankCashSummary(query: LedgerQueryDto, userId: number) {
    // Sync groups under "Bank & Cash" parent group with ledger accounts
    await syncBankCashAccounts(this.prisma, userId);

    const searchKeyword = query.group || 'Bank';
    const isBankSearch = searchKeyword.toUpperCase().includes('BANK');
    const targetType = isBankSearch ? AccountType.Bank : AccountType.Cash;

    // Search for groups across all levels that match the keyword
    const [l1, l2, l3, l4] = await Promise.all([
      this.prisma.group.findMany({ where: { group_name: { contains: searchKeyword, mode: 'insensitive' } } }),
      this.prisma.subGroup.findMany({ where: { subgroup_name: { contains: searchKeyword, mode: 'insensitive' } } }),
      this.prisma.subSubGroup.findMany({ where: { name: { contains: searchKeyword, mode: 'insensitive' } } }),
      this.prisma.subSubSubGroup.findMany({ where: { name: { contains: searchKeyword, mode: 'insensitive' } } }),
    ]);

    const groupNames = [
      ...l1.map((g) => g.group_name),
      ...l2.map((g) => g.subgroup_name),
      ...l3.map((g) => g.name),
      ...l4.map((g) => g.name),
      searchKeyword.toUpperCase(), // e.g., 'BANK' or 'CASH'
    ];

    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        accountType: targetType,
        OR: [
          { groupName: { hasSome: groupNames } },
          { accountType: targetType },
        ],
        accountName: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
      },
      include: {
        transactions: {
          where: {
            bookingDate: {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            },
          },
        },
      },
    });

    return accounts.map((account) => {
      const openingBalance = Number(account.supplierOpeningBalance || account.customerOpeningBalance || 0);
      const debit = account.transactions
        .filter((t) => t.entryType === BalanceType.Dr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const credit = account.transactions
        .filter((t) => t.entryType === BalanceType.Cr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const closingBalance = openingBalance + debit - credit;

      return {
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        openingBalance,
        debit,
        credit,
        closingBalance,
      };
    });
  }

  async getDetailedLedger(accountId: number, userId: number, startDate?: string, endDate?: string, type?: string, page: number = 1, limit: number = 14) {
    const skip = (page - 1) * limit;
    const account = await this.prisma.accountMaster.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) throw new NotFoundException('Account not found');

    let isCreditorLedger = account.accountType === AccountType.Creditor;
    if (type) {
      isCreditorLedger = type === 'Sundry Creditors';
    } else if (account.groupName.includes('SUNDRY_CREDITORS')) {
      isCreditorLedger = true;
    }

    const baseOpeningBalance = isCreditorLedger
      ? (account.supplierBalanceType === BalanceType.Dr ? -Number(account.supplierOpeningBalance || 0) : Number(account.supplierOpeningBalance || 0))
      : (account.customerBalanceType === BalanceType.Cr ? -Number(account.customerOpeningBalance || 0) : Number(account.customerOpeningBalance || 0));


    let effectiveOpeningBalance = baseOpeningBalance;

    if (startDate) {
      // Calculate balance before startDate
      const transactionsBefore = await this.prisma.transaction.findMany({
        where: {
          accountId,
          userId,
          bookingDate: { lt: new Date(startDate) },
          transactionType: { in: isCreditorLedger ? [TransactionType.Purchase, TransactionType.Payment] : [TransactionType.Sales, TransactionType.Receipt] },
        },
      });

      for (const t of transactionsBefore) {
        const amount = Number(t.amount);
        
        if (isCreditorLedger) {
          // Creditors: Credit increases (+), Debit decreases (-)
          effectiveOpeningBalance += (t.entryType === BalanceType.Cr ? amount : -amount);
        } else {
          // Debtors/Bank/Cash: Debit increases (+), Credit decreases (-)
          effectiveOpeningBalance += (t.entryType === BalanceType.Dr ? amount : -amount);
        }
      }
    }

    // Get transactions in range
    const transactionsInRange = await this.prisma.transaction.findMany({
      where: {
        accountId,
        userId,
        bookingDate: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
        transactionType: { in: isCreditorLedger ? [TransactionType.Purchase, TransactionType.Payment] : [TransactionType.Sales, TransactionType.Receipt] },
      },
      orderBy: { bookingDate: 'asc' },
    });

    const totalTransactionsInRange = transactionsInRange.length;
    const paginatedTransactions = transactionsInRange.slice(skip, skip + limit);

    const ledgerItems = [];
    let cumulativeBalance = effectiveOpeningBalance;

    // For paginated views beyond page 1, we need to add the sum of transactions before this page to the opening balance
    if (skip > 0) {
      const previousTransactions = transactionsInRange.slice(0, skip);
      for (const t of previousTransactions) {
        const amount = Number(t.amount);
        if (isCreditorLedger) {
          cumulativeBalance += (t.entryType === BalanceType.Cr ? amount : -amount);
        } else {
          cumulativeBalance += (t.entryType === BalanceType.Dr ? amount : -amount);
        }
      }
    }

    ledgerItems.push({
      date: skip === 0 ? (startDate ? new Date(startDate) : account.createdAt) : paginatedTransactions[0]?.bookingDate,
      particulars: skip === 0 ? 'Opening Balance' : 'PREVIOUS BALANCE C/F (UPDATED)',
      narration: '-',
      debit: isCreditorLedger ? (cumulativeBalance < 0 ? Math.abs(cumulativeBalance) : 0) : (cumulativeBalance > 0 ? cumulativeBalance : 0),
      credit: isCreditorLedger ? (cumulativeBalance > 0 ? cumulativeBalance : 0) : (cumulativeBalance < 0 ? Math.abs(cumulativeBalance) : 0),
      balance: cumulativeBalance,
      isBalanceRow: true,
    });

    let pageCumulativeBalance = 0;
    for (const transaction of paginatedTransactions) {
      const debit = transaction.entryType === BalanceType.Dr ? Number(transaction.amount) : 0;
      const credit = transaction.entryType === BalanceType.Cr ? Number(transaction.amount) : 0;

      if (isCreditorLedger) {
        cumulativeBalance = cumulativeBalance + credit - debit;
        pageCumulativeBalance = pageCumulativeBalance + credit - debit;
      } else {
        cumulativeBalance = cumulativeBalance + debit - credit;
        pageCumulativeBalance = pageCumulativeBalance + debit - credit;
      }

      ledgerItems.push({
        id: transaction.id,
        date: transaction.bookingDate,
        particulars: this.mapParticulars(transaction.transactionType),
        narration: transaction.invoiceNumber || '-',
        debit,
        credit,
        balance: cumulativeBalance,
      });
    }

    const periodDebit = transactionsInRange.reduce((sum, t) => sum + (t.entryType === BalanceType.Dr ? Number(t.amount) : 0), 0);
    const periodCredit = transactionsInRange.reduce((sum, t) => sum + (t.entryType === BalanceType.Cr ? Number(t.amount) : 0), 0);

    return {
      accountName: account.accountName,
      openingBalance: effectiveOpeningBalance,
      items: ledgerItems,
      total: totalTransactionsInRange,
      periodDebit,
      periodCredit,
      page,
      limit,
      totalPages: Math.ceil(totalTransactionsInRange / limit)
    };
  }

  private mapParticulars(type: TransactionType): string {
    switch (type) {
      case TransactionType.Purchase: return 'Purchase';
      case TransactionType.Sales: return 'Sales';
      case TransactionType.Payment: return 'Payment';
      case TransactionType.Receipt: return 'Receipt';
      default: return 'Transaction';
    }
  }

  async getBankCashAccountsForDropdown(userId: number) {
    // Sync groups under "Bank & Cash" parent group with ledger accounts
    await syncBankCashAccounts(this.prisma, userId);

    // Dynamically find all groups containing 'Bank' or 'Cash'
    const searchKeywords = ['bank', 'cash'];
    const groupNames = new Set<string>();
    
    for (const keyword of searchKeywords) {
      const [l1, l2, l3, l4] = await Promise.all([
        this.prisma.group.findMany({ where: { group_name: { contains: keyword, mode: 'insensitive' } } }),
        this.prisma.subGroup.findMany({ where: { subgroup_name: { contains: keyword, mode: 'insensitive' } } }),
        this.prisma.subSubGroup.findMany({ where: { name: { contains: keyword, mode: 'insensitive' } } }),
        this.prisma.subSubSubGroup.findMany({ where: { name: { contains: keyword, mode: 'insensitive' } } }),
      ]);
      l1.forEach(g => groupNames.add(g.group_name));
      l2.forEach(g => groupNames.add(g.subgroup_name));
      l3.forEach(g => groupNames.add(g.name));
      l4.forEach(g => groupNames.add(g.name));
    }

    // Add common static names just in case
    ['BANK', 'CASH', 'Bank', 'Cash', 'Bank & Cash'].forEach(name => groupNames.add(name));

    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        OR: [
          { groupName: { hasSome: Array.from(groupNames) } },
          { accountType: { in: [AccountType.Bank, AccountType.Cash] } },
        ],
      },
      orderBy: { accountName: 'asc' },
      select: {
        id: true,
        accountName: true,
        accountType: true,
        groupName: true,
      },
    });

    return accounts.map(acc => ({
      id: acc.id,
      ledgerName: acc.accountName,
      groupName: acc.groupName.length > 0 ? acc.groupName[acc.groupName.length - 1] : "Bank & Cash",
      accountType: acc.accountType?.toUpperCase() || "BANK"
    }));
  }
}
