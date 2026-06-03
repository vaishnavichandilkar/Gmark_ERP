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
            transactionType: { in: [TransactionType.Purchase, TransactionType.Payment] },
          },
        },
      },
    });

    return accounts.map((account) => {
      const openingBalance = account.supplierBalanceType === BalanceType.Dr ? -Number(account.supplierOpeningBalance || 0) : Number(account.supplierOpeningBalance || 0);
      const debit = account.transactions
        .filter((t) => t.entryType === BalanceType.Dr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const credit = account.transactions
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
            transactionType: { in: [TransactionType.Sales, TransactionType.Receipt] },
          },
        },
      },
    });

    return accounts.map((account) => {
      const openingBalance = account.customerBalanceType === BalanceType.Cr ? -Number(account.customerOpeningBalance || 0) : Number(account.customerOpeningBalance || 0);
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

    const isBankOrCash = 
      account.accountType === AccountType.Bank || 
      account.accountType === AccountType.Cash || 
      account.accountType === AccountType.BANK || 
      account.accountType === AccountType.CASH || 
      account.accountType?.toUpperCase() === 'BANK' || 
      account.accountType?.toUpperCase() === 'CASH' ||
      (type && (type === 'Bank' || type === 'Cash'));

    const allowedTypes = isBankOrCash
      ? [TransactionType.Payment, TransactionType.Receipt]
      : isCreditorLedger
        ? [TransactionType.Purchase, TransactionType.Payment]
        : [TransactionType.Sales, TransactionType.Receipt];

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
          transactionType: { in: allowedTypes },
          amount: { gt: 0 },
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
        transactionType: { in: allowedTypes },
        amount: { gt: 0 },
      },
      orderBy: { bookingDate: 'asc' },
    });

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
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('PV-') || (!t.invoiceNumber.startsWith('RV-') && t.transactionType === TransactionType.Payment)))
      .map(t => t.invoiceNumber as string);
    const receiptInvoices = paginatedTransactions
      .filter(t => t.invoiceNumber && (t.invoiceNumber.startsWith('RV-') || (!t.invoiceNumber.startsWith('PV-') && t.transactionType === TransactionType.Receipt)))
      .map(t => t.invoiceNumber as string);
    
    const [payments, receipts] = await Promise.all([
      paymentInvoices.length > 0 ? this.prisma.paymentVoucher.findMany({ where: { voucherNumber: { in: paymentInvoices } } }) : Promise.resolve([]),
      receiptInvoices.length > 0 ? this.prisma.receiptVoucher.findMany({ where: { voucherNumber: { in: receiptInvoices } } }) : Promise.resolve([])
    ]);
    
    const paymentNarrationMap = new Map(payments.map(p => [p.voucherNumber, p.narration]));
    const receiptNarrationMap = new Map(receipts.map(r => [r.voucherNumber, r.narration]));
    const voucherIdMap = new Map();
    payments.forEach(p => voucherIdMap.set(p.voucherNumber, { id: p.id, type: 'PAYMENT' }));
    receipts.forEach(r => voucherIdMap.set(r.voucherNumber, { id: r.id, type: 'RECEIPT' }));

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

    const [additionalPayments, additionalReceipts, additionalSales, additionalPurchases] = await Promise.all([
      neededVoucherIds.size > 0 ? this.prisma.paymentVoucher.findMany({ where: { id: { in: Array.from(neededVoucherIds) } }, select: { id: true, voucherNumber: true, voucherDate: true, narration: true, updatedAt: true } }) : Promise.resolve([]),
      neededVoucherIds.size > 0 ? this.prisma.receiptVoucher.findMany({ where: { id: { in: Array.from(neededVoucherIds) } }, select: { id: true, voucherNumber: true, voucherDate: true, narration: true, updatedAt: true } }) : Promise.resolve([]),
      neededInvoiceIds.size > 0 ? this.prisma.salesInvoice.findMany({ where: { id: { in: Array.from(neededInvoiceIds) } }, select: { id: true, invoiceNumber: true, invoiceDate: true, updatedAt: true } }) : Promise.resolve([]),
      neededInvoiceIds.size > 0 ? this.prisma.purchaseInvoice.findMany({ where: { id: { in: Array.from(neededInvoiceIds) } }, select: { id: true, invoiceNumber: true, invoiceDate: true, updatedAt: true } }) : Promise.resolve([])
    ]);

    const settlementRefMap = new Map();
    additionalPayments.forEach(p => settlementRefMap.set(`PAYMENT_${p.id}`, { no: p.voucherNumber, date: p.voucherDate, narration: p.narration, type: 'Payment', updatedAt: p.updatedAt }));
    additionalReceipts.forEach(r => settlementRefMap.set(`RECEIPT_${r.id}`, { no: r.voucherNumber, date: r.voucherDate, narration: r.narration, type: 'Bank Receipt', updatedAt: r.updatedAt }));
    // Just in case JOURNAL is ever implemented or handled in voucher_type
    additionalSales.forEach(s => settlementRefMap.set(`INVOICE_${s.id}`, { no: s.invoiceNumber, date: s.invoiceDate, narration: '-', type: 'Sales Invoice', updatedAt: s.updatedAt }));
    additionalPurchases.forEach(p => settlementRefMap.set(`INVOICE_${p.id}`, { no: p.invoiceNumber, date: p.invoiceDate, narration: '-', type: 'Purchase Invoice', updatedAt: p.updatedAt }));

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
        } else if (transaction.transactionType === TransactionType.Payment) {
          const n = paymentNarrationMap.get(transaction.invoiceNumber);
          displayNarration = n || '-';
        } else if (transaction.transactionType === TransactionType.Receipt) {
          const n = receiptNarrationMap.get(transaction.invoiceNumber);
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
             const invSettlements = allSettlements.filter(s => 
               s.invoice_id === invId && 
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
                 const ref = settlementRefMap.get(`INVOICE_${s.invoice_id}`);
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
    }
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

  async deleteAllocation(id: number) {
    const settlement = await this.prisma.voucherSettlement.findUnique({ where: { id } });
    if (!settlement) {
      throw new NotFoundException('Allocation not found');
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
}
