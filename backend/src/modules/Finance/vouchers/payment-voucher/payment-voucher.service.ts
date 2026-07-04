import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateVoucherDto } from '../dto/voucher.dto';
import { TransactionService } from '../../transaction.service';
import { TransactionType, BalanceType, MasterStatus } from '@prisma/client';

@Injectable()
export class PaymentVoucherService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TransactionService))
    private transactionService: TransactionService,
  ) {}

  async generateVoucherNumber(userId: number): Promise<string> {
    const prefix = 'PV-';
    const lastVoucher = await this.prisma.paymentVoucher.findFirst({
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
      const existing = await this.prisma.paymentVoucher.findUnique({
        where: { voucherNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      nextNumber++;
    }
  }

  async generateJournalVoucherNumber(userId: number, tx: any): Promise<string> {
    const prefix = 'JV-';
    const lastVoucher = await tx.journalVoucher.findFirst({
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
      const existing = await tx.journalVoucher.findUnique({
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
      // 1. Validate Bank/Cash Ledger
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: createDto.bankCashLedgerId, userId },
      });

      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash account');
      }

      // 2. Split items into payment (Advance/Against Ref/unallocated) and journal (Expenses/ON_ACCOUNT)
      const paymentItemsList = [];
      const journalItemsList = [];

      for (const item of createDto.items) {
        const onAccountSettlements = item.settlements?.filter(s => s.settlementType === 'ON_ACCOUNT') || [];
        const otherSettlements = item.settlements?.filter(s => s.settlementType !== 'ON_ACCOUNT') || [];

        if (onAccountSettlements.length > 0) {
          const jvAmount = onAccountSettlements.reduce((sum, s) => sum + Number(s.settledAmount), 0);
          journalItemsList.push({
            ...item,
            amount: jvAmount,
            settlements: onAccountSettlements
          });
        }

        const hasNonJvSettlement = otherSettlements.length > 0 || !item.settlements || item.settlements.length === 0;
        if (hasNonJvSettlement) {
          const nonJvAmount = otherSettlements.length > 0 
            ? otherSettlements.reduce((sum, s) => sum + Number(s.settledAmount), 0)
            : item.amount;
          paymentItemsList.push({
            ...item,
            amount: nonJvAmount,
            settlements: otherSettlements
          });
        }
      }

      // If it is a pure expense voucher (no payment items, only journal items), skip PV and create a standalone JV
      if (paymentItemsList.length === 0) {
        const jvNumber = await this.generateJournalVoucherNumber(userId, tx);
        const jvTotalAmount = journalItemsList.reduce((sum, item) => sum + item.amount, 0);

        const jvVoucher = await tx.journalVoucher.create({
          data: {
            voucherNumber: jvNumber,
            voucherDate: new Date(createDto.voucherDate),
            bankCashLedgerId: createDto.bankCashLedgerId,
            paymentMode: createDto.paymentMode,
            narration: createDto.narration,
            totalAmount: jvTotalAmount,
            createdBy: userId,
            items: {
              create: journalItemsList.map((item) => ({
                accountId: item.accountId,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });

        // Process settlements for journal items (Expenses / ON_ACCOUNT)
        for (const item of journalItemsList) {
          const settlements = item.settlements || [];
          for (const s of settlements) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: jvVoucher.id,
                voucher_type: 'JOURNAL',
                ledger_id: item.accountId,
                invoice_id: s.invoiceId || null,
                settlement_type: s.settlementType,
                settled_amount: s.settledAmount,
              }
            });
          }
        }

        // Record Bank/Cash credit for Journal (outflow)
        if (jvTotalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: createDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(createDto.voucherDate),
            invoiceNumber: jvNumber,
            transactionType: TransactionType.Journal,
            amount: jvTotalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        // Record Supplier debit for Journal
        for (const item of journalItemsList) {
          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(createDto.voucherDate),
              invoiceNumber: jvNumber,
              transactionType: TransactionType.Journal,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }

        return jvVoucher;
      }

      // 3. Create Payment Voucher parent record
      const voucherNumber = await this.generateVoucherNumber(userId);
      const totalAmount = paymentItemsList.reduce((sum, item) => sum + item.amount, 0);

      const voucher = await tx.paymentVoucher.create({
        data: {
          voucherNumber,
          voucherDate: new Date(createDto.voucherDate),
          bankCashLedgerId: createDto.bankCashLedgerId,
          paymentMode: createDto.paymentMode,
          narration: createDto.narration,
          totalAmount,
          createdBy: userId,
          items: {
            create: paymentItemsList.map((item) => ({
              accountId: item.accountId,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 3.5 Process settlements and transactions for payment items if any
      if (paymentItemsList.length > 0) {
        for (const item of paymentItemsList) {
          const settlements = item.settlements || [];
          const invoiceSettlements = settlements.filter(s => s.invoiceId && s.settlementType === 'AGAINST_REFERENCE');
          const voucherSettlements = settlements.filter(s => s.settlementType === 'ABSORB_VOUCHER');
          const otherSettlements = settlements.filter(s => s.settlementType !== 'ABSORB_VOUCHER' && s.settlementType !== 'AGAINST_REFERENCE');

          for (const inv of invoiceSettlements) {
            let invRemaining = Number(inv.settledAmount);
            const invoiceObj = await tx.purchaseInvoice.findFirst({ where: { id: inv.invoiceId, userId } });
            if (!invoiceObj) {
              throw new BadRequestException(`Invoice not found or access denied for ID: ${inv.invoiceId}`);
            }

            for (const v of voucherSettlements) {
              if (v.settledAmount > 0 && invRemaining > 0) {
                const allocation = Math.min(Number(v.settledAmount), invRemaining);
                v.settledAmount = Number(v.settledAmount) - allocation;
                invRemaining -= allocation;
                
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

                await tx.voucherSettlement.create({
                  data: {
                    voucher_id: v.voucherId,
                    voucher_type: 'PAYMENT',
                    ledger_id: item.accountId,
                    invoice_id: inv.invoiceId,
                    settlement_type: targetSettlementType,
                    settled_amount: allocation,
                  }
                });

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
                      await tx.voucherSettlement.delete({ where: { id: v.settlementId } });
                    }
                  }
                }
              }
            }

            if (invRemaining > 0.001) {
              await tx.voucherSettlement.create({
                data: {
                  voucher_id: voucher.id,
                  voucher_type: 'PAYMENT',
                  ledger_id: item.accountId,
                  invoice_id: inv.invoiceId,
                  settlement_type: 'AGAINST_REFERENCE',
                  settled_amount: invRemaining,
                }
              });
            }

            if (invoiceObj) {
              const previousSettlements = await tx.voucherSettlement.findMany({ where: { invoice_id: inv.invoiceId } });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                return sum + (ps.voucher_type === 'PAYMENT' ? Number(ps.settled_amount) : -Number(ps.settled_amount));
              }, 0);
              const balance = Number(invoiceObj.grandTotal) - totalPaidSoFar;
              if (balance <= 0.001) {
                await tx.purchaseInvoice.update({
                  where: { id: inv.invoiceId },
                  data: { status: 'COMPLETED' },
                });
              }
            }
          }

          for (const o of otherSettlements) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: voucher.id,
                voucher_type: 'PAYMENT',
                ledger_id: item.accountId,
                invoice_id: o.invoiceId || null,
                settlement_type: o.settlementType,
                settled_amount: o.settledAmount,
              }
            });
          }
        }

        // Record Bank/Cash credit for Payment
        if (totalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: createDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(createDto.voucherDate),
            invoiceNumber: voucherNumber,
            transactionType: TransactionType.Payment,
            amount: totalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        // Record Supplier debit for Payment
        for (const item of paymentItemsList) {
          const account = await tx.accountMaster.findFirst({ where: { id: item.accountId, userId } });
          if (!account) {
            throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
          }
          const isCustomerRole = item.accountType === 'CUSTOMER' || 
            (!item.accountType && account.groupName.includes('SUNDRY_DEBTORS') && !account.groupName.includes('SUNDRY_CREDITORS'));
          const txType = isCustomerRole ? TransactionType.Receipt : TransactionType.Payment;

          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(createDto.voucherDate),
              invoiceNumber: voucherNumber,
              transactionType: txType,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }
      }

      // 4. Create Journal Voucher child record if there are journal/expense items
      if (journalItemsList.length > 0) {
        const jvNumber = await this.generateJournalVoucherNumber(userId, tx);
        const jvTotalAmount = journalItemsList.reduce((sum, item) => sum + item.amount, 0);

        const parentTag = ` [Parent PV ID: ${voucher.id}]`;
        const jvNarration = `${createDto.narration || ''}${parentTag}`;

        const jvVoucher = await tx.journalVoucher.create({
          data: {
            voucherNumber: jvNumber,
            voucherDate: new Date(createDto.voucherDate),
            bankCashLedgerId: createDto.bankCashLedgerId,
            paymentMode: createDto.paymentMode,
            narration: jvNarration,
            totalAmount: jvTotalAmount,
            createdBy: userId,
            items: {
              create: journalItemsList.map((item) => ({
                accountId: item.accountId,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });

        // Process settlements for journal items (Expenses / ON_ACCOUNT)
        for (const item of journalItemsList) {
          const settlements = item.settlements || [];
          for (const s of settlements) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: jvVoucher.id,
                voucher_type: 'JOURNAL',
                ledger_id: item.accountId,
                invoice_id: s.invoiceId || null,
                settlement_type: s.settlementType,
                settled_amount: s.settledAmount,
              }
            });
          }
        }

        // Record Bank/Cash credit for Journal (outflow)
        if (jvTotalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: createDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(createDto.voucherDate),
            invoiceNumber: jvNumber,
            transactionType: TransactionType.Journal,
            amount: jvTotalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        // Record Supplier debit for Journal
        for (const item of journalItemsList) {
          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(createDto.voucherDate),
              invoiceNumber: jvNumber,
              transactionType: TransactionType.Journal,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }
      }

      return voucher;
    });
  }

  async findAll(userId: number) {
    const vouchers = await this.prisma.paymentVoucher.findMany({
      where: { 
        createdBy: userId,
      },
      include: {
        items: {
          include: { account: { select: { accountName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vouchers.map((voucher) => {
      return {
        ...voucher,
        totalAmount: Number(voucher.totalAmount),
        items: voucher.items,
      };
    }).filter(v => v.totalAmount > 0);
  }

  async findOne(id: number, userId: number) {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { id, createdBy: userId },
      include: {
        items: {
          include: { account: { select: { accountName: true, accountType: true, groupName: true } } },
        },
        bankCashLedger: { select: { accountName: true } },
      },
    });

    if (!voucher) throw new NotFoundException('Payment Voucher not found');

    // Fetch settlements for PV only
    const settlements = await this.prisma.voucherSettlement.findMany({
      where: { 
        voucher_id: id,
        voucher_type: 'PAYMENT'
      },
    });

    // Fetch transactions for PV only
    const transactions = await this.prisma.transaction.findMany({
      where: { 
        invoiceNumber: voucher.voucherNumber, 
        userId 
      },
    });

    const pvItemsMapped = voucher.items.map(item => {
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
      let role = 'SUPPLIER';
      if (itemTx) {
        role = itemTx.transactionType === TransactionType.Receipt ? 'CUSTOMER' : 'SUPPLIER';
      } else {
        if (item.account?.groupName?.includes('SUNDRY_DEBTORS') && !item.account?.groupName?.includes('SUNDRY_CREDITORS')) {
          role = 'CUSTOMER';
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
      totalAmount: Number(voucher.totalAmount),
      items: pvItemsMapped,
    };
  }

  async update(id: number, updateDto: CreateVoucherDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentVoucher.findFirst({
        where: { id, createdBy: userId },
      });
      if (!existing) throw new NotFoundException('Payment Voucher not found');

      // 1. Find all associated JVs
      const linkedJvs = await tx.journalVoucher.findMany({
        where: {
          createdBy: userId,
          narration: {
            contains: `[Parent PV ID: ${id}]`,
          },
        },
      });

      const linkedJvIds = linkedJvs.map(jv => jv.id);
      const linkedJvNumbers = linkedJvs.map(jv => jv.voucherNumber);

      // 2. Revert settlements for both PV and JVs
      const allVoucherSettlements = await tx.voucherSettlement.findMany({
        where: {
          OR: [
            { voucher_id: id, voucher_type: 'PAYMENT' },
            { voucher_id: { in: linkedJvIds }, voucher_type: 'JOURNAL' }
          ]
        },
      });

      for (const s of allVoucherSettlements) {
        if (s.invoice_id) {
          await tx.purchaseInvoice.update({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }

      await tx.voucherSettlement.deleteMany({
        where: {
          OR: [
            { voucher_id: id, voucher_type: 'PAYMENT' },
            { voucher_id: { in: linkedJvIds }, voucher_type: 'JOURNAL' }
          ]
        },
      });

      // 3. Delete transactions for both PV and linked JVs
      await tx.transaction.deleteMany({
        where: {
          userId,
          invoiceNumber: { in: [existing.voucherNumber, ...linkedJvNumbers] },
        },
      });

      // 4. Delete associated child JVs
      if (linkedJvIds.length > 0) {
        await tx.journalVoucher.deleteMany({
          where: { id: { in: linkedJvIds } },
        });
      }

      // 5. Validate Bank/Cash Ledger
      const bankCashLedger = await tx.accountMaster.findFirst({
        where: { id: updateDto.bankCashLedgerId, userId },
      });
      if (!bankCashLedger || bankCashLedger.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive Bank/Cash account');
      }

      // 6. Split updated items into payment and journal
      const paymentItemsList = [];
      const journalItemsList = [];

      for (const item of updateDto.items) {
        const onAccountSettlements = item.settlements?.filter(s => s.settlementType === 'ON_ACCOUNT') || [];
        const otherSettlements = item.settlements?.filter(s => s.settlementType !== 'ON_ACCOUNT') || [];

        if (onAccountSettlements.length > 0) {
          const jvAmount = onAccountSettlements.reduce((sum, s) => sum + Number(s.settledAmount), 0);
          journalItemsList.push({
            ...item,
            amount: jvAmount,
            settlements: onAccountSettlements
          });
        }

        const hasNonJvSettlement = otherSettlements.length > 0 || !item.settlements || item.settlements.length === 0;
        if (hasNonJvSettlement) {
          const nonJvAmount = otherSettlements.length > 0 
            ? otherSettlements.reduce((sum, s) => sum + Number(s.settledAmount), 0)
            : item.amount;
          paymentItemsList.push({
            ...item,
            amount: nonJvAmount,
            settlements: otherSettlements
          });
        }
      }

      // If it has become a pure expense voucher (no payment items, only journal items)
      if (paymentItemsList.length === 0) {
        // Delete the parent Payment Voucher
        await tx.paymentVoucher.delete({
          where: { id },
        });

        const jvNumber = await this.generateJournalVoucherNumber(userId, tx);
        const jvTotalAmount = journalItemsList.reduce((sum, item) => sum + item.amount, 0);

        const jvVoucher = await tx.journalVoucher.create({
          data: {
            voucherNumber: jvNumber,
            voucherDate: new Date(updateDto.voucherDate),
            bankCashLedgerId: updateDto.bankCashLedgerId,
            paymentMode: updateDto.paymentMode,
            narration: updateDto.narration,
            totalAmount: jvTotalAmount,
            createdBy: userId,
            items: {
              create: journalItemsList.map((item) => ({
                accountId: item.accountId,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });

        // Process settlements for journal items (Expenses / ON_ACCOUNT)
        for (const item of journalItemsList) {
          const settlements = item.settlements || [];
          for (const s of settlements) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: jvVoucher.id,
                voucher_type: 'JOURNAL',
                ledger_id: item.accountId,
                invoice_id: s.invoiceId || null,
                settlement_type: s.settlementType,
                settled_amount: s.settledAmount,
              }
            });
          }
        }

        // Record Bank/Cash credit for Journal (outflow)
        if (jvTotalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: updateDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(updateDto.voucherDate),
            invoiceNumber: jvNumber,
            transactionType: TransactionType.Journal,
            amount: jvTotalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        // Record Supplier debit for Journal
        for (const item of journalItemsList) {
          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(updateDto.voucherDate),
              invoiceNumber: jvNumber,
              transactionType: TransactionType.Journal,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }

        return jvVoucher;
      }

      const totalAmount = paymentItemsList.reduce((sum, item) => sum + item.amount, 0);

      // 7. Update the Payment Voucher
      const updated = await tx.paymentVoucher.update({
        where: { id },
        data: {
          voucherDate: new Date(updateDto.voucherDate),
          bankCashLedgerId: updateDto.bankCashLedgerId,
          paymentMode: updateDto.paymentMode,
          narration: updateDto.narration,
          totalAmount,
          items: {
            deleteMany: {},
            create: paymentItemsList.map((item) => ({
              accountId: item.accountId,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 8. Process settlements and transactions for updated payment items
      if (paymentItemsList.length > 0) {
        for (const item of paymentItemsList) {
          const settlements = item.settlements || [];
          for (const s of settlements) {
            let invoice_total = null;
            let invoice_balance = null;

            const isInvoiceSettlement = ['AGAINST_REFERENCE', 'SETTLED_ADVANCE', 'SETTLED_ON_ACCOUNT'].includes(s.settlementType);
            if (isInvoiceSettlement && s.invoiceId) {
              const invoice = await tx.purchaseInvoice.findFirst({
                where: { id: s.invoiceId, userId },
              });
              if (!invoice) {
                throw new BadRequestException(`Invoice not found or access denied for ID: ${s.invoiceId}`);
              }
              invoice_total = invoice.grandTotal;
              const previousSettlements = await tx.voucherSettlement.findMany({
                where: { invoice_id: s.invoiceId },
              });
              const totalPaidSoFar = previousSettlements.reduce((sum, ps) => {
                if (ps.voucher_type === 'PAYMENT') {
                  return sum + Number(ps.settled_amount);
                } else if (ps.voucher_type === 'RECEIPT') {
                  return sum - Number(ps.settled_amount);
                }
                return sum;
              }, 0);
              invoice_balance = Number(invoice_total) - totalPaidSoFar;
            }

            await tx.voucherSettlement.create({
              data: {
                voucher_id: id,
                voucher_type: 'PAYMENT',
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
                await tx.purchaseInvoice.update({
                  where: { id: s.invoiceId },
                  data: { status: 'COMPLETED' },
                });
              }
            }
          }
        }

        if (totalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: updateDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(updateDto.voucherDate),
            invoiceNumber: existing.voucherNumber,
            transactionType: TransactionType.Payment,
            amount: totalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        for (const item of paymentItemsList) {
          const account = await tx.accountMaster.findFirst({ where: { id: item.accountId, userId } });
          if (!account) {
            throw new BadRequestException(`Invalid account ID: ${item.accountId}`);
          }
          const isCustomerRole = item.accountType === 'CUSTOMER' || 
            (!item.accountType && account.groupName.includes('SUNDRY_DEBTORS') && !account.groupName.includes('SUNDRY_CREDITORS'));
          const txType = isCustomerRole ? TransactionType.Receipt : TransactionType.Payment;

          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(updateDto.voucherDate),
              invoiceNumber: existing.voucherNumber,
              transactionType: txType,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }
      }

      // 9. Re-create linked JVs if updated journal items exist
      if (journalItemsList.length > 0) {
        const jvNumber = await this.generateJournalVoucherNumber(userId, tx);
        const jvTotalAmount = journalItemsList.reduce((sum, item) => sum + item.amount, 0);

        const parentTag = ` [Parent PV ID: ${id}]`;
        const jvNarration = `${updateDto.narration || ''}${parentTag}`;

        const jvVoucher = await tx.journalVoucher.create({
          data: {
            voucherNumber: jvNumber,
            voucherDate: new Date(updateDto.voucherDate),
            bankCashLedgerId: updateDto.bankCashLedgerId,
            paymentMode: updateDto.paymentMode,
            narration: jvNarration,
            totalAmount: jvTotalAmount,
            createdBy: userId,
            items: {
              create: journalItemsList.map((item) => ({
                accountId: item.accountId,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });

        // Save settlements for JVs
        for (const item of journalItemsList) {
          const settlements = item.settlements || [];
          for (const s of settlements) {
            await tx.voucherSettlement.create({
              data: {
                voucher_id: jvVoucher.id,
                voucher_type: 'JOURNAL',
                ledger_id: item.accountId,
                invoice_id: s.invoiceId || null,
                settlement_type: s.settlementType,
                settled_amount: s.settledAmount,
              }
            });
          }
        }

        // Record Bank/Cash credit for Journal (outflow)
        if (jvTotalAmount > 0) {
          await this.transactionService.recordTransaction({
            accountId: updateDto.bankCashLedgerId,
            userId,
            bookingDate: new Date(updateDto.voucherDate),
            invoiceNumber: jvNumber,
            transactionType: TransactionType.Journal,
            amount: jvTotalAmount,
            entryType: BalanceType.Cr,
          }, tx);
        }

        // Record Supplier debit for Journal
        for (const item of journalItemsList) {
          if (item.amount > 0) {
            await this.transactionService.recordTransaction({
              accountId: item.accountId,
              userId,
              bookingDate: new Date(updateDto.voucherDate),
              invoiceNumber: jvNumber,
              transactionType: TransactionType.Journal,
              amount: item.amount,
              entryType: BalanceType.Dr,
            }, tx);
          }
        }
      }

      return updated;
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.paymentVoucher.findFirst({
      where: { id, createdBy: userId },
    });
    if (!existing) throw new NotFoundException('Payment Voucher not found');

    return this.prisma.$transaction(async (tx) => {
      // Find linked JVs
      const linkedJvs = await tx.journalVoucher.findMany({
        where: {
          createdBy: userId,
          narration: {
            contains: `[Parent PV ID: ${id}]`,
          },
        },
      });

      const linkedJvIds = linkedJvs.map(jv => jv.id);
      const linkedJvNumbers = linkedJvs.map(jv => jv.voucherNumber);

      // Revert settlements for both PV and linked JVs
      const allVoucherSettlements = await tx.voucherSettlement.findMany({
        where: {
          OR: [
            { voucher_id: id, voucher_type: 'PAYMENT' },
            { voucher_id: { in: linkedJvIds }, voucher_type: 'JOURNAL' }
          ]
        },
      });

      for (const s of allVoucherSettlements) {
        if (s.invoice_id) {
          await tx.purchaseInvoice.update({
            where: { id: s.invoice_id },
            data: { status: 'GENERATED' },
          });
        }
      }

      await tx.voucherSettlement.deleteMany({
        where: {
          OR: [
            { voucher_id: id, voucher_type: 'PAYMENT' },
            { voucher_id: { in: linkedJvIds }, voucher_type: 'JOURNAL' }
          ]
        },
      });

      // Delete transactions for both PV and linked JVs
      await tx.transaction.deleteMany({
        where: {
          userId,
          invoiceNumber: { in: [existing.voucherNumber, ...linkedJvNumbers] },
        },
      });

      // Delete child JVs
      if (linkedJvIds.length > 0) {
        await tx.journalVoucher.deleteMany({
          where: { id: { in: linkedJvIds } },
        });
      }

      // Delete parent PV
      return tx.paymentVoucher.delete({ where: { id } });
    });
  }

  async checkSupplierPaymentEligible(accountId: number, userId: number, tx: any): Promise<boolean> {
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
