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
            transactionType: { in: [TransactionType.Purchase, TransactionType.Payment, TransactionType.Journal] },
          },
        },
      },
    });

    const results = await Promise.all(
      accounts.map(async (account) => {
        const validTransactions = await this.filterTransactions(account.transactions, true, false);
        const openingBalance = account.supplierBalanceType === BalanceType.Dr ? -Number(account.supplierOpeningBalance || 0) : Number(account.supplierOpeningBalance || 0);
        const debit = validTransactions
          .filter((t) => t.entryType === BalanceType.Dr)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const credit = validTransactions
          .filter((t) => t.entryType === BalanceType.Cr)
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
      })
    );

    return results.filter(acc => acc.debit !== 0 || acc.credit !== 0 || acc.openingBalance !== 0);
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
            transactionType: { in: [TransactionType.Sales, TransactionType.Receipt, TransactionType.Journal] },
          },
        },
      },
    });

    const results = await Promise.all(
      accounts.map(async (account) => {
        const validTransactions = await this.filterTransactions(account.transactions, false, false);
        const openingBalance = account.customerBalanceType === BalanceType.Cr ? -Number(account.customerOpeningBalance || 0) : Number(account.customerOpeningBalance || 0);
        const debit = validTransactions
          .filter((t) => t.entryType === BalanceType.Dr)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const credit = validTransactions
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
      })
    );

    return results.filter(acc => acc.debit !== 0 || acc.credit !== 0 || acc.openingBalance !== 0);
  }

  async getGroupLedgersSummary(query: LedgerQueryDto, userId: number) {
    // 1. Fetch group hierarchy across all levels to resolve parent-child relationships
    const [l1Groups, l2SubGroups, l3SubSubGroups, l4SubSubSubGroups, l5SubSubSubSubGroups] = await Promise.all([
      this.prisma.group.findMany({ select: { id: true, group_name: true, parent_id: true } }),
      this.prisma.subGroup.findMany({ select: { id: true, subgroup_name: true, group_id: true } }),
      this.prisma.subSubGroup.findMany({ select: { id: true, name: true, sub_group_id: true } }),
      this.prisma.subSubSubGroup.findMany({ select: { id: true, name: true, sub_sub_group_id: true } }),
      this.prisma.subSubSubSubGroup.findMany({ select: { id: true, name: true, sub_sub_sub_group_id: true } }),
    ]);

    const groupParentMap = new Map<string, string>();
    const l1Map = new Map<number, any>(l1Groups.map(g => [g.id, g]));
    for (const g of l1Groups) {
      if (g.parent_id && l1Map.has(g.parent_id)) {
        groupParentMap.set(g.group_name.trim().toLowerCase(), l1Map.get(g.parent_id).group_name);
      }
    }
    for (const sg of l2SubGroups) {
      if (l1Map.has(sg.group_id)) {
        groupParentMap.set(sg.subgroup_name.trim().toLowerCase(), l1Map.get(sg.group_id).group_name);
      }
    }
    const l2Map = new Map<number, any>(l2SubGroups.map(sg => [sg.id, sg]));
    for (const ssg of l3SubSubGroups) {
      if (l2Map.has(ssg.sub_group_id)) {
        groupParentMap.set(ssg.name.trim().toLowerCase(), l2Map.get(ssg.sub_group_id).subgroup_name);
      }
    }
    const l3Map = new Map<number, any>(l3SubSubGroups.map(ssg => [ssg.id, ssg]));
    for (const sssg of l4SubSubSubGroups) {
      if (l3Map.has(sssg.sub_sub_group_id)) {
        groupParentMap.set(sssg.name.trim().toLowerCase(), l3Map.get(sssg.sub_sub_group_id).name);
      }
    }
    const l4Map = new Map<number, any>(l4SubSubSubGroups.map(sssg => [sssg.id, sssg]));
    for (const ssssg of l5SubSubSubSubGroups) {
      if (l4Map.has(ssssg.sub_sub_sub_group_id)) {
        groupParentMap.set(ssssg.name.trim().toLowerCase(), l4Map.get(ssssg.sub_sub_sub_group_id).name);
      }
    }

    const resolveAncestors = (groupNameStr: string): string[] => {
      const ancestors: string[] = [groupNameStr];
      let curr = groupNameStr.trim().toLowerCase();
      const visited = new Set<string>([curr]);
      while (groupParentMap.has(curr)) {
        const parentName = groupParentMap.get(curr)!;
        const parentLower = parentName.trim().toLowerCase();
        if (visited.has(parentLower)) break;
        visited.add(parentLower);
        ancestors.unshift(parentName);
        curr = parentLower;
      }
      return ancestors;
    };

    const shadowGroupNames = new Set([
      'direct expense', 'indirect expense', 'purchase', 'opening stock', 
      'direct sale', 'indirect sale', 'sale', 'closing stock', 
      'liabilities', 'assets', 'non-current liabilities', 'current liabilities', 
      'non-current assets', 'current assets', 'long term borrowings', 
      'other long term liabilities', 'long term provisions', 'short term borrowings', 
      'suppliers', 'other current liabilities', 'short term provisions', 
      'fixed assets', 'long term loans & advances', 'current investment', 
      'inventories', 'customers', 'short term loans and advances', 'other current assets'
    ]);

    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
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

    const realAccounts = accounts.filter(acc => {
      const nameLower = acc.accountName.trim().toLowerCase();
      const isShadow = acc.groupName.some(g => g.trim().toLowerCase() === nameLower) || (acc.accountType === null && shadowGroupNames.has(nameLower));
      return !isShadow;
    });

    const mapped = realAccounts.map((account) => {
      const opBal = Number(account.supplierOpeningBalance || account.customerOpeningBalance || 0);
      const opType = account.supplierBalanceType || account.customerBalanceType || 'Dr';
      const openingBalance = opType === 'Cr' ? opBal : -opBal;

      const debit = account.transactions
        .filter((t) => t.entryType === BalanceType.Dr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const credit = account.transactions
        .filter((t) => t.entryType === BalanceType.Cr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const closingBalance = openingBalance + credit - debit;

      const rawGroupList = Array.isArray(account.groupName) ? account.groupName : [account.groupName || 'General'];
      let groupList: string[] = [];
      for (const g of rawGroupList) {
        if (!g) continue;
        const anc = resolveAncestors(g);
        for (const a of anc) {
          if (!groupList.includes(a)) {
            groupList.push(a);
          }
        }
      }
      if (groupList.length === 0) groupList = ['General'];

      const accType = String(account.accountType || '').toUpperCase();
      const gStr = groupList.map(g => String(g).toUpperCase()).join(' ');
      if (accType.includes('BANK') || accType.includes('CASH') || gStr.includes('BANK') || gStr.includes('CASH')) {
        if (!groupList.includes('Bank & Cash')) groupList.push('Bank & Cash');
        if (!groupList.includes('Current Assets')) groupList.unshift('Current Assets');
        if (!groupList.includes('Assets')) groupList.unshift('Assets');
      } else if (accType.includes('DEBTOR') || accType.includes('CUSTOMER') || gStr.includes('DEBTOR') || gStr.includes('CUSTOMER')) {
        if (!groupList.includes('Customers')) groupList.push('Customers');
        if (!groupList.includes('Current Assets')) groupList.unshift('Current Assets');
        if (!groupList.includes('Assets')) groupList.unshift('Assets');
      } else if (accType.includes('CREDITOR') || accType.includes('SUPPLIER') || gStr.includes('CREDITOR') || gStr.includes('SUPPLIER')) {
        if (!groupList.includes('Suppliers')) groupList.push('Suppliers');
        if (!groupList.includes('Current Liabilities')) groupList.unshift('Current Liabilities');
        if (!groupList.includes('Liabilities')) groupList.unshift('Liabilities');
      }

      const groupNameStr = groupList.length > 0 ? groupList[groupList.length - 1] : 'General';
      const primaryGroup = groupList[0];

      return {
        id: account.id,
        accountName: account.accountName,
        groupName: groupNameStr,
        primaryGroup,
        allGroups: groupList,
        accountType: account.accountType,
        openingBalance,
        debit,
        credit,
        closingBalance,
      };
    });

    const masterSequence = [
      'Direct Expense', 'Indirect Expense', 'Purchase', 'Opening Stock', 
      'Direct Sale', 'Indirect Sale', 'Sale', 'Closing Stock', 
      'Liabilities', 'Assets', 'SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'Bank & Cash'
    ];

    mapped.sort((a, b) => {
      const idxA = masterSequence.indexOf(a.primaryGroup);
      const idxB = masterSequence.indexOf(b.primaryGroup);
      if (idxA !== -1 && idxB !== -1) {
        if (idxA !== idxB) return idxA - idxB;
      } else if (idxA !== -1) {
        return -1;
      } else if (idxB !== -1) {
        return 1;
      }
      return a.accountName.localeCompare(b.accountName);
    });

    let result = mapped.filter(acc => acc.groupName !== 'General');
    if (query.search) {
      const s = query.search.trim().toLowerCase();
      result = result.filter(acc => 
        acc.accountName.toLowerCase().includes(s) || 
        acc.allGroups.some(g => String(g).toLowerCase().includes(s))
      );
    }

    if (query.group && query.group.trim().toUpperCase() !== 'ALL' && query.group.trim().toLowerCase() !== 'all groups') {
      const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNorm = normalize(query.group);
      
      const targetAliases = new Set<string>([targetNorm]);
      if (targetNorm === 'indirectexpense' || targetNorm === 'indirectexpenses') {
        targetAliases.add('indirectexpense');
        targetAliases.add('indirectexpenses');
      } else if (targetNorm === 'directexpense' || targetNorm === 'directexpenses') {
        targetAliases.add('directexpense');
        targetAliases.add('directexpenses');
      } else if (targetNorm === 'purchase' || targetNorm === 'purchases' || targetNorm === 'purchaseaccounts') {
        targetAliases.add('purchase');
        targetAliases.add('purchases');
        targetAliases.add('purchaseaccounts');
      } else if (targetNorm === 'sale' || targetNorm === 'sales' || targetNorm === 'salesaccounts' || targetNorm === 'directsale' || targetNorm === 'indirectsale') {
        targetAliases.add('sale');
        targetAliases.add('sales');
        targetAliases.add('salesaccounts');
      } else if (targetNorm.includes('debtor') || targetNorm.includes('customer')) {
        targetAliases.add('customers');
        targetAliases.add('sundrydebtors');
        targetAliases.add('debtors');
      } else if (targetNorm.includes('creditor') || targetNorm.includes('supplier')) {
        targetAliases.add('suppliers');
        targetAliases.add('sundrycreditors');
        targetAliases.add('creditors');
      }

      result = result.filter(acc => {
        return acc.allGroups.some(g => {
          const gNorm = normalize(String(g));
          if (targetAliases.has(gNorm)) return true;
          if (gNorm + 's' === targetNorm || targetNorm + 's' === gNorm) return true;
          return false;
        });
      });
    }

    return result;

    return result;
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
        accountName: query.search 
          ? { notIn: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'], contains: query.search, mode: 'insensitive' } 
          : { notIn: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] },
        OR: [
          { groupName: { hasSome: groupNames } },
          { accountType: targetType },
        ],
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
      const balType = account.supplierBalanceType || account.customerBalanceType || BalanceType.Dr;
      const rawOpening = Number(account.supplierOpeningBalance || account.customerOpeningBalance || 0);
      const openingBalance = balType === BalanceType.Cr ? -rawOpening : rawOpening;
      
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

    let isCreditorLedger = false;
    if (type && (type === 'Sundry Creditors' || type === 'Sundry Debtors')) {
      isCreditorLedger = type === 'Sundry Creditors';
    } else {
      if (account.accountType) {
        const atUpper = account.accountType.toUpperCase();
        if (atUpper === 'CREDITOR' || atUpper === 'SUPPLIER') {
          isCreditorLedger = true;
        } else if (atUpper === 'DEBTOR' || atUpper === 'CUSTOMER') {
          isCreditorLedger = false;
        }
      } else if (account.groupName && account.groupName.length > 0) {
        const hasCreditorGroup = account.groupName.some(g => g.toUpperCase().includes('CREDITOR'));
        const hasDebtorGroup = account.groupName.some(g => g.toUpperCase().includes('DEBTOR'));
        if (hasCreditorGroup) {
          isCreditorLedger = true;
        } else if (hasDebtorGroup) {
          isCreditorLedger = false;
        }
      }
    }

    const isBankOrCash = 
      account.accountType === AccountType.Bank || 
      account.accountType === AccountType.Cash || 
      account.accountType === AccountType.BANK || 
      account.accountType === AccountType.CASH || 
      account.accountType?.toUpperCase() === 'BANK' || 
      account.accountType?.toUpperCase() === 'CASH' ||
      (type && (type === 'Bank' || type === 'Cash'));

    const allowedTypes = isBankOrCash
      ? [TransactionType.Payment, TransactionType.Receipt, TransactionType.Journal, TransactionType.Contra]
      : isCreditorLedger
        ? [TransactionType.Purchase, TransactionType.Payment, TransactionType.Journal]
        : [TransactionType.Sales, TransactionType.Receipt, TransactionType.Journal];

    let baseOpeningBalance = 0;
    if (isBankOrCash) {
      let bal = Number(account.supplierOpeningBalance || account.customerOpeningBalance || 0);
      let balType = account.supplierBalanceType || account.customerBalanceType || BalanceType.Dr;

      if (bal === 0) {
        // Fallback to SubSubSubGroup under Bank & Cash parent group
        const bankCashGroup = await this.prisma.subSubGroup.findFirst({
          where: { name: { equals: 'Bank & Cash', mode: 'insensitive' } }
        });
        if (bankCashGroup) {
          const groupInfo = await this.prisma.subSubSubGroup.findFirst({
            where: {
              sub_sub_group_id: bankCashGroup.id,
              userId,
              name: { equals: account.accountName, mode: 'insensitive' }
            }
          });
          if (groupInfo) {
            bal = Number(groupInfo.opening_balance || 0);
            balType = groupInfo.balance_type || BalanceType.Dr;
          }
        }
      }

      baseOpeningBalance = balType === BalanceType.Cr ? -bal : bal;
    } else {
      let bal = isCreditorLedger
        ? Number(account.supplierOpeningBalance ?? account.customerOpeningBalance ?? 0)
        : Number(account.customerOpeningBalance ?? account.supplierOpeningBalance ?? 0);
      let balType = isCreditorLedger
        ? (account.supplierBalanceType || account.customerBalanceType || BalanceType.Cr)
        : (account.customerBalanceType || account.supplierBalanceType || BalanceType.Dr);

      if (bal === 0) {
        // Fallback check in SubSubSubGroup / Group Master
        const groupInfo = await this.prisma.subSubSubGroup.findFirst({
          where: {
            userId,
            name: { equals: account.accountName, mode: 'insensitive' }
          }
        });
        if (groupInfo && groupInfo.opening_balance) {
          bal = Number(groupInfo.opening_balance || 0);
          balType = (groupInfo.balance_type as BalanceType) || (isCreditorLedger ? BalanceType.Cr : BalanceType.Dr);
        }
      }

      baseOpeningBalance = isCreditorLedger
        ? (balType === BalanceType.Dr ? -bal : bal)
        : (balType === BalanceType.Cr ? -bal : bal);
    }



    let effectiveOpeningBalance = baseOpeningBalance;

    if (startDate) {
      // Calculate balance before startDate
      let transactionsBefore = await this.prisma.transaction.findMany({
        where: {
          accountId,
          userId,
          bookingDate: { lt: new Date(startDate) },
          transactionType: { in: allowedTypes },
          amount: { gt: 0 },
        },
      });

      transactionsBefore = await this.filterTransactions(transactionsBefore, isCreditorLedger, isBankOrCash);

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
    let transactionsInRange = await this.prisma.transaction.findMany({
      where: {
        accountId,
        userId,
        bookingDate: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
        transactionType: { in: allowedTypes },
        amount: { gt: 0 },
      },
      orderBy: { bookingDate: 'asc' },
    });

    transactionsInRange = await this.filterTransactions(transactionsInRange, isCreditorLedger, isBankOrCash);

    const totalTransactionsInRange = transactionsInRange.length;
    const paginatedTransactions = transactionsInRange.slice(skip, skip + limit);

    // Fetch all voucher settlements for this ledger to calculate unallocated amounts for invoices
    const allSettlements = await this.prisma.voucherSettlement.findMany({
      where: { ledger_id: accountId }
    });
    const settlementSums = new Map();
    for (const s of allSettlements) {
      if (s.invoice_id) {
        const current = settlementSums.get(s.invoice_id) || 0;
        settlementSums.set(s.invoice_id, current + Number(s.settled_amount));
      }
    }

    // Need to fetch invoices for the paginated transactions to get their IDs
    const invoiceNumbers = paginatedTransactions.map(t => t.invoiceNumber).filter(Boolean);
    const [salesInvs, purchInvs] = await Promise.all([
      this.prisma.salesInvoice.findMany({ 
        where: { 
          customerId: accountId,
          OR: [
            { invoiceNumber: { in: invoiceNumbers } },
            { customerInvoiceNumber: { in: invoiceNumbers } }
          ]
        }, 
        select: { id: true, invoiceNumber: true, customerInvoiceNumber: true } 
      }),
      this.prisma.purchaseInvoice.findMany({ 
        where: { 
          supplierId: accountId,
          OR: [
            { invoiceNumber: { in: invoiceNumbers } },
            { supplierInvoiceNumber: { in: invoiceNumbers } }
          ]
        }, 
        select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } 
      })
    ]);
    const invoiceIdMap = new Map();
    salesInvs.forEach(inv => {
      invoiceIdMap.set(inv.invoiceNumber, inv.id);
      if (inv.customerInvoiceNumber) {
        invoiceIdMap.set(inv.customerInvoiceNumber, inv.id);
      }
    });
    purchInvs.forEach(inv => {
      invoiceIdMap.set(inv.invoiceNumber, inv.id);
      if (inv.supplierInvoiceNumber) {
        invoiceIdMap.set(inv.supplierInvoiceNumber, inv.id);
      }
    });

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

    const paymentInvoices = paginatedTransactions
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('PV-') || (!t.invoiceNumber.startsWith('RV-') && !t.invoiceNumber.startsWith('JV-') && !t.invoiceNumber.startsWith('CV-') && t.transactionType === TransactionType.Payment)))
      .map(t => t.invoiceNumber as string);
    const receiptInvoices = paginatedTransactions
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('RV-') || (!t.invoiceNumber.startsWith('PV-') && !t.invoiceNumber.startsWith('JV-') && !t.invoiceNumber.startsWith('CV-') && t.transactionType === TransactionType.Receipt)))
      .map(t => t.invoiceNumber as string);
    const journalInvoices = paginatedTransactions
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('JV-') || (!t.invoiceNumber.startsWith('PV-') && !t.invoiceNumber.startsWith('RV-') && !t.invoiceNumber.startsWith('CV-') && t.transactionType === TransactionType.Journal)))
      .map(t => t.invoiceNumber as string);
    const contraInvoices = paginatedTransactions
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('CV-') || (!t.invoiceNumber.startsWith('PV-') && !t.invoiceNumber.startsWith('RV-') && !t.invoiceNumber.startsWith('JV-') && t.transactionType === TransactionType.Contra)))
      .map(t => t.invoiceNumber as string);
    
    const [payments, receipts, journals, contras] = await Promise.all([
      paymentInvoices.length > 0 ? this.prisma.paymentVoucher.findMany({ where: { voucherNumber: { in: paymentInvoices } } }) : Promise.resolve([]),
      receiptInvoices.length > 0 ? this.prisma.receiptVoucher.findMany({ where: { voucherNumber: { in: receiptInvoices } } }) : Promise.resolve([]),
      journalInvoices.length > 0 ? this.prisma.journalVoucher.findMany({ where: { voucherNumber: { in: journalInvoices } } }) : Promise.resolve([]),
      contraInvoices.length > 0 ? this.prisma.contraVoucher.findMany({ where: { voucherNumber: { in: contraInvoices } } }) : Promise.resolve([])
    ]);
    
    const paymentNarrationMap = new Map(payments.map(p => [p.voucherNumber, p.narration]));
    const receiptNarrationMap = new Map(receipts.map(r => [r.voucherNumber, r.narration]));
    const journalNarrationMap = new Map(journals.map(j => [j.voucherNumber, j.narration]));
    const contraNarrationMap = new Map(contras.map(c => [c.voucherNumber, c.narration]));
    const voucherIdMap = new Map();
    payments.forEach(p => voucherIdMap.set(p.voucherNumber, { id: p.id, type: 'PAYMENT' }));
    receipts.forEach(r => voucherIdMap.set(r.voucherNumber, { id: r.id, type: 'RECEIPT' }));
    journals.forEach(j => voucherIdMap.set(j.voucherNumber, { id: j.id, type: 'JOURNAL' }));
    contras.forEach(c => voucherIdMap.set(c.voucherNumber, { id: c.id, type: 'CONTRA' }));

    // Fetch details for allocations
    const neededVoucherIds = new Set<number>();
    const neededInvoiceIds = new Set<number>();
    for (const s of allSettlements) {
      if (s.invoice_id && Array.from(invoiceIdMap.values()).includes(s.invoice_id)) {
        neededVoucherIds.add(s.voucher_id);
      }
      if (s.voucher_id && Array.from(voucherIdMap.values()).map(v => v.id).includes(s.voucher_id) && s.invoice_id) {
        neededInvoiceIds.add(s.invoice_id);
      }
    }

    const [additionalPayments, additionalReceipts, additionalJournals, additionalSales, additionalPurchases] = await Promise.all([
      neededVoucherIds.size > 0 ? this.prisma.paymentVoucher.findMany({ where: { id: { in: Array.from(neededVoucherIds) } }, select: { id: true, voucherNumber: true, voucherDate: true, narration: true, updatedAt: true } }) : Promise.resolve([]),
      neededVoucherIds.size > 0 ? this.prisma.receiptVoucher.findMany({ where: { id: { in: Array.from(neededVoucherIds) } }, select: { id: true, voucherNumber: true, voucherDate: true, narration: true, updatedAt: true } }) : Promise.resolve([]),
      neededVoucherIds.size > 0 ? this.prisma.journalVoucher.findMany({ where: { id: { in: Array.from(neededVoucherIds) } }, select: { id: true, voucherNumber: true, voucherDate: true, narration: true, updatedAt: true } }) : Promise.resolve([]),
      neededInvoiceIds.size > 0 ? this.prisma.salesInvoice.findMany({ where: { id: { in: Array.from(neededInvoiceIds) } }, select: { id: true, invoiceNumber: true, invoiceDate: true, updatedAt: true } }) : Promise.resolve([]),
      neededInvoiceIds.size > 0 ? this.prisma.purchaseInvoice.findMany({ where: { id: { in: Array.from(neededInvoiceIds) } }, select: { id: true, invoiceNumber: true, invoiceDate: true, updatedAt: true } }) : Promise.resolve([])
    ]);

    const settlementRefMap = new Map();
    additionalPayments.forEach(p => settlementRefMap.set(`PAYMENT_${p.id}`, { no: p.voucherNumber, date: p.voucherDate, narration: p.narration, type: 'Payment', updatedAt: p.updatedAt }));
    additionalReceipts.forEach(r => settlementRefMap.set(`RECEIPT_${r.id}`, { no: r.voucherNumber, date: r.voucherDate, narration: r.narration, type: 'Bank Receipt', updatedAt: r.updatedAt }));
    additionalJournals.forEach(j => settlementRefMap.set(`JOURNAL_${j.id}`, { no: j.voucherNumber, date: j.voucherDate, narration: j.narration, type: 'Journal Entry', updatedAt: j.updatedAt }));
    additionalSales.forEach(s => settlementRefMap.set(`SALES_INVOICE_${s.id}`, { no: s.invoiceNumber, date: s.invoiceDate, narration: '-', type: 'Sales Invoice', updatedAt: s.updatedAt }));
    additionalPurchases.forEach(p => settlementRefMap.set(`PURCHASE_INVOICE_${p.id}`, { no: p.invoiceNumber, date: p.invoiceDate, narration: '-', type: 'Purchase Invoice', updatedAt: p.updatedAt }));

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

      let displayNarration = transaction.invoiceNumber || '-';
      if (transaction.invoiceNumber) {
        if (transaction.invoiceNumber.startsWith('PV-')) {
          const n = paymentNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.invoiceNumber.startsWith('RV-')) {
          const n = receiptNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.invoiceNumber.startsWith('JV-')) {
          const n = journalNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.invoiceNumber.startsWith('CV-')) {
          const n = contraNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.transactionType === TransactionType.Payment) {
          const n = paymentNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.transactionType === TransactionType.Receipt) {
          const n = receiptNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.transactionType === TransactionType.Journal) {
          const n = journalNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.transactionType === TransactionType.Contra) {
          const n = contraNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        }
      }

      let unallocated = null;
      let allocations = [];
      if (transaction.invoiceNumber) {
        if (transaction.transactionType === TransactionType.Sales || transaction.transactionType === TransactionType.Purchase) {
          const invId = invoiceIdMap.get(transaction.invoiceNumber);
          if (invId) {
             unallocated = Number(transaction.amount);
             
             // Map allocations for this invoice (SETTLED_ADVANCE, SETTLED_ON_ACCOUNT, and AGAINST_REFERENCE are visible)
             const targetVoucherType = transaction.transactionType === TransactionType.Sales ? 'RECEIPT' : 'PAYMENT';
             const invSettlements = allSettlements.filter(s => 
               s.invoice_id === invId && 
               s.voucher_type === targetVoucherType &&
               (s.settlement_type === 'SETTLED_ADVANCE' || s.settlement_type === 'SETTLED_ON_ACCOUNT' || s.settlement_type === 'AGAINST_REFERENCE')
             );
             allocations = invSettlements.map(s => {
                 const ref = settlementRefMap.get(`${s.voucher_type}_${s.voucher_id}`);
                 const isManual = ref?.updatedAt ? new Date(s.created_at).getTime() > new Date(ref.updatedAt).getTime() + 5000 : true;
                 return {
                     id: s.id,
                     date: ref?.date || transaction.bookingDate,
                     voucherNo: ref?.no || '-',
                     type: s.settlement_type === 'SETTLED_ADVANCE' ? 'Settled Advance' : (s.settlement_type === 'AGAINST_REFERENCE' ? 'Against Reference' : 'Settled On Account'),
                     settlementType: s.settlement_type,
                     narration: ref?.narration || '-',
                     amount: Number(s.settled_amount),
                     isManual
                 };
              });
          } else {
             unallocated = Number(transaction.amount);
          }
        } else if (transaction.transactionType === TransactionType.Payment || transaction.transactionType === TransactionType.Receipt) {
          const vData = voucherIdMap.get(transaction.invoiceNumber);
          if (vData) {
             const vSettlements = allSettlements.filter(s => s.voucher_id === vData.id && s.voucher_type === vData.type);
             
             unallocated = Number(transaction.amount);
             
             // Map allocations for this voucher (SETTLED_ADVANCE, SETTLED_ON_ACCOUNT, and AGAINST_REFERENCE are visible)
             allocations = vSettlements.filter(s => 
               s.invoice_id !== null && 
               (s.settlement_type === 'SETTLED_ADVANCE' || s.settlement_type === 'SETTLED_ON_ACCOUNT' || s.settlement_type === 'AGAINST_REFERENCE')
             ).map(s => {
                 const refKey = s.voucher_type === 'PAYMENT' ? `PURCHASE_INVOICE_${s.invoice_id}` : `SALES_INVOICE_${s.invoice_id}`;
                 const ref = settlementRefMap.get(refKey);
                 const isManual = ref?.updatedAt ? new Date(s.created_at).getTime() > new Date(ref.updatedAt).getTime() + 5000 : true;
                 return {
                     id: s.id,
                     date: ref?.date || transaction.bookingDate,
                     voucherNo: ref?.no || '-',
                     type: s.settlement_type === 'SETTLED_ADVANCE' ? 'Settled Advance' : (s.settlement_type === 'AGAINST_REFERENCE' ? 'Against Reference' : 'Settled On Account'),
                     settlementType: s.settlement_type,
                     narration: ref?.narration || '-',
                     amount: Number(s.settled_amount),
                     isManual
                 };
             });
          }
        }
      }

      ledgerItems.push({
        id: transaction.id,
        date: transaction.bookingDate,
        particulars: this.mapParticulars(transaction.transactionType, transaction.invoiceNumber || undefined),
        narration: displayNarration,
        voucherNo: transaction.invoiceNumber,
        unallocated: unallocated,
        allocations: allocations,
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
      isCreditorOrDebtor: !isBankOrCash,
      isCreditorLedger,
      items: ledgerItems,
      total: totalTransactionsInRange,
      periodDebit,
      periodCredit,
      page,
      limit,
      totalPages: Math.ceil(totalTransactionsInRange / limit)
    };
  }

  private mapParticulars(type: TransactionType, invoiceNumber?: string): string {
    if (invoiceNumber) {
      if (invoiceNumber.startsWith('RV-')) return 'Receipt';
      if (invoiceNumber.startsWith('PV-')) return 'Payment';
      if (invoiceNumber.startsWith('JV-')) return 'Journal';
      if (invoiceNumber.startsWith('CV-')) return 'Contra';
    }
    switch (type) {
      case TransactionType.Purchase: return 'Purchase';
      case TransactionType.Sales: return 'Sales';
      case TransactionType.Payment: return 'Payment';
      case TransactionType.Receipt: return 'Receipt';
      case TransactionType.Journal: return 'Journal';
      case TransactionType.Contra: return 'Contra';
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
        accountName: { notIn: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] },
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

  async deleteAllocation(id: number, userId: number) {
    const settlement = await this.prisma.voucherSettlement.findUnique({ where: { id } });
    if (!settlement) {
      throw new NotFoundException('Allocation not found');
    }

    // Verify ownership of the allocation via the ledger account
    const ledger = await this.prisma.accountMaster.findFirst({
      where: { id: settlement.ledger_id, userId },
    });
    if (!ledger) {
      throw new NotFoundException('Allocation not found or unauthorized');
    }

    let targetType = 'ON_ACCOUNT';
    if (settlement.settlement_type === 'SETTLED_ADVANCE') {
      targetType = 'ADVANCE';
    } else if (settlement.settlement_type === 'SETTLED_ON_ACCOUNT') {
      targetType = 'ON_ACCOUNT';
    } else if (settlement.settlement_type === 'AGAINST_REFERENCE') {
      targetType = 'CANCELLED_SETTLEMENT';
    }

    // Convert back to original unallocated status
    const updated = await this.prisma.voucherSettlement.update({
      where: { id },
      data: {
        invoice_id: null,
        settlement_type: targetType,
        invoice_balance: null,
        invoice_total: null
      }
    });

    // If it was linked to an invoice, check if the invoice status needs updating
    if (settlement.invoice_id) {
      const invoiceType = settlement.voucher_type === 'PAYMENT' ? 'Purchase' : 'Sales';
      if (invoiceType === 'Purchase') {
        const inv = await this.prisma.purchaseInvoice.findUnique({ where: { id: settlement.invoice_id } });
        if (inv && inv.status === 'COMPLETED') {
          await this.prisma.purchaseInvoice.update({
            where: { id: settlement.invoice_id },
            data: { status: 'GENERATED' }
          });
        }
      } else {
        const inv = await this.prisma.salesInvoice.findUnique({ where: { id: settlement.invoice_id } });
        if (inv && inv.status === 'COMPLETED') {
          await this.prisma.salesInvoice.update({
            where: { id: settlement.invoice_id },
            data: { status: 'GENERATED' }
          });
        }
      }
    }

    return updated;
  }

  private async filterTransactions(transactions: any[], isCreditorLedger: boolean, isBankOrCash: boolean = false) {
    if (isBankOrCash) {
      return transactions;
    }

    const jvNumbers = transactions
      .filter((t) => t.invoiceNumber?.startsWith('JV-'))
      .map((t) => t.invoiceNumber);

    let jvs = [];
    if (jvNumbers.length > 0) {
      jvs = await this.prisma.journalVoucher.findMany({
        where: { voucherNumber: { in: jvNumbers } },
      });
    }

    const jvNarrationMap = new Map(jvs.map((j: any) => [j.voucherNumber, j.narration || '']));

    return transactions.filter((t) => {
      const isPV = t.invoiceNumber?.startsWith('PV-');
      const isRV = t.invoiceNumber?.startsWith('RV-');
      const isJV = t.invoiceNumber?.startsWith('JV-');

      if (isCreditorLedger) {
        // Supplier Ledger (Sundry Creditors):
        // Exclude Receipt Vouchers (customer entries)
        if (isRV) return false;

        // Exclude customer-side Journal Vouchers (child JVs from RV)
        if (isJV) {
          const narration = jvNarrationMap.get(t.invoiceNumber) || '';
          if (narration.includes('[Parent RV ID:')) {
            return false;
          }
        }
      } else {
        // Customer Ledger (Sundry Debtors):
        // Exclude Payment Vouchers (supplier entries)
        if (isPV) return false;

        // Exclude supplier-side Journal Vouchers (child JVs with Parent PV)
        if (isJV) {
          const narration = jvNarrationMap.get(t.invoiceNumber) || '';
          if (narration.includes('[Parent PV ID:')) {
            return false;
          }
        }
      }
      return true;
    });
  }
}
