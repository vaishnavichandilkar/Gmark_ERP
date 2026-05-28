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

      // 3.5 Save settlements
      for (const item of createDto.items) {
        const settlements = item.settlements || (createDto.settlements ? createDto.settlements : []);
        for (const s of settlements) {
          let invoice_total = null;
          let invoice_balance = null;

          if (s.settlementType === 'AGAINST_REFERENCE' && s.invoiceId) {
            const invoice = await tx.salesInvoice.findUnique({
              where: { id: s.invoiceId },
            });
            if (invoice) {
              invoice_total = invoice.grandTotal;
              const previousSettlements = await tx.voucherSettlement.findMany({
                where: { invoice_id: s.invoiceId },
              });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                if (ps.voucher_type === 'RECEIPT') {
                  return sum + Number(ps.settled_amount);
                } else if (ps.voucher_type === 'PAYMENT') {
                  return sum - Number(ps.settled_amount);
                }
                return sum;
              }, 0);
              invoice_balance = Number(invoice_total) - totalPaidSoFar;
            }
          }

          await tx.voucherSettlement.create({
            data: {
              voucher_id: voucher.id,
              voucher_type: 'RECEIPT',
              ledger_id: item.accountId,
              invoice_id: s.invoiceId || null,
              settlement_type: s.settlementType,
              invoice_total,
              invoice_balance,
              settled_amount: s.settledAmount,
            },
          });

          if (s.settlementType === 'AGAINST_REFERENCE' && s.invoiceId && invoice_balance !== null) {
            const newBalance = invoice_balance - s.settledAmount;
            if (newBalance <= 0) {
              await tx.salesInvoice.update({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }
      }

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

      // Credit Customer/Supplier Accounts
      for (const item of createDto.items) {
        const account = await tx.accountMaster.findUnique({ where: { id: item.accountId } });
        if (!account) {
          throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
        }

        const isSupplierRole = item.accountType === 'SUPPLIER' || 
          (!item.accountType && account.groupName.includes('SUNDRY_CREDITORS'));
        const isCustomerRole = !isSupplierRole;
        const txType = isSupplierRole ? TransactionType.Payment : TransactionType.Receipt;

        let isActive = true;
        if (isCustomerRole && (account.status !== MasterStatus.ACTIVE || account.customerStatus !== MasterStatus.ACTIVE)) {
          isActive = false;
        } else if (isSupplierRole && (account.status !== MasterStatus.ACTIVE || account.supplierStatus !== MasterStatus.ACTIVE)) {
          isActive = false;
        } else if (!isCustomerRole && !isSupplierRole && account.status !== MasterStatus.ACTIVE) {
          isActive = false;
        }

        if (!isActive) {
          const isEligible = await this.checkCustomerReceiptEligible(item.accountId, userId, tx);
          if (!isEligible) {
            throw new BadRequestException(`Account is inactive and has no outstanding or transaction history for settlement.`);
          }
        }

        await this.transactionService.recordTransaction({
          accountId: item.accountId,
          userId,
          bookingDate: new Date(createDto.voucherDate),
          invoiceNumber: voucherNumber,
          transactionType: txType,
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
          include: { account: { select: { accountName: true, accountType: true, groupName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
    });

    if (!voucher) throw new NotFoundException('Receipt Voucher not found');

    const settlements = await this.prisma.voucherSettlement.findMany({
      where: { voucher_id: id, voucher_type: 'RECEIPT' },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { invoiceNumber: voucher.voucherNumber, userId },
    });

    const itemsWithSettlements = voucher.items.map(item => {
      const itemSettlements = settlements
        .filter(s => s.ledger_id === item.accountId)
        .map(s => ({
          invoiceId: s.invoice_id,
          settlementType: s.settlement_type,
          settledAmount: Number(s.settled_amount),
        }));

      const itemTx = transactions.find(t => t.accountId === item.accountId);
      let role = 'CUSTOMER';
      if (itemTx) {
        if (itemTx.transactionType === TransactionType.Payment) {
          role = 'SUPPLIER';
        } else {
          role = 'CUSTOMER';
        }
      } else {
        if (item.account?.groupName?.includes('SUNDRY_CREDITORS')) {
          role = 'SUPPLIER';
        }
      }

      return {
        ...item,
        accountType: role,
        settlements: itemSettlements,
      };
    });

    return {
      ...voucher,
      items: itemsWithSettlements,
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

      // Revert and delete existing settlements
      const existingSettlements = await tx.voucherSettlement.findMany({
        where: { voucher_id: id, voucher_type: 'RECEIPT' },
      });
      for (const s of existingSettlements) {
        if (s.settlement_type === 'AGAINST_REFERENCE' && s.invoice_id) {
          await tx.salesInvoice.update({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }
      await tx.voucherSettlement.deleteMany({
        where: { voucher_id: id, voucher_type: 'RECEIPT' },
      });

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

      // Save new settlements
      for (const item of updateDto.items) {
        const settlements = item.settlements || (updateDto.settlements ? updateDto.settlements : []);
        for (const s of settlements) {
          let invoice_total = null;
          let invoice_balance = null;

          if (s.settlementType === 'AGAINST_REFERENCE' && s.invoiceId) {
            const invoice = await tx.salesInvoice.findUnique({
              where: { id: s.invoiceId },
            });
            if (invoice) {
              invoice_total = invoice.grandTotal;
              const previousSettlements = await tx.voucherSettlement.findMany({
                where: { invoice_id: s.invoiceId },
              });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                if (ps.voucher_type === 'RECEIPT') {
                  return sum + Number(ps.settled_amount);
                } else if (ps.voucher_type === 'PAYMENT') {
                  return sum - Number(ps.settled_amount);
                }
                return sum;
              }, 0);
              invoice_balance = Number(invoice_total) - totalPaidSoFar;
            }
          }

          await tx.voucherSettlement.create({
            data: {
              voucher_id: id,
              voucher_type: 'RECEIPT',
              ledger_id: item.accountId,
              invoice_id: s.invoiceId || null,
              settlement_type: s.settlementType,
              invoice_total,
              invoice_balance,
              settled_amount: s.settledAmount,
            },
          });

          if (s.settlementType === 'AGAINST_REFERENCE' && s.invoiceId && invoice_balance !== null) {
            const newBalance = invoice_balance - s.settledAmount;
            if (newBalance <= 0) {
              await tx.salesInvoice.update({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }
      }

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
        const account = await tx.accountMaster.findUnique({ where: { id: item.accountId } });
        if (!account) {
          throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
        }
        const isSupplierRole = item.accountType === 'SUPPLIER' || 
          (!item.accountType && account.groupName.includes('SUNDRY_CREDITORS'));
        const txType = isSupplierRole ? TransactionType.Payment : TransactionType.Receipt;

        await this.transactionService.recordTransaction({
          accountId: item.accountId,
          userId,
          bookingDate: new Date(updateDto.voucherDate),
          invoiceNumber: existing.voucherNumber,
          transactionType: txType,
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
      // Revert and delete existing settlements
      const existingSettlements = await tx.voucherSettlement.findMany({
        where: { voucher_id: id, voucher_type: 'RECEIPT' },
      });
      for (const s of existingSettlements) {
        if (s.settlement_type === 'AGAINST_REFERENCE' && s.invoice_id) {
          await tx.salesInvoice.update({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }
      await tx.voucherSettlement.deleteMany({
        where: { voucher_id: id, voucher_type: 'RECEIPT' },
      });

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
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: voucher.voucherNumber,
          transactionType: TransactionType.Payment,
        }, tx);
      }

      return tx.receiptVoucher.delete({ where: { id } });
    });
  }

  async checkCustomerReceiptEligible(accountId: number, userId: number, tx: any): Promise<boolean> {
    const hasInvoice = await tx.salesInvoice.findFirst({
      where: { customerId: accountId, userId, status: { not: 'DELETED' } }
    }) || await tx.purchaseInvoice.findFirst({
      where: { supplierId: accountId, userId, status: { not: 'DELETED' } }
    });
    if (hasInvoice) return true;

    const hasTransaction = await tx.transaction.findFirst({
      where: { accountId, userId }
    });
    if (hasTransaction) return true;

    const hasSettlement = await tx.voucherSettlement.findFirst({
      where: { ledger_id: accountId }
    });
    if (hasSettlement) return true;

    return false;
  }
}
