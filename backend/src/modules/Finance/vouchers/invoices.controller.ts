import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, BadRequestException, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private prisma: PrismaService) {}

  @Get('pending-all')
  @ApiOperation({ summary: 'Get all pending invoices for settlement' })
  async getAllPendingInvoices(
    @Request() req,
    @Query('voucherType') voucherType: string,
  ) {
    if (!voucherType) {
      throw new BadRequestException('voucherType query parameter is required');
    }

    const type = voucherType.toLowerCase();
    const userId = req.user.userId;

    if (type === 'receipt') {
      const salesInvoices = await this.prisma.salesInvoice.findMany({
        where: {
          userId: userId,
          status: { not: 'DELETED' },
        },
        orderBy: { invoiceDate: 'asc' },
      });

      const result = [];

      for (const invoice of salesInvoices) {
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'RECEIPT',
            ledger_id: invoice.customerId,
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'RECEIPT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'PAYMENT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          result.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
            partyName: invoice.customerName,
            ledgerId: invoice.customerId,
            totalAmount,
            paidAmount,
            balanceAmount,
            pendingAmount: balanceAmount,
          });
        }
      }

      return result;
    } else if (type === 'payment') {
      const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
        where: {
          userId: userId,
          status: { not: 'DELETED' },
        },
        orderBy: { supplierInvoiceDate: 'asc' },
      });

      const result = [];

      for (const invoice of purchaseInvoices) {
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'PAYMENT',
            ledger_id: invoice.supplierId,
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'PAYMENT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'RECEIPT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          result.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
            partyName: invoice.supplierName,
            ledgerId: invoice.supplierId,
            totalAmount,
            paidAmount,
            balanceAmount,
            pendingAmount: balanceAmount,
          });
        }
      }

      return result;
    } else {
      throw new BadRequestException('Invalid voucherType. Must be receipt or payment');
    }
  }

  @Get('pending/:ledgerId')
  @ApiOperation({ summary: 'Get pending invoices for settlement' })
  async getPendingInvoices(
    @Request() req,
    @Param('ledgerId', ParseIntPipe) ledgerId: number,
    @Query('voucherType') voucherType: string,
    @Query('excludeVoucherId') excludeVoucherId?: string,
  ) {
    if (!voucherType) {
      throw new BadRequestException('voucherType query parameter is required');
    }

    const type = voucherType.toLowerCase();
    const userId = req.user.userId;

    // Verify that the ledger belongs to the user
    const ledger = await this.prisma.accountMaster.findFirst({
      where: { id: ledgerId, userId: userId },
    });
    if (!ledger) {
      throw new BadRequestException('Account not found or unauthorized');
    }

    if (type === 'receipt') {
      // Fetch unpaid Sales invoices for the customer (ledgerId)
      const salesInvoices = await this.prisma.salesInvoice.findMany({
        where: {
          userId: userId,
          customerId: ledgerId,
          status: { not: 'DELETED' },
        },
        orderBy: { invoiceDate: 'asc' },
      });

      const result = [];

      for (const invoice of salesInvoices) {
        // Fetch settlements
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'RECEIPT',
            ledger_id: ledgerId,
            ...(excludeVoucherId ? {
              NOT: {
                voucher_id: Number(excludeVoucherId)
              }
            } : {})
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'RECEIPT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'PAYMENT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          result.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
            totalAmount,
            paidAmount,
            balanceAmount,
            pendingAmount: balanceAmount,
          });
        }
      }

      return result;
    } else if (type === 'payment') {
      // Fetch unpaid Purchase invoices for the supplier (ledgerId)
      const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
        where: {
          userId: userId,
          supplierId: ledgerId,
          status: { not: 'DELETED' },
        },
        orderBy: { supplierInvoiceDate: 'asc' },
      });

      const result = [];

      for (const invoice of purchaseInvoices) {
        // Fetch settlements
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'PAYMENT',
            ledger_id: ledgerId,
            ...(excludeVoucherId ? {
              NOT: {
                voucher_id: Number(excludeVoucherId)
              }
            } : {})
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'PAYMENT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'RECEIPT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          result.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
            totalAmount,
            paidAmount,
            balanceAmount,
            pendingAmount: balanceAmount,
          });
        }
      }

      return result;
    } else {
      throw new BadRequestException('Invalid voucherType. Must be receipt or payment');
    }
  }

  @Get('pending-double/:ledgerId')
  @ApiOperation({ summary: 'Get debit and credit pending transactions for dual-table settlement' })
  async getPendingDoubleTransactions(
    @Request() req,
    @Param('ledgerId', ParseIntPipe) ledgerId: number,
    @Query('voucherType') voucherType: string,
  ) {
    if (!voucherType) {
      throw new BadRequestException('voucherType query parameter is required');
    }

    const type = voucherType.toLowerCase();
    const userId = req.user.userId;

    // Verify that the ledger belongs to the user
    const ledger = await this.prisma.accountMaster.findFirst({
      where: { id: ledgerId, userId: userId },
    });
    if (!ledger) {
      throw new BadRequestException('Account not found or unauthorized');
    }

    const getVoucherRole = async (voucherId: number, voucherType: string): Promise<string> => {
      let voucherNumber = '';
      if (voucherType === 'RECEIPT') {
        const rv = await this.prisma.receiptVoucher.findUnique({
          where: { id: voucherId },
          select: { voucherNumber: true }
        });
        if (rv) voucherNumber = rv.voucherNumber;
      } else {
        const pv = await this.prisma.paymentVoucher.findUnique({
          where: { id: voucherId },
          select: { voucherNumber: true }
        });
        if (pv) voucherNumber = pv.voucherNumber;
      }

      if (!voucherNumber) return '';

      const tx = await this.prisma.transaction.findFirst({
        where: {
          accountId: ledgerId,
          invoiceNumber: voucherNumber,
          userId: userId
        },
        select: { transactionType: true }
      });

      if (tx) {
        if (tx.transactionType === 'Receipt') return 'CUSTOMER';
        if (tx.transactionType === 'Payment') return 'SUPPLIER';
      }

      return '';
    };

    const debitTransactions = [];
    const creditTransactions = [];

    if (type === 'receipt') {
      // Sundry Debtors (Customer)
      // 1. Debit Transactions: Unpaid Sales Invoices (they owe us money)
      const salesInvoices = await this.prisma.salesInvoice.findMany({
        where: {
          userId: userId,
          customerId: ledgerId,
          status: { not: 'DELETED' },
        },
        orderBy: { invoiceDate: 'asc' },
      });

      for (const invoice of salesInvoices) {
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'RECEIPT',
            ledger_id: ledgerId,
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'RECEIPT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'PAYMENT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          debitTransactions.push({
            id: invoice.id,
            invoiceId: invoice.id,
            settlementId: null,
            date: invoice.invoiceDate.toISOString().split('T')[0],
            type: 'Sales',
            refNo: invoice.customerInvoiceNumber || invoice.invoiceNumber,
            totalAmt: totalAmount,
            balanceAmt: balanceAmount,
          });
        }
      }

      // Add Unapplied Customer Payments (Refunds we gave them -> Debit)
      const payments = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'PAYMENT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const p of payments) {
        const role = await getVoucherRole(p.voucher_id, 'PAYMENT');
        const isCustomer = role === 'CUSTOMER' || (!role && ledger.groupName.includes('SUNDRY_DEBTORS'));
        if (isCustomer) {
          debitTransactions.push({
            id: p.id,
            invoiceId: null,
            voucherId: p.voucher_id,
            settlementId: p.id,
            date: p.created_at.toISOString().split('T')[0],
            type: p.settlement_type === 'ADVANCE' ? 'Advance' : p.settlement_type === 'ON_ACCOUNT' ? 'On Account' : p.settlement_type === 'CANCELLED_SETTLEMENT' ? 'Cancelled Settlement' : 'Payment',
            refNo: `VS-${p.id}`,
            totalAmt: Number(p.settled_amount),
            balanceAmt: Number(p.settled_amount),
          });
        }
      }

      // 2. Credit Transactions: Unapplied Customer Receipts (they paid us advance/on-account)
      const receipts = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'RECEIPT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const r of receipts) {
        const role = await getVoucherRole(r.voucher_id, 'RECEIPT');
        const isCustomer = role === 'CUSTOMER' || (!role && ledger.groupName.includes('SUNDRY_DEBTORS'));
        if (isCustomer) {
          creditTransactions.push({
            id: r.id,
            invoiceId: null,
            voucherId: r.voucher_id,
            settlementId: r.id,
            date: r.created_at.toISOString().split('T')[0],
            type: r.settlement_type === 'ADVANCE' ? 'Advance' : r.settlement_type === 'ON_ACCOUNT' ? 'On Account' : r.settlement_type === 'CANCELLED_SETTLEMENT' ? 'Cancelled Settlement' : 'Receipt',
            refNo: `VS-${r.id}`,
            totalAmt: Number(r.settled_amount),
            balanceAmt: Number(r.settled_amount),
          });
        }
      }
    } else if (type === 'payment') {
      // Sundry Creditors (Supplier)
      // 1. Debit Transactions: Unapplied Supplier Payments (we paid them advance/on-account)
      const payments = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'PAYMENT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const p of payments) {
        const role = await getVoucherRole(p.voucher_id, 'PAYMENT');
        const isSupplier = role === 'SUPPLIER' || (!role && ledger.groupName.includes('SUNDRY_CREDITORS'));
        if (isSupplier) {
          debitTransactions.push({
            id: p.id,
            invoiceId: null,
            voucherId: p.voucher_id,
            settlementId: p.id,
            date: p.created_at.toISOString().split('T')[0],
            type: p.settlement_type === 'ADVANCE' ? 'Advance' : p.settlement_type === 'ON_ACCOUNT' ? 'On Account' : p.settlement_type === 'CANCELLED_SETTLEMENT' ? 'Cancelled Settlement' : 'Payment',
            refNo: `VS-${p.id}`,
            totalAmt: Number(p.settled_amount),
            balanceAmt: Number(p.settled_amount),
          });
        }
      }

      // 2. Credit Transactions: Unpaid Purchase Invoices (we owe them money)
      const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
        where: {
          userId: userId,
          supplierId: ledgerId,
          status: { not: 'DELETED' },
        },
        orderBy: { supplierInvoiceDate: 'asc' },
      });

      for (const invoice of purchaseInvoices) {
        const settlements = await this.prisma.voucherSettlement.findMany({
          where: {
            invoice_id: invoice.id,
            voucher_type: 'PAYMENT',
            ledger_id: ledgerId,
          },
        });

        const totalAmount = Number(invoice.grandTotal);
        const paidAmount = settlements.reduce((sum, s) => {
          if (s.voucher_type === 'PAYMENT') {
            return sum + Number(s.settled_amount);
          } else if (s.voucher_type === 'RECEIPT') {
            return sum - Number(s.settled_amount);
          }
          return sum;
        }, 0);
        const balanceAmount = totalAmount - paidAmount;

        if (balanceAmount > 0) {
          creditTransactions.push({
            id: invoice.id,
            invoiceId: invoice.id,
            settlementId: null,
            date: invoice.invoiceDate.toISOString().split('T')[0],
            type: 'Purchase',
            refNo: invoice.supplierInvoiceNumber || invoice.invoiceNumber,
            totalAmt: totalAmount,
            balanceAmt: balanceAmount,
          });
        }
      }

      // Add Unapplied Supplier Receipts (Refunds they gave us -> Credit)
      const receipts = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'RECEIPT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const r of receipts) {
        const role = await getVoucherRole(r.voucher_id, 'RECEIPT');
        const isSupplier = role === 'SUPPLIER' || (!role && ledger.groupName.includes('SUNDRY_CREDITORS'));
        if (isSupplier) {
          creditTransactions.push({
            id: r.id,
            invoiceId: null,
            voucherId: r.voucher_id,
            settlementId: r.id,
            date: r.created_at.toISOString().split('T')[0],
            type: r.settlement_type === 'ADVANCE' ? 'Advance' : r.settlement_type === 'ON_ACCOUNT' ? 'On Account' : r.settlement_type === 'CANCELLED_SETTLEMENT' ? 'Cancelled Settlement' : 'Receipt',
            refNo: `VS-${r.id}`,
            totalAmt: Number(r.settled_amount),
            balanceAmt: Number(r.settled_amount),
          });
        }
      }
    }

    return {
      debitTransactions,
      creditTransactions,
    };
  }
}
