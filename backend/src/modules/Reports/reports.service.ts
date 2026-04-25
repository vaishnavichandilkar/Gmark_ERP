import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ReportQueryDto,
  TrendQueryDto,
  POReportQueryDto,
  SummaryResponseDto,
  StatusSummaryResponseDto,
  FinancialOverviewItem,
  ProductReportResponseDto,
  PurchaseReportResponseDto,
  SalesReportResponseDto,
  TrendInterval,
} from './dto/reports.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: number): Promise<SummaryResponseDto> {
    const [purchaseSummary, salesSummary, invoiceCount] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        where: { userId, status: { not: 'DELETED' as any } },
        _sum: { totalAmount: true },
      }),
      this.prisma.salesOrder.aggregate({
        where: { userId, status: { not: 'DELETED' as any } },
        _sum: { grandTotal: true },
      }),
      this.prisma.purchaseInvoice.count({
        where: { userId, status: { not: 'DELETED' as any } },
      }),
    ]);

    const totalPurchases = purchaseSummary._sum.totalAmount || 0;
    const totalSales = salesSummary._sum.grandTotal || 0;

    return {
      totalPurchases,
      totalSales,
      netFlow: totalSales - totalPurchases,
      totalInvoices: invoiceCount,
    };
  }

  async getStatusSummary(userId: number): Promise<StatusSummaryResponseDto> {
    const now = new Date();
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(now.getDate() + 5);

    const [pos, sos, pinvs, sinvs, grns, challans] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where: { userId }, select: { status: true, expiryDate: true } }),
      this.prisma.salesOrder.findMany({ where: { userId }, select: { status: true, expiryDate: true } }),
      this.prisma.purchaseInvoice.groupBy({ where: { userId }, by: ['status'], _count: true }),
      this.prisma.salesInvoice.groupBy({ where: { userId }, by: ['status'], _count: true }),
      this.prisma.grn.groupBy({ where: { userId }, by: ['status'], _count: true }),
      this.prisma.salesChallan.groupBy({ where: { userId }, by: ['status'], _count: true }),
    ]);

    const mapStatuses = (orders: any[]) => {
      const counts = { created: 0, pending: 0, expiringSoon: 0, expired: 0, completed: 0, deleted: 0 };
      orders.forEach((o) => {
        if (o.status === 'DELETED') counts.deleted++;
        else if (o.status === 'INVOICE_COMPLETED' || o.status === 'GRN_COMPLETED' || o.status === 'CHALLAN_COMPLETED') counts.completed++;
        else {
          const exp = new Date(o.expiryDate);
          if (exp < now) counts.expired++;
          else if (exp <= expiringSoonDate) counts.expiringSoon++;
          
          if (o.status === 'PENDING') counts.pending++;
          counts.created++;
        }
      });
      return counts;
    };

    const getCountByStatus = (groups: any[], status: string) => groups.find(g => g.status === status)?._count || 0;

    return {
      purchaseOrders: mapStatuses(pos),
      salesOrders: mapStatuses(sos),
      invoices: {
        purchase: pinvs.reduce((acc, g) => acc + (g.status !== 'DELETED' ? g._count : 0), 0),
        sales: sinvs.reduce((acc, g) => acc + (g.status !== 'DELETED' ? g._count : 0), 0),
        deleted: getCountByStatus(pinvs, 'DELETED') + getCountByStatus(sinvs, 'DELETED'),
      },
      grn: {
        generated: getCountByStatus(grns, 'GENERATED'),
        completed: getCountByStatus(grns, 'COMPLETED'),
        deleted: getCountByStatus(grns, 'DELETED'),
      },
      challans: {
        generated: getCountByStatus(challans, 'GENERATED'),
        completed: getCountByStatus(challans, 'COMPLETED'),
        deleted: getCountByStatus(challans, 'DELETED'),
      },
    };
  }

  async getPurchaseOrders(query: POReportQueryDto, userId: number) {
    const { status, dateFrom, dateTo, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = { userId };
    if (status) where.status = status as any;
    if (dateFrom || dateTo) {
      where.poCreationDate = {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo) : undefined,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { poCreationDate: 'desc' },
        select: {
          supplierName: true,
          poCreationDate: true,
          expiryDate: true,
          gstNumber: true,
          creditDays: true,
          taxAmount: true,
          totalAmount: true,
          status: true,
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: items.map(i => ({
        ...i,
        creationDate: i.poCreationDate, // Mapping for frontend
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFinancialOverview(userId: number): Promise<FinancialOverviewItem[]> {
    // Last 30 days daily overview
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [purchases, sales] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { userId, poCreationDate: { gte: startDate }, status: { not: 'DELETED' as any } },
        select: { poCreationDate: true, totalAmount: true },
      }),
      this.prisma.salesOrder.findMany({
        where: { userId, soCreationDate: { gte: startDate }, status: { not: 'DELETED' as any } },
        select: { soCreationDate: true, grandTotal: true },
      }),
    ]);

    const overviewMap: Record<string, { purchases: number; sales: number }> = {};

    purchases.forEach((p) => {
      const date = p.poCreationDate.toISOString().split('T')[0];
      overviewMap[date] = overviewMap[date] || { purchases: 0, sales: 0 };
      overviewMap[date].purchases += p.totalAmount;
    });

    sales.forEach((s) => {
      const date = s.soCreationDate.toISOString().split('T')[0];
      overviewMap[date] = overviewMap[date] || { purchases: 0, sales: 0 };
      overviewMap[date].sales += s.grandTotal;
    });

    return Object.entries(overviewMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTrends(query: TrendQueryDto, userId: number) {
    const { type, interval, dateFrom, dateTo } = query;
    let data: any[] = [];

    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      dateFilter.gte = dateFrom ? new Date(dateFrom) : undefined;
      dateFilter.lte = dateTo ? new Date(dateTo) : undefined;
    }

    if (type === 'purchase') {
      data = await this.prisma.purchaseOrder.findMany({
        where: { userId, status: { not: 'DELETED' as any }, poCreationDate: dateFilter },
        select: { poCreationDate: true, totalAmount: true },
      });
    } else if (type === 'sales') {
      data = await this.prisma.salesOrder.findMany({
        where: { userId, status: { not: 'DELETED' as any }, soCreationDate: dateFilter },
        select: { soCreationDate: true, grandTotal: true },
      });
    } else if (type === 'products') {
      data = await this.prisma.product.findMany({
        where: { created_by: userId, created_at: dateFilter },
        select: { created_at: true },
      });
    }

    const groupData = (items: any[], dateKey: string, valueKey?: string) => {
      const groups: Record<string, number> = {};
      items.forEach((item) => {
        const date = new Date(item[dateKey]);
        let key = '';
        if (interval === TrendInterval.DAILY) key = date.toISOString().split('T')[0];
        else if (interval === TrendInterval.WEEKLY) {
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
        } else if (interval === TrendInterval.MONTHLY) {
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        groups[key] = (groups[key] || 0) + (valueKey ? item[valueKey] : 1);
      });
      return Object.entries(groups)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label));
    };

    if (type === 'purchase') return groupData(data, 'poCreationDate', 'totalAmount');
    if (type === 'sales') return groupData(data, 'soCreationDate', 'grandTotal');
    return groupData(data, 'created_at');
  }

  async getProductsReport(userId: number): Promise<ProductReportResponseDto> {
    const [counts, types] = await Promise.all([
      this.prisma.product.groupBy({
        where: { created_by: userId, is_deleted: false },
        by: ['status'],
        _count: true,
      }),
      this.prisma.product.groupBy({
        where: { created_by: userId, is_deleted: false },
        by: ['product_type'],
        _count: true,
      }),
    ]);

    const active = counts.find(c => c.status === 'ACTIVE')?._count || 0;
    const inactive = counts.find(c => c.status === 'INACTIVE')?._count || 0;
    const goods = types.find(t => t.product_type === 'GOODS')?._count || 0;
    const services = types.find(t => t.product_type === 'SERVICES')?._count || 0;

    return {
      totalProducts: active + inactive,
      activeProducts: active,
      inactiveProducts: inactive,
      goods,
      services,
    };
  }

  async getPurchaseReport(userId: number): Promise<PurchaseReportResponseDto> {
    const [aggregate, count] = await Promise.all([
      this.prisma.purchaseInvoice.aggregate({
        where: { userId, status: { not: 'DELETED' } },
        _sum: { grandTotal: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      }),
      this.prisma.purchaseInvoice.count({
        where: { userId, status: { not: 'DELETED' } },
      }),
    ]);

    const totalTax = (aggregate._sum.igstAmount || 0) + (aggregate._sum.cgstAmount || 0) + (aggregate._sum.sgstAmount || 0);

    return {
      grossPurchases: aggregate._sum.grandTotal || 0,
      totalTaxPaid: totalTax,
      purchaseInvoices: count,
    };
  }

  async getSalesReport(userId: number): Promise<SalesReportResponseDto> {
    const [aggregate, count] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: { userId, status: { not: 'DELETED' as any } },
        _sum: { grandTotal: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      }),
      this.prisma.salesInvoice.count({
        where: { userId, status: 'COMPLETED' as any },
      }),
    ]);

    const totalTax = (aggregate._sum.igstAmount || 0) + (aggregate._sum.cgstAmount || 0) + (aggregate._sum.sgstAmount || 0);

    return {
      grossSales: aggregate._sum.grandTotal || 0,
      totalTaxCollected: totalTax,
      completedSales: count,
    };
  }
}
