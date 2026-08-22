import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateVoucherDto } from '../dto/voucher.dto';
import { TransactionService } from '../../transaction.service';
import { TransactionType, BalanceType, MasterStatus } from '@prisma/client';

@Injectable()
export class JournalVoucherService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TransactionService))
    private transactionService: TransactionService,
  ) {}

  async generateVoucherNumber(userId: number): Promise<string> {
    const prefix = 'JV-';
    const lastVoucher = await this.prisma.journalVoucher.findFirst({
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
      const existing = await this.prisma.journalVoucher.findUnique({
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
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: createDto.bankCashLedgerId, userId },
      });

      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash account');
      }

      const totalAmount = createDto.items.reduce((sum, item) => sum + item.amount, 0);

      // 3. Create Voucher
      const voucher = await tx.journalVoucher.create({
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

      // 3.5 Save settlements if any exist (normally Journal vouchers don't have settlements but we match the API signature)
      for (const item of createDto.items) {
        const settlements = item.settlements || (createDto.settlements ? createDto.settlements : []);
        for (const s of settlements) {
          let invoice_total = null;
          let invoice_balance = null;

          const isInvoiceSettlement = ['AGAINST_REFERENCE', 'SETTLED_ADVANCE', 'SETTLED_ON_ACCOUNT'].includes(s.settlementType);
          if (isInvoiceSettlement && s.invoiceId) {
            const invoice = await tx.salesInvoice.findFirst({
              where: { id: s.invoiceId, userId },
            }) || await tx.purchaseInvoice.findFirst({
              where: { id: s.invoiceId, userId },
            });
            
            if (invoice) {
              invoice_total = (invoice as any).grandTotal;
              const previousSettlements = await tx.voucherSettlement.findMany({
                where: { invoice_id: s.invoiceId },
              });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                if (ps.voucher_type === 'RECEIPT' || ps.voucher_type === 'JOURNAL') {
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
              voucher_type: 'JOURNAL',
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
              await tx.salesInvoice.updateMany({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
              await tx.purchaseInvoice.updateMany({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }
      }

      // 4. Record Accounting Transactions
      // Credit Bank/Cash Account (Outflow)
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: createDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(createDto.voucherDate),
          invoiceNumber: voucherNumber,
          transactionType: TransactionType.Journal,
          amount: totalAmount,
          entryType: BalanceType.Cr,
        }, tx);
      }

      // Debit Ledger Accounts (Inflow/Expense)
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
            transactionType: TransactionType.Journal,
            amount: item.amount,
            entryType: BalanceType.Dr,
          }, tx);
        }
      }

      return voucher;
    });
  }

  async findAll(userId: number) {
    return this.prisma.journalVoucher.findMany({
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
    const voucher = await this.prisma.journalVoucher.findFirst({
      where: { id, createdBy: userId },
      include: {
        items: {
          include: { account: { select: { accountName: true, accountType: true, groupName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
    });

    if (!voucher) throw new NotFoundException('Journal Voucher not found');

    const settlements = await this.prisma.voucherSettlement.findMany({
      where: { voucher_id: id, voucher_type: 'JOURNAL' },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: { invoiceNumber: voucher.voucherNumber, userId },
    });

    const itemsWithSettlements = voucher.items.map(item => {
      const itemSettlements = settlements
        .filter(s => s.ledger_id === item.accountId)
        .map(s => ({
          invoiceId: s.invoice_id,
          settlementType: s.settlement_type === 'SETTLED_ADVANCE' ? 'ADVANCE' : 
                          s.settlement_type === 'SETTLED_ON_ACCOUNT' ? 'ON_ACCOUNT' : 
                          s.settlement_type,
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
        transactionType: TransactionType.Journal,
      }, tx);

      for (const item of existing.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Journal,
        }, tx);
      }

      const totalAmount = updateDto.items.reduce((sum, item) => sum + item.amount, 0);

      // Validate Bank/Cash Ledger
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: updateDto.bankCashLedgerId, userId },
      });
      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash account');
      }

      // Revert and delete existing settlements
      const existingSettlements = await tx.voucherSettlement.findMany({
        where: { voucher_id: id, voucher_type: 'JOURNAL' },
      });
      for (const s of existingSettlements) {
        if (s.invoice_id) {
          await tx.salesInvoice.updateMany({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
          await tx.purchaseInvoice.updateMany({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }
      await tx.voucherSettlement.deleteMany({
        where: { voucher_id: id, voucher_type: 'JOURNAL' },
      });

      // Update Voucher
      const updated = await tx.journalVoucher.update({
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
            const invoice = await tx.salesInvoice.findFirst({
              where: { id: s.invoiceId, userId },
            }) || await tx.purchaseInvoice.findFirst({
              where: { id: s.invoiceId, userId },
            });
            
            if (invoice) {
              invoice_total = (invoice as any).grandTotal;
              const previousSettlements = await tx.voucherSettlement.findMany({
                where: { invoice_id: s.invoiceId },
              });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                if (ps.voucher_type === 'RECEIPT' || ps.voucher_type === 'JOURNAL') {
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
              voucher_type: 'JOURNAL',
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
              await tx.salesInvoice.updateMany({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
              await tx.purchaseInvoice.updateMany({
                where: { id: s.invoiceId },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }
      }

      // Record new transactions (Credit Bank/Cash, Debit Target Account)
      if (totalAmount > 0) {
        await this.transactionService.recordTransaction({
          accountId: updateDto.bankCashLedgerId,
          userId,
          bookingDate: new Date(updateDto.voucherDate),
          invoiceNumber: existing.voucherNumber,
          transactionType: TransactionType.Journal,
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
            transactionType: TransactionType.Journal,
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
      // Revert and delete existing settlements
      const existingSettlements = await tx.voucherSettlement.findMany({
        where: { voucher_id: id, voucher_type: 'JOURNAL' },
      });
      for (const s of existingSettlements) {
        if (s.invoice_id) {
          await tx.salesInvoice.updateMany({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
          await tx.purchaseInvoice.updateMany({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }
      await tx.voucherSettlement.deleteMany({
        where: { voucher_id: id, voucher_type: 'JOURNAL' },
      });

      // Delete transactions
      await this.transactionService.deleteTransaction({
        userId,
        accountId: voucher.bankCashLedgerId,
        invoiceNumber: voucher.voucherNumber,
        transactionType: TransactionType.Journal,
      }, tx);

      for (const item of voucher.items) {
        await this.transactionService.deleteTransaction({
          userId,
          accountId: item.accountId,
          invoiceNumber: voucher.voucherNumber,
          transactionType: TransactionType.Journal,
        }, tx);
      }

      return tx.journalVoucher.delete({ where: { id } });
    });
  }
}
