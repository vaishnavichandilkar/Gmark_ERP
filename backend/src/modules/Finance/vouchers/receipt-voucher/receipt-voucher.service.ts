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
    const lastVoucher = await this.prisma.receiptVoucher.findFirst({
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
      const existing = await this.prisma.receiptVoucher.findUnique({
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

      // 3.5 Save settlements sequentially using available funds (absorbed vouchers + new cash)
      for (const item of createDto.items) {
        const settlements = item.settlements || (createDto.settlements ? createDto.settlements : []);
        
        const invoiceSettlements = settlements.filter(s => s.invoiceId && s.settlementType === 'AGAINST_REFERENCE');
        const voucherSettlements = settlements.filter(s => s.settlementType === 'ABSORB_VOUCHER');
        const otherSettlements = settlements.filter(s => !s.invoiceId && s.settlementType !== 'ABSORB_VOUCHER');

        // Pair invoices with absorbed vouchers first
        for (const inv of invoiceSettlements) {
          let invRemaining = Number(inv.settledAmount);

          for (const v of voucherSettlements) {
            if (v.settledAmount > 0 && invRemaining > 0) {
              const allocation = Math.min(Number(v.settledAmount), invRemaining);
              v.settledAmount = Number(v.settledAmount) - allocation;
              invRemaining -= allocation;
              
              // Find the original settlement type to determine if it was ADVANCE or ON_ACCOUNT
              let targetSettlementType = 'SETTLED_ON_ACCOUNT';
              if (v.settlementId) {
                const original = await tx.voucherSettlement.findUnique({ where: { id: v.settlementId } });
                if (original) {
                  if (original.settlement_type === 'ADVANCE') {
                    targetSettlementType = 'SETTLED_ADVANCE';
                  } else if (original.settlement_type === 'ON_ACCOUNT') {
                    targetSettlementType = 'SETTLED_ON_ACCOUNT';
                  }
                }
              }

              // Map existing voucher to this invoice
              await tx.voucherSettlement.create({
                data: {
                  voucher_id: v.voucherId, // Map original receipt directly to invoice
                  voucher_type: 'RECEIPT',
                  ledger_id: item.accountId,
                  invoice_id: inv.invoiceId,
                  settlement_type: targetSettlementType,
                  settled_amount: allocation,
                }
              });

              // Reduce the unallocated row of the original receipt
              if (v.settlementId) {
                const original = await tx.voucherSettlement.findUnique({ where: { id: v.settlementId } });
                if (original && Number(original.settled_amount) >= allocation) {
                  const newAmount = Number(original.settled_amount) - allocation;
                  if (newAmount > 0.001) {
                    await tx.voucherSettlement.update({
                      where: { id: v.settlementId },
                      data: { settled_amount: newAmount }
                    });
                  } else {
                    await tx.voucherSettlement.delete({
                      where: { id: v.settlementId }
                    });
                  }
                }
              }
            }
          }

          // Any remaining amount for this invoice is paid by the NEW Receipt Voucher
          if (invRemaining > 0.001) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: voucher.id, // Map new cash receipt to invoice
                voucher_type: 'RECEIPT',
                ledger_id: item.accountId,
                invoice_id: inv.invoiceId,
                settlement_type: 'AGAINST_REFERENCE',
                settled_amount: invRemaining,
              }
            });
          }

          // Check invoice balance
          const invoiceObj = await tx.salesInvoice.findUnique({ where: { id: inv.invoiceId } });
          if (invoiceObj) {
            const previousSettlements = await tx.voucherSettlement.findMany({ where: { invoice_id: inv.invoiceId } });
            const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
              return sum + (ps.voucher_type === 'RECEIPT' ? Number(ps.settled_amount) : -Number(ps.settled_amount));
            }, 0);
            const balance = Number(invoiceObj.grandTotal) - totalPaidSoFar;
            if (balance <= 0.001) {
              await tx.salesInvoice.update({
                where: { id: inv.invoiceId },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }

        // Process any other settlements (Advance, On Account) that are NOT absorbing existing vouchers
        for (const o of otherSettlements) {
          await tx.voucherSettlement.create({
            data: {
              voucher_id: voucher.id,
              voucher_type: 'RECEIPT',
              ledger_id: item.accountId,
              invoice_id: null,
              settlement_type: o.settlementType,
              settled_amount: o.settledAmount,
            }
          });
        }
      }

      // 4. Record Accounting Transactions
      // Debit Bank/Cash Account
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: createDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(createDto.voucherDate),
          invoiceNumber: voucherNumber,
          transactionType: TransactionType.Receipt,
          amount: totalAmount,
          entryType: BalanceType.Dr,
        }, tx);
      }

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

        if (item.amount > 0) {
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
      }

      return voucher;
    });
  }

  async findAll(userId: number) {
    return this.prisma.receiptVoucher.findMany({
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
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Payment,
        }, tx);
      }

      const totalAmount = updateDto.items.reduce((sum, item) => sum + item.amount, 0);

      // Revert and delete existing settlements
      const existingSettlements = await tx.voucherSettlement.findMany({
        where: { voucher_id: id, voucher_type: 'RECEIPT' },
      });
      for (const s of existingSettlements) {
        if (s.invoice_id) {
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

          const isInvoiceSettlement = ['AGAINST_REFERENCE', 'SETTLED_ADVANCE', 'SETTLED_ON_ACCOUNT'].includes(s.settlementType);
          if (isInvoiceSettlement && s.invoiceId) {
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

          if (isInvoiceSettlement && s.invoiceId && invoice_balance !== null) {
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
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: updateDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(updateDto.voucherDate),
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Receipt,
          amount: totalAmount,
          entryType: BalanceType.Dr,
        }, tx);
      }

      for (const item of updateDto.items) {
        const account = await tx.accountMaster.findUnique({ where: { id: item.accountId } });
        if (!account) {
          throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
        }
        const isSupplierRole = item.accountType === 'SUPPLIER' || 
          (!item.accountType && account.groupName.includes('SUNDRY_CREDITORS'));
        const txType = isSupplierRole ? TransactionType.Payment : TransactionType.Receipt;

        if (item.amount > 0) {
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
        if (s.invoice_id) {
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
