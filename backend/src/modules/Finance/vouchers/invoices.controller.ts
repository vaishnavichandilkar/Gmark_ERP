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

        if (balanceAmount > 0.001) {
          debitTransactions.push({
            id: `INV-${invoice.id}`,
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
      const vsPayments = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'PAYMENT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const p of vsPayments) {
        debitTransactions.push({
          id: `VS-${p.id}`,
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

      // 2. Credit Transactions: Customer Receipts (Receipt Vouchers & Voucher Settlements)
      const processedVoucherIds = new Set<number>();

      const vsReceipts = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'RECEIPT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const r of vsReceipts) {
        processedVoucherIds.add(r.voucher_id);
        creditTransactions.push({
          id: `VS-${r.id}`,
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

      const receiptItems = await this.prisma.receiptVoucherItem.findMany({
        where: {
          accountId: ledgerId,
          receiptVoucher: {
            createdBy: userId,
          },
        },
        include: {
          receiptVoucher: true,
        },
        orderBy: {
          receiptVoucher: { voucherDate: 'asc' },
        },
      });

      for (const item of receiptItems) {
        if (processedVoucherIds.has(item.voucherId)) continue;

        const settledRows = await this.prisma.voucherSettlement.findMany({
          where: {
            voucher_id: item.voucherId,
            voucher_type: 'RECEIPT',
            ledger_id: ledgerId,
            invoice_id: { not: null },
          },
        });

        const totalAmt = Number(item.amount);
        const settledAmt = settledRows.reduce((sum, s) => sum + Number(s.settled_amount), 0);
        const balanceAmt = totalAmt - settledAmt;

        if (balanceAmt > 0.001) {
          processedVoucherIds.add(item.voucherId);
          creditTransactions.push({
            id: `RV-${item.id}`,
            invoiceId: null,
            voucherId: item.voucherId,
            settlementId: null,
            date: item.receiptVoucher.voucherDate.toISOString().split('T')[0],
            type: 'Receipt',
            refNo: item.receiptVoucher.voucherNumber,
            totalAmt: totalAmt,
            balanceAmt: balanceAmt,
          });
        }
      }
    } else if (type === 'payment') {
      // Sundry Creditors (Supplier)
      // 1. Debit Transactions: Supplier Payments (Payment Vouchers & Voucher Settlements)
      const processedVoucherIds = new Set<number>();

      const vsPayments = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'PAYMENT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const p of vsPayments) {
        processedVoucherIds.add(p.voucher_id);
        debitTransactions.push({
          id: `VS-${p.id}`,
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

      const paymentItems = await this.prisma.paymentVoucherItem.findMany({
        where: {
          accountId: ledgerId,
          paymentVoucher: {
            createdBy: userId,
          },
        },
        include: {
          paymentVoucher: true,
        },
        orderBy: {
          paymentVoucher: { voucherDate: 'asc' },
        },
      });

      for (const item of paymentItems) {
        if (processedVoucherIds.has(item.voucherId)) continue;

        const settledRows = await this.prisma.voucherSettlement.findMany({
          where: {
            voucher_id: item.voucherId,
            voucher_type: 'PAYMENT',
            ledger_id: ledgerId,
            invoice_id: { not: null },
          },
        });

        const totalAmt = Number(item.amount);
        const settledAmt = settledRows.reduce((sum, s) => sum + Number(s.settled_amount), 0);
        const balanceAmt = totalAmt - settledAmt;

        if (balanceAmt > 0.001) {
          processedVoucherIds.add(item.voucherId);
          debitTransactions.push({
            id: `PV-${item.id}`,
            invoiceId: null,
            voucherId: item.voucherId,
            settlementId: null,
            date: item.paymentVoucher.voucherDate.toISOString().split('T')[0],
            type: 'Payment',
            refNo: item.paymentVoucher.voucherNumber,
            totalAmt: totalAmt,
            balanceAmt: balanceAmt,
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

        if (balanceAmount > 0.001) {
          creditTransactions.push({
            id: `INV-${invoice.id}`,
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
      const vsReceipts = await this.prisma.voucherSettlement.findMany({
        where: {
          ledger_id: ledgerId,
          voucher_type: 'RECEIPT',
          settlement_type: { in: ['ADVANCE', 'ON_ACCOUNT', 'CANCELLED_SETTLEMENT'] },
        },
        orderBy: { created_at: 'asc' },
      });

      for (const r of vsReceipts) {
        creditTransactions.push({
          id: `VS-${r.id}`,
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

    return {
      debitTransactions,
      creditTransactions,
    };
  }
}

