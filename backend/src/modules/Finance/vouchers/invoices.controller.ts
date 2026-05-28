import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private prisma: PrismaService) {}

  @Get('pending/:ledgerId')
  @ApiOperation({ summary: 'Get pending invoices for settlement' })
  async getPendingInvoices(
    @Param('ledgerId', ParseIntPipe) ledgerId: number,
    @Query('voucherType') voucherType: string,
  ) {
    if (!voucherType) {
      throw new BadRequestException('voucherType query parameter is required');
    }

    const type = voucherType.toLowerCase();

    if (type === 'receipt') {
      // Fetch unpaid Sales invoices for the customer (ledgerId)
      const salesInvoices = await this.prisma.salesInvoice.findMany({
        where: {
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
}
