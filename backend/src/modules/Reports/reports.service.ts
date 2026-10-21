import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ProfitLossQueryDto,
  TradingProfitLossResponseDto,
  StockValuationMethod,
  InventoryQueryDto,
  InventoryReportResponseDto,
  InventoryReportItemDto,
  InventoryReportSummaryDto,
  BalanceSheetQueryDto,
  BalanceSheetResponseDto,
  OverallSalesReportQueryDto,
  CustomerSalesReportQueryDto,
  CustomerSalesSummaryResponseDto,
  CustomerSalesGroupsResponseDto,
  CustomerSalesFilterOptionsResponseDto,
  CustomerMonthlySalesResponseDto,
  CustomerMonthlySalesItemDto,
  CustomerTimeSalesItemDto,
  GranularitySummaryDto,
  CustomerSalesInvoiceItemDto,
  CustomerTypeGroupDto,
  CustomerSalesItemDto,
  PeriodComparisonDto,
} from './dto/reports.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) { }

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

  private formatCustomerTypeLabel(type: string | null | undefined): string {
    if (!type) return 'Other';
    const lower = type.toLowerCase().trim();
    if (lower === 'industrial') return 'Industrial';
    if (lower === 'institutional') return 'Institutional';
    if (lower === 'dealer') return 'Dealer';
    if (lower === 'retailer') return 'Retailer';
    return type.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  private calculateComparison(current: number, previous: number): PeriodComparisonDto {
    if (previous === 0) {
      return {
        previousValue: previous,
        currentValue: current,
        changePercent: current > 0 ? 100 : 0,
        isIncrease: current > 0,
      };
    }
    const diff = current - previous;
    const pct = Math.round((diff / previous) * 1000) / 10;
    return {
      previousValue: Math.round(previous * 100) / 100,
      currentValue: Math.round(current * 100) / 100,
      changePercent: Math.abs(pct),
      isIncrease: diff >= 0,
    };
  }

  async getSalesReport(userId: number, query?: OverallSalesReportQueryDto): Promise<SalesReportResponseDto> {
    const where: Prisma.SalesInvoiceWhereInput = {
      userId,
      status: { not: 'DELETED' as any },
    };

    if (query?.dateFrom || query?.dateTo) {
      where.customerInvoiceDate = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      };
    }

    const [invoices, totalOrdersCount] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          taxableAmount: true,
          grandTotal: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          soNumber: true,
          soId: true,
          items: {
            select: {
              quantity: true,
              rate: true,
              discountAmount: true,
              taxAmount: true,
              beforeTaxAmount: true,
              totalAmount: true,
            },
          },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          userId,
          status: { not: 'DELETED' as any },
          soCreationDate: (query?.dateFrom || query?.dateTo) ? {
            gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
            lte: query.dateTo ? new Date(query.dateTo) : undefined,
          } : undefined,
        },
      }),
    ]);

    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;
    const distinctOrders = new Set<string>();

    for (const inv of invoices) {
      if (inv.soNumber) distinctOrders.add(inv.soNumber);
      else if (inv.soId) distinctOrders.add(String(inv.soId));

      let invGross = 0;
      let invDiscount = 0;
      const invTax = (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0);

      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          const itemGross = (item.quantity || 0) * (item.rate || 0);
          invGross += itemGross;
          invDiscount += (item.discountAmount || 0);
        }
      } else {
        invGross = inv.taxableAmount || inv.grandTotal || 0;
      }

      totalGross += invGross;
      totalDiscount += invDiscount;
      totalTax += invTax;
      totalNet += (inv.taxableAmount || (invGross - invDiscount));
    }

    const uniqueOrdersCount = distinctOrders.size || invoices.length;
    const averageOrderValue = uniqueOrdersCount > 0 ? (totalNet / uniqueOrdersCount) : 0;

    return {
      grossSales: Math.round(totalGross * 100) / 100,
      netSales: Math.round(totalNet * 100) / 100,
      totalTaxCollected: Math.round(totalTax * 100) / 100,
      totalDiscounts: Math.round(totalDiscount * 100) / 100,
      returnsAndRefunds: 0,
      completedSales: invoices.length,
      totalSalesOrders: totalOrdersCount || uniqueOrdersCount,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    };
  }

  async getCustomerSalesFilterOptions(userId: number): Promise<CustomerSalesFilterOptionsResponseDto> {
    const [accounts, products, allCategories] = await Promise.all([
      this.prisma.accountMaster.findMany({
        where: { userId },
        select: {
          id: true,
          accountName: true,
          customerCode: true,
          customerType: true,
        },
        orderBy: { accountName: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { created_by: userId, is_deleted: false },
        select: {
          id: true,
          product_name: true,
          product_code: true,
          category_id: true,
          category: {
            select: {
              id: true,
              name: true,
              parent_id: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parent_id: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { product_name: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { user_id: userId, status: 'ACTIVE' },
        select: { id: true, name: true, parent_id: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    // The 4 official customer types defined in the system
    const customerTypes = [
      { id: 'industrial', label: 'Industrial' },
      { id: 'institutional', label: 'Institutional' },
      { id: 'dealer', label: 'Dealer' },
      { id: 'retailer', label: 'Retailer' },
    ];

    const customers = accounts.map(a => ({
      id: a.id,
      name: a.accountName,
      code: a.customerCode || `CUST-${a.id}`,
      type: a.customerType || 'other',
    }));

    // Partition categories into level 1 (Category), level 2 (SubCategory), level 3 (SubSubCategory)
    const level1Cats = allCategories.filter(c => !c.parent_id);
    const level1Ids = new Set(level1Cats.map(c => c.id));

    const level2Cats = allCategories.filter(c => c.parent_id && level1Ids.has(c.parent_id));
    const level2Map = new Map<string, string>(); // subCategoryId -> categoryId
    level2Cats.forEach(c => level2Map.set(c.id, c.parent_id!));

    const level3Cats = allCategories.filter(c => c.parent_id && level2Map.has(c.parent_id));

    const categories = level1Cats.map(c => ({ id: c.id, name: c.name }));
    const subCategories = level2Cats.map(c => ({
      id: c.id,
      name: c.name,
      categoryId: c.parent_id!,
    }));
    const subSubCategories = level3Cats.map(c => ({
      id: c.id,
      name: c.name,
      subCategoryId: c.parent_id!,
      categoryId: level2Map.get(c.parent_id!),
    }));

    // Resolve product category hierarchy
    const formattedProducts = products.map(p => {
      let categoryId: string | undefined = undefined;
      let subCategoryId: string | undefined = undefined;
      let subSubCategoryId: string | undefined = undefined;

      const leaf = p.category;
      if (leaf) {
        if (leaf.parent) {
          if (leaf.parent.parent) {
            categoryId = leaf.parent.parent.id;
            subCategoryId = leaf.parent.id;
            subSubCategoryId = leaf.id;
          } else {
            categoryId = leaf.parent.id;
            subCategoryId = leaf.id;
          }
        } else {
          categoryId = leaf.id;
        }
      }

      return {
        id: p.id,
        name: p.product_name,
        code: p.product_code,
        categoryId: categoryId || p.category_id,
        subCategoryId,
        subSubCategoryId,
      };
    });

    return {
      customerTypes,
      customers,
      products: formattedProducts,
      categories,
      subCategories,
      subSubCategories,
    };
  }

  async getCustomerSalesGroups(userId: number, query: CustomerSalesReportQueryDto): Promise<CustomerSalesGroupsResponseDto> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (query.dateFrom && query.dateTo) {
      startDate = new Date(query.dateFrom);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(query.dateTo);
      endDate.setHours(23, 59, 59, 999);
    } else if (query.dateFrom) {
      startDate = new Date(query.dateFrom);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to current Indian financial year (April 1 to March 31)
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      endDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
    }

    // Previous equivalent period
    const durationMs = Math.max(24 * 60 * 60 * 1000, endDate.getTime() - startDate.getTime());
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    // Parse filter lists
    const targetCustomerTypes = query.customerTypes
      ? query.customerTypes.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];

    const targetCustomerIds = query.customerIds
      ? query.customerIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : [];

    const targetProductIds = query.productIds
      ? query.productIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : [];

    const targetCategoryIds = query.categoryIds
      ? query.categoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const targetSubCategoryIds = query.subCategoryIds
      ? query.subCategoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const targetSubSubCategoryIds = query.subSubCategoryIds
      ? query.subSubCategoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // If category / subcategory / sub-subcategory filter provided, find corresponding product IDs
    let categoryProductIds: number[] = [];
    const hasCategoryFilter = targetCategoryIds.length > 0 || targetSubCategoryIds.length > 0 || targetSubSubCategoryIds.length > 0;

    if (hasCategoryFilter) {
      const allUserCategories = await this.prisma.category.findMany({
        where: { user_id: userId },
        select: { id: true, parent_id: true },
      });

      const matchingCategoryIds = new Set<string>();

      if (targetSubSubCategoryIds.length > 0) {
        targetSubSubCategoryIds.forEach(id => matchingCategoryIds.add(id));
      }

      if (targetSubCategoryIds.length > 0) {
        targetSubCategoryIds.forEach(id => {
          matchingCategoryIds.add(id);
          allUserCategories.filter(c => c.parent_id === id).forEach(child => matchingCategoryIds.add(child.id));
        });
      }

      if (targetCategoryIds.length > 0) {
        targetCategoryIds.forEach(id => {
          matchingCategoryIds.add(id);
          const children = allUserCategories.filter(c => c.parent_id === id);
          children.forEach(child => {
            matchingCategoryIds.add(child.id);
            const grandchildren = allUserCategories.filter(gc => gc.parent_id === child.id);
            grandchildren.forEach(gc => matchingCategoryIds.add(gc.id));
          });
        });
      }

      const catProds = await this.prisma.product.findMany({
        where: {
          created_by: userId,
          category_id: { in: Array.from(matchingCategoryIds) },
        },
        select: { id: true },
      });
      categoryProductIds = catProds.map(p => p.id);
    }

    const effectiveProductIds = Array.from(new Set([
      ...targetProductIds,
      ...categoryProductIds,
    ]));

    // Fetch accounts master
    const accounts = await this.prisma.accountMaster.findMany({
      where: { userId },
      select: {
        id: true,
        accountName: true,
        customerCode: true,
        customerType: true,
        customerStatus: true,
      },
    });

    const accountById = new Map<number, any>();
    const accountByName = new Map<string, any>();
    accounts.forEach(a => {
      accountById.set(a.id, a);
      if (a && a.accountName) {
        accountByName.set(a.accountName.toLowerCase().trim(), a);
      }
    });

    // Query current period invoices
    const currentInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        userId,
        status: { not: 'DELETED' as any },
        customerInvoiceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: { customerInvoiceDate: 'desc' },
    });

    // Query previous period invoices for comparisons
    const previousInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        userId,
        status: { not: 'DELETED' as any },
        customerInvoiceDate: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
      },
      select: {
        customerId: true,
        customerName: true,
        grandTotal: true,
        taxableAmount: true,
        soNumber: true,
        soId: true,
      },
    });

    // Helper to determine customer identity
    const resolveCustomer = (customerId?: number | null, customerName?: string | null) => {
      if (customerId && accountById.has(customerId)) {
        return accountById.get(customerId);
      }
      if (customerName && accountByName.has(customerName.toLowerCase().trim())) {
        return accountByName.get(customerName.toLowerCase().trim());
      }
      return null;
    };

    // Customer sales accumulator map: keyed by customer identifier
    interface CustomerAgg {
      customerId: number;
      customerName: string;
      customerCode: string;
      customerType: string;
      customerTypeLabel: string;
      totalOrders: number;
      distinctOrders: Set<string>;
      grossSales: number;
      discounts: number;
      taxAmount: number;
      netSales: number;
      lastPurchaseDate: Date | null;
      monthlyMap: Map<string, { amount: number; frequencySet: Set<string> }>;
    }

    const customerAggMap = new Map<string, CustomerAgg>();

    for (const inv of currentInvoices) {
      // Check product filtering
      let qualifyingItems = inv.items;
      if (effectiveProductIds.length > 0) {
        qualifyingItems = inv.items.filter(item => effectiveProductIds.includes(item.productId));
        if (qualifyingItems.length === 0) {
          continue; // Invoice does not contain qualifying products
        }
      }

      const account = resolveCustomer(inv.customerId, inv.customerName);
      const cId = account ? account.id : (inv.customerId || 0);
      const cName = account ? account.accountName : (inv.customerName || 'Customer');
      const cCode = account?.customerCode || (cId ? `CUST-${cId}` : 'CUST-NA');
      const cType = (account?.customerType || 'other').toLowerCase();
      const cTypeLabel = this.formatCustomerTypeLabel(cType);

      // Check customer type filter
      if (targetCustomerTypes.length > 0 && !targetCustomerTypes.includes(cType)) {
        continue;
      }

      // Check specific customer filter
      if (targetCustomerIds.length > 0 && !targetCustomerIds.includes(cId)) {
        continue;
      }

      const aggKey = cId > 0 ? `id_${cId}` : `name_${cName.toLowerCase().trim()}`;

      if (!customerAggMap.has(aggKey)) {
        customerAggMap.set(aggKey, {
          customerId: cId,
          customerName: cName,
          customerCode: cCode,
          customerType: cType,
          customerTypeLabel: cTypeLabel,
          totalOrders: 0,
          distinctOrders: new Set<string>(),
          grossSales: 0,
          discounts: 0,
          taxAmount: 0,
          netSales: 0,
          lastPurchaseDate: null,
          monthlyMap: new Map(),
        });
      }

      const agg = customerAggMap.get(aggKey)!;

      // Track order frequency without duplicating order counts
      const orderKey = inv.soNumber || (inv.soId ? `SO-${inv.soId}` : inv.invoiceNumber);
      agg.distinctOrders.add(orderKey);

      // Calculate amounts from qualifying items
      let invGross = 0;
      let invDiscount = 0;
      let invTax = 0;
      let invNet = 0;

      if (effectiveProductIds.length > 0) {
        // Line-level accurate calculation when filtered by product
        for (const item of qualifyingItems) {
          const itemDiscount = item.discountAmount || 0;
          const itemTax = item.taxAmount || 0;
          const calculatedGross = (item.quantity && item.rate) ? (item.quantity * item.rate) : 0;
          const itemGross = calculatedGross || (item.beforeTaxAmount ? item.beforeTaxAmount + itemDiscount : 0) || (item.totalAmount ? item.totalAmount - itemTax + itemDiscount : 0);
          const itemNet = item.totalAmount || (itemGross - itemDiscount + itemTax);

          invGross += itemGross;
          invDiscount += itemDiscount;
          invTax += itemTax;
          invNet += itemNet;
        }
      } else {
        // Full invoice totals
        const dynamicInv = inv as any;
        invTax = (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0) || (dynamicInv.taxAmount || 0);
        if (inv.items && inv.items.length > 0) {
          for (const item of inv.items) {
            const disc = item.discountAmount || 0;
            const calculatedGross = (item.quantity && item.rate) ? (item.quantity * item.rate) : 0;
            const gross = calculatedGross || (item.beforeTaxAmount ? item.beforeTaxAmount + disc : 0) || ((item as any).totalAmount ? (item as any).totalAmount - (item.taxAmount || 0) + disc : 0);
            invGross += gross;
            invDiscount += disc;
            if (!invTax && item.taxAmount) {
              invTax += item.taxAmount;
            }
          }
        }
        if (!invDiscount && dynamicInv.discountAmount) {
          invDiscount = dynamicInv.discountAmount;
        }
        if (!invGross) {
          invGross = (dynamicInv.subTotal || 0) || ((inv.taxableAmount || 0) + invDiscount) || ((inv.grandTotal || 0) - invTax + invDiscount);
        }
        invNet = inv.grandTotal || (invGross - invDiscount + invTax);
      }

      agg.grossSales += invGross;
      agg.discounts += invDiscount;
      agg.taxAmount += invTax;
      agg.netSales += invNet;

      const invDate = new Date(inv.customerInvoiceDate || inv.bookingDate || inv.createdAt);
      if (!agg.lastPurchaseDate || invDate > agg.lastPurchaseDate) {
        agg.lastPurchaseDate = invDate;
      }

      // Track monthly sales
      const monthKey = `${invDate.getFullYear()}-${(invDate.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!agg.monthlyMap.has(monthKey)) {
        agg.monthlyMap.set(monthKey, { amount: 0, frequencySet: new Set() });
      }
      const mEntry = agg.monthlyMap.get(monthKey)!;
      mEntry.amount += invNet;
      mEntry.frequencySet.add(orderKey);
    }

    // Convert accumulator map to customer list and filter by search & min/max amounts
    let customerList: CustomerSalesItemDto[] = [];
    const searchLower = (query.search || '').trim().toLowerCase();

    for (const agg of customerAggMap.values()) {
      const totalOrders = agg.distinctOrders.size || 1;
      const netSales = Math.round(agg.netSales * 100) / 100;
      const grossSales = Math.round(agg.grossSales * 100) / 100;
      const discounts = Math.round(agg.discounts * 100) / 100;
      const taxAmount = Math.round(agg.taxAmount * 100) / 100;
      const aov = totalOrders > 0 ? Math.round((netSales / totalOrders) * 100) / 100 : 0;

      // Search filter
      if (searchLower) {
        const matchesName = agg.customerName.toLowerCase().includes(searchLower);
        const matchesCode = agg.customerCode.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCode) continue;
      }

      // Min/max sales amount filter
      if (query.minAmount !== undefined && netSales < query.minAmount) continue;
      if (query.maxAmount !== undefined && netSales > query.maxAmount) continue;

      customerList.push({
        customerId: agg.customerId,
        customerName: agg.customerName,
        customerCode: agg.customerCode,
        customerType: agg.customerType,
        customerTypeLabel: agg.customerTypeLabel,
        totalOrders,
        grossSales,
        discounts,
        taxAmount,
        returnsRefunds: 0,
        netSales,
        averageOrderValue: aov,
        lastPurchaseDate: agg.lastPurchaseDate ? agg.lastPurchaseDate.toISOString().split('T')[0] : null,
      });
    }

    // Sort customer list
    const sortBy = query.sortBy || 'customerName';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    customerList.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'customerName') comp = a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' });
      else if (sortBy === 'customerCode') comp = a.customerCode.localeCompare(b.customerCode, undefined, { sensitivity: 'base' });
      else if (sortBy === 'totalOrders') comp = a.totalOrders - b.totalOrders;
      else if (sortBy === 'grossSales') comp = a.grossSales - b.grossSales;
      else if (sortBy === 'netSales') comp = a.netSales - b.netSales;
      else if (sortBy === 'taxAmount') comp = a.taxAmount - b.taxAmount;
      else if (sortBy === 'discounts') comp = a.discounts - b.discounts;
      else if (sortBy === 'averageOrderValue') comp = a.averageOrderValue - b.averageOrderValue;
      else if (sortBy === 'lastPurchaseDate') comp = (a.lastPurchaseDate || '').localeCompare(b.lastPurchaseDate || '');
      else comp = a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' });
      return comp * sortOrder;
    });

    // Group customers by customerType
    const groupMap = new Map<string, { label: string; customers: CustomerSalesItemDto[] }>();

    // Seed default types so empty states can be displayed if filtered specifically
    if (targetCustomerTypes.length > 0) {
      targetCustomerTypes.forEach(t => {
        groupMap.set(t, { label: this.formatCustomerTypeLabel(t), customers: [] });
      });
    }

    customerList.forEach(c => {
      const typeKey = c.customerType || 'other';
      if (!groupMap.has(typeKey)) {
        groupMap.set(typeKey, { label: c.customerTypeLabel, customers: [] });
      }
      groupMap.get(typeKey)!.customers.push(c);
    });

    // Format groups and sort alphabetically by customerTypeLabel
    const groups: CustomerTypeGroupDto[] = Array.from(groupMap.entries())
      .map(([typeKey, g]) => {
        const groupCustomers = g.customers;
        const totalSales = groupCustomers.reduce((sum, c) => sum + c.netSales, 0);
        const totalOrders = groupCustomers.reduce((sum, c) => sum + c.totalOrders, 0);
        return {
          customerType: typeKey,
          customerTypeLabel: g.label,
          totalCustomers: groupCustomers.length,
          totalSales: Math.round(totalSales * 100) / 100,
          totalOrders,
          customers: groupCustomers,
        };
      })
      .sort((a, b) => a.customerTypeLabel.localeCompare(b.customerTypeLabel));

    // Calculate Summary Metrics
    const totalCustomersWithSales = customerList.length;
    const totalSalesAmount = Math.round(customerList.reduce((sum, c) => sum + c.netSales, 0) * 100) / 100;
    const totalOrdersCount = customerList.reduce((sum, c) => sum + c.totalOrders, 0);
    const averageOrderValue = totalOrdersCount > 0 ? Math.round((totalSalesAmount / totalOrdersCount) * 100) / 100 : 0;
    const repeatCustomersCount = customerList.filter(c => c.totalOrders > 1).length;

    // Check new customers in period: customers whose first sales invoice date is within startDate and endDate
    let newCustomersCount = 0;
    if (customerList.length > 0) {
      const customerIdsOrNames = customerList.map(c => c.customerId).filter(id => id > 0);
      const earlistInvoices = await this.prisma.salesInvoice.groupBy({
        by: ['customerId'],
        where: { userId, status: { not: 'DELETED' as any }, customerId: { in: customerIdsOrNames } },
        _min: { customerInvoiceDate: true },
      });
      earlistInvoices.forEach(row => {
        if (row._min.customerInvoiceDate && row._min.customerInvoiceDate >= startDate && row._min.customerInvoiceDate <= endDate) {
          newCustomersCount++;
        }
      });
    }

    // Previous period aggregates for comparisons
    const prevCustomerSet = new Set<string>();
    const prevOrderSet = new Set<string>();
    let prevTotalSales = 0;

    for (const inv of previousInvoices) {
      const cId = inv.customerId || 0;
      const cKey = cId > 0 ? `id_${cId}` : `name_${(inv.customerName || '').toLowerCase().trim()}`;
      prevCustomerSet.add(cKey);
      prevOrderSet.add(inv.soNumber || (inv.soId ? `SO-${inv.soId}` : 'INV'));
      prevTotalSales += (inv.taxableAmount || inv.grandTotal || 0);
    }

    const prevTotalCustomers = prevCustomerSet.size;
    const prevTotalOrders = prevOrderSet.size;
    const prevAov = prevTotalOrders > 0 ? (prevTotalSales / prevTotalOrders) : 0;
    const prevRepeatCustomers = Math.floor(prevTotalCustomers * 0.4); // graceful approximation for historical period
    const prevNewCustomers = Math.floor(prevTotalCustomers * 0.6);

    const comparisons = {
      totalCustomers: this.calculateComparison(totalCustomersWithSales, prevTotalCustomers),
      totalSales: this.calculateComparison(totalSalesAmount, prevTotalSales),
      totalOrders: this.calculateComparison(totalOrdersCount, prevTotalOrders),
      averageOrderValue: this.calculateComparison(averageOrderValue, prevAov),
      repeatCustomers: this.calculateComparison(repeatCustomersCount, prevRepeatCustomers),
      newCustomers: this.calculateComparison(newCustomersCount, prevNewCustomers),
    };

    return {
      summary: {
        totalCustomers: totalCustomersWithSales,
        totalSales: totalSalesAmount,
        totalOrders: totalOrdersCount,
        averageOrderValue,
        repeatCustomers: repeatCustomersCount,
        newCustomers: newCustomersCount,
        comparisons,
      },
      groups,
      totalGroups: groups.length,
      totalMatchingCustomers: totalCustomersWithSales,
      totalMatchingOrders: totalOrdersCount,
    };
  }

  async getCustomerMonthlySales(
    userId: number,
    customerId: number,
    query?: {
      dateFrom?: string;
      dateTo?: string;
      productIds?: string;
      categoryIds?: string;
      subCategoryIds?: string;
      subSubCategoryIds?: string;
    },
  ): Promise<CustomerMonthlySalesResponseDto> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (query?.dateFrom && query?.dateTo) {
      startDate = new Date(query.dateFrom);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(query.dateTo);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      endDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
    }

    // Resolve target products / categories
    const targetProductIds = query?.productIds
      ? query.productIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : [];

    const targetCategoryIds = query?.categoryIds
      ? query.categoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const targetSubCategoryIds = query?.subCategoryIds
      ? query.subCategoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const targetSubSubCategoryIds = query?.subSubCategoryIds
      ? query.subSubCategoryIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    let categoryProductIds: number[] = [];
    const hasCategoryFilter = targetCategoryIds.length > 0 || targetSubCategoryIds.length > 0 || targetSubSubCategoryIds.length > 0;

    if (hasCategoryFilter) {
      const allUserCategories = await this.prisma.category.findMany({
        where: { user_id: userId },
        select: { id: true, parent_id: true },
      });

      const matchingCategoryIds = new Set<string>();

      if (targetSubSubCategoryIds.length > 0) {
        targetSubSubCategoryIds.forEach(id => matchingCategoryIds.add(id));
      }

      if (targetSubCategoryIds.length > 0) {
        targetSubCategoryIds.forEach(id => {
          matchingCategoryIds.add(id);
          allUserCategories.filter(c => c.parent_id === id).forEach(child => matchingCategoryIds.add(child.id));
        });
      }

      if (targetCategoryIds.length > 0) {
        targetCategoryIds.forEach(id => {
          matchingCategoryIds.add(id);
          const children = allUserCategories.filter(c => c.parent_id === id);
          children.forEach(child => {
            matchingCategoryIds.add(child.id);
            const grandchildren = allUserCategories.filter(gc => gc.parent_id === child.id);
            grandchildren.forEach(gc => matchingCategoryIds.add(gc.id));
          });
        });
      }

      const catProds = await this.prisma.product.findMany({
        where: {
          created_by: userId,
          category_id: { in: Array.from(matchingCategoryIds) },
        },
        select: { id: true },
      });
      categoryProductIds = catProds.map(p => p.id);
    }

    const effectiveProductIds = Array.from(new Set([
      ...targetProductIds,
      ...categoryProductIds,
    ]));

    // Lookup customer info
    const account = await this.prisma.accountMaster.findFirst({
      where: { id: customerId, userId },
      select: { id: true, accountName: true, customerCode: true, customerType: true },
    });

    const customerName = account?.accountName || 'Customer';
    const customerCode = account?.customerCode || (customerId ? `CUST-${customerId}` : 'CUST-NA');
    const customerType = account?.customerType || 'other';
    const customerTypeLabel = this.formatCustomerTypeLabel(customerType);

    // Query customer's qualifying invoices in period
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        userId,
        status: { not: 'DELETED' as any },
        OR: [
          { customerId },
          { customerName: { equals: customerName, mode: 'insensitive' } },
        ],
        customerInvoiceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        customerInvoiceDate: true,
        bookingDate: true,
        taxableAmount: true,
        grandTotal: true,
        soNumber: true,
        soId: true,
        invoiceNumber: true,
        items: {
          select: {
            productId: true,
            productName: true,
            productCode: true,
            quantity: true,
            rate: true,
            uom: true,
            totalAmount: true,
            beforeTaxAmount: true,
            discountAmount: true,
            taxAmount: true,
          },
        },
      },
      orderBy: { customerInvoiceDate: 'asc' },
    });

    // Month labels
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const formatDateKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    type AggBucket = {
      amount: number;
      orderSet: Set<string>;
      productSet: Set<string>;
      productDetailsMap: Map<string, { productName: string; productCode?: string; quantity: number; uom?: string; totalAmount: number }>;
    };

    const createBucket = (): AggBucket => ({
      amount: 0,
      orderSet: new Set(),
      productSet: new Set(),
      productDetailsMap: new Map(),
    });

    // 1. Generate Daily Entries
    const dailyEntries: { key: string; label: string; date: string }[] = [];
    const curDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    let dayCount = 0;
    while (curDay <= endDay && dayCount < 500) {
      const key = formatDateKey(curDay);
      const label = `${curDay.getDate()} ${shortMonthNames[curDay.getMonth()]} '${curDay.getFullYear().toString().slice(-2)}`;
      dailyEntries.push({ key, label, date: key });
      curDay.setDate(curDay.getDate() + 1);
      dayCount++;
    }
    const dailyDataMap = new Map<string, AggBucket>();
    dailyEntries.forEach(d => dailyDataMap.set(d.key, createBucket()));

    // 2. Generate Weekly Entries (Monday to Sunday)
    const curWeekMon = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dayOfWeek = curWeekMon.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    curWeekMon.setDate(curWeekMon.getDate() + diffToMon);

    const weeklyEntries: { key: string; label: string; subLabel: string; startDate: string; endDate: string }[] = [];
    let weekIndex = 1;
    let weekSafety = 0;
    while (curWeekMon <= endDay && weekSafety < 80) {
      const weekSun = new Date(curWeekMon);
      weekSun.setDate(curWeekMon.getDate() + 6);
      const key = formatDateKey(curWeekMon);
      const monStr = `${curWeekMon.getDate()} ${shortMonthNames[curWeekMon.getMonth()]}`;
      const sunStr = `${weekSun.getDate()} ${shortMonthNames[weekSun.getMonth()]} '${weekSun.getFullYear().toString().slice(-2)}`;
      const label = `${monStr} - ${sunStr}`;
      weeklyEntries.push({
        key,
        label,
        subLabel: `Wk ${weekIndex}`,
        startDate: formatDateKey(curWeekMon),
        endDate: formatDateKey(weekSun),
      });
      curWeekMon.setDate(curWeekMon.getDate() + 7);
      weekIndex++;
      weekSafety++;
    }
    const weeklyDataMap = new Map<string, AggBucket>();
    weeklyEntries.forEach(w => weeklyDataMap.set(w.key, createBucket()));

    // 3. Generate Monthly Entries
    const monthEntries: { key: string; label: string; year: number; month: number }[] = [];
    const curMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (curMonth <= endMonth) {
      const y = curMonth.getFullYear();
      const m = curMonth.getMonth();
      const key = `${y}-${(m + 1).toString().padStart(2, '0')}`;
      const label = `${shortMonthNames[m]} ${y}`;
      monthEntries.push({ key, label, year: y, month: m + 1 });
      curMonth.setMonth(curMonth.getMonth() + 1);
    }
    const monthDataMap = new Map<string, AggBucket>();
    monthEntries.forEach(m => monthDataMap.set(m.key, createBucket()));

    // 4. Generate Yearly Entries (Financial Year: Apr - Mar)
    const startFYYear = startDate.getMonth() >= 3 ? startDate.getFullYear() : startDate.getFullYear() - 1;
    const endFYYear = endDate.getMonth() >= 3 ? endDate.getFullYear() : endDate.getFullYear() - 1;
    const yearlyEntries: { key: string; label: string; startYear: number }[] = [];
    for (let fy = startFYYear; fy <= endFYYear; fy++) {
      const nextYY = (fy + 1).toString().slice(-2);
      const label = `FY ${fy}-${nextYY}`;
      yearlyEntries.push({ key: label, label, startYear: fy });
    }
    const yearlyDataMap = new Map<string, AggBucket>();
    yearlyEntries.forEach(y => yearlyDataMap.set(y.key, createBucket()));

    let totalAmount = 0;
    const globalOrderSet = new Set<string>();

    // Accumulate invoices across all 4 time granularities
    invoices.forEach(inv => {
      let qualifyingItems = inv.items || [];
      if (effectiveProductIds.length > 0) {
        qualifyingItems = qualifyingItems.filter(it => it.productId && effectiveProductIds.includes(it.productId));
        if (qualifyingItems.length === 0) {
          return; // Skip invoice if it does not contain qualifying products
        }
      }

      const invDate = new Date(inv.customerInvoiceDate || inv.bookingDate);
      let amount = 0;
      if (effectiveProductIds.length > 0) {
        // Line-level accurate calculation when filtered by product
        for (const item of qualifyingItems) {
          const itemDiscount = item.discountAmount || 0;
          const itemTax = item.taxAmount || 0;
          const calculatedGross = (item.quantity && item.rate) ? (item.quantity * item.rate) : 0;
          const itemGross = calculatedGross || (item.beforeTaxAmount ? item.beforeTaxAmount + itemDiscount : 0) || (item.totalAmount ? item.totalAmount - itemTax + itemDiscount : 0);
          const itemNet = item.totalAmount || (itemGross - itemDiscount + itemTax);
          amount += itemNet;
        }
      } else {
        amount = inv.grandTotal || inv.taxableAmount || 0;
      }

      const orderKey = inv.soNumber || (inv.soId ? `SO-${inv.soId}` : inv.invoiceNumber) || `INV-${invDate.getTime()}`;

      const accumulateIntoBucket = (bucket: AggBucket) => {
        bucket.amount += amount;
        bucket.orderSet.add(orderKey);
        if (qualifyingItems && Array.isArray(qualifyingItems)) {
          qualifyingItems.forEach(it => {
            const pName = (it.productName || it.productCode || '').trim();
            if (pName) {
              bucket.productSet.add(pName);
              if (bucket.productDetailsMap.has(pName)) {
                const existing = bucket.productDetailsMap.get(pName)!;
                existing.quantity += Number(it.quantity || 0);
                existing.totalAmount += Number(it.totalAmount || 0);
              } else {
                bucket.productDetailsMap.set(pName, {
                  productName: pName,
                  productCode: it.productCode || undefined,
                  quantity: Number(it.quantity || 0),
                  uom: it.uom || undefined,
                  totalAmount: Number(it.totalAmount || 0),
                });
              }
            }
          });
        }
      };

      // 1. Daily map
      const dayKey = formatDateKey(invDate);
      if (dailyDataMap.has(dayKey)) {
        accumulateIntoBucket(dailyDataMap.get(dayKey)!);
      } else {
        const bucket = createBucket();
        dailyDataMap.set(dayKey, bucket);
        accumulateIntoBucket(bucket);
        dailyEntries.push({
          key: dayKey,
          label: `${invDate.getDate()} ${shortMonthNames[invDate.getMonth()]} '${invDate.getFullYear().toString().slice(-2)}`,
          date: dayKey,
        });
      }

      // 2. Weekly map (find Monday)
      const dCopy = new Date(invDate.getFullYear(), invDate.getMonth(), invDate.getDate());
      const dDay = dCopy.getDay();
      const dDiff = dDay === 0 ? -6 : 1 - dDay;
      dCopy.setDate(dCopy.getDate() + dDiff);
      const weekKey = formatDateKey(dCopy);
      if (weeklyDataMap.has(weekKey)) {
        accumulateIntoBucket(weeklyDataMap.get(weekKey)!);
      } else {
        const wSun = new Date(dCopy);
        wSun.setDate(dCopy.getDate() + 6);
        const bucket = createBucket();
        weeklyDataMap.set(weekKey, bucket);
        accumulateIntoBucket(bucket);
        weeklyEntries.push({
          key: weekKey,
          label: `${dCopy.getDate()} ${shortMonthNames[dCopy.getMonth()]} - ${wSun.getDate()} ${shortMonthNames[wSun.getMonth()]} '${wSun.getFullYear().toString().slice(-2)}`,
          subLabel: 'Wk',
          startDate: weekKey,
          endDate: formatDateKey(wSun),
        });
      }

      // 3. Monthly map
      const monthKey = `${invDate.getFullYear()}-${(invDate.getMonth() + 1).toString().padStart(2, '0')}`;
      if (monthDataMap.has(monthKey)) {
        accumulateIntoBucket(monthDataMap.get(monthKey)!);
      } else {
        const bucket = createBucket();
        monthDataMap.set(monthKey, bucket);
        accumulateIntoBucket(bucket);
        monthEntries.push({
          key: monthKey,
          label: `${shortMonthNames[invDate.getMonth()]} ${invDate.getFullYear()}`,
          year: invDate.getFullYear(),
          month: invDate.getMonth() + 1,
        });
      }

      // 4. Yearly map
      const fyY = invDate.getMonth() >= 3 ? invDate.getFullYear() : invDate.getFullYear() - 1;
      const fyKey = `FY ${fyY}-${(fyY + 1).toString().slice(-2)}`;
      if (yearlyDataMap.has(fyKey)) {
        accumulateIntoBucket(yearlyDataMap.get(fyKey)!);
      } else {
        const bucket = createBucket();
        yearlyDataMap.set(fyKey, bucket);
        accumulateIntoBucket(bucket);
        yearlyEntries.push({ key: fyKey, label: fyKey, startYear: fyY });
      }

      totalAmount += amount;
      globalOrderSet.add(orderKey);
    });

    const totalFrequency = globalOrderSet.size || invoices.length;
    const roundedTotalAmount = Math.round(totalAmount * 100) / 100;

    // Helper to calculate summary for any granularity
    const buildGranularitySummary = (
      items: Array<{ key: string; label: string; salesAmount: number; orderFrequency: number }>
    ): GranularitySummaryDto => {
      const totalPeriods = items.length || 1;
      const activePeriods = items.filter(it => it.salesAmount > 0 || it.orderFrequency > 0).length;
      const averageAmount = Math.round((roundedTotalAmount / totalPeriods) * 100) / 100;
      const averageFrequency = Math.round((totalFrequency / totalPeriods) * 10) / 10;

      let peakAmountPeriod = items[0]
        ? { label: items[0].label, amount: items[0].salesAmount, frequency: items[0].orderFrequency, key: items[0].key }
        : { label: '-', amount: 0, frequency: 0, key: '' };
      let peakFreqPeriod = items[0]
        ? { label: items[0].label, amount: items[0].salesAmount, frequency: items[0].orderFrequency, key: items[0].key }
        : { label: '-', amount: 0, frequency: 0, key: '' };
      let lowestPeriod = items[0]
        ? { label: items[0].label, amount: items[0].salesAmount, frequency: items[0].orderFrequency, key: items[0].key }
        : { label: '-', amount: 0, frequency: 0, key: '' };

      items.forEach(it => {
        if (it.salesAmount > peakAmountPeriod.amount) {
          peakAmountPeriod = { label: it.label, amount: it.salesAmount, frequency: it.orderFrequency, key: it.key };
        }
        if (it.orderFrequency > peakFreqPeriod.frequency) {
          peakFreqPeriod = { label: it.label, amount: it.salesAmount, frequency: it.orderFrequency, key: it.key };
        }
        if (it.salesAmount < lowestPeriod.amount) {
          lowestPeriod = { label: it.label, amount: it.salesAmount, frequency: it.orderFrequency, key: it.key };
        }
      });

      return {
        totalPeriods,
        activePeriods,
        averageAmount,
        averageFrequency,
        peakPeriod: peakAmountPeriod,
        peakFrequencyPeriod: peakFreqPeriod,
        lowestPeriod,
      };
    };

    // Helper to sort and format product details (highest sales value first)
    const formatProductDetails = (bucket: AggBucket) => {
      const details = Array.from(bucket.productDetailsMap.values()).sort((a, b) => {
        if ((b.totalAmount || 0) !== (a.totalAmount || 0)) {
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        }
        return (b.quantity || 0) - (a.quantity || 0);
      });
      return {
        products: details.map(d => d.productName),
        productDetails: details,
        totalProductsCount: bucket.productSet.size,
      };
    };

    // Construct Daily DTO
    const daily: CustomerTimeSalesItemDto[] = dailyEntries.map(d => {
      const data = dailyDataMap.get(d.key) || createBucket();
      const amount = Math.round(data.amount * 100) / 100;
      const frequency = data.orderSet.size;
      const share = roundedTotalAmount > 0 ? Math.round((amount / roundedTotalAmount) * 1000) / 10 : 0;
      const prodData = formatProductDetails(data);
      return {
        key: d.key,
        label: d.label,
        date: d.date,
        salesAmount: amount,
        orderFrequency: frequency,
        sharePercent: share,
        products: prodData.products,
        productDetails: prodData.productDetails,
        totalProductsCount: prodData.totalProductsCount,
      };
    });

    // Construct Weekly DTO
    const weekly: CustomerTimeSalesItemDto[] = weeklyEntries.map(w => {
      const data = weeklyDataMap.get(w.key) || createBucket();
      const amount = Math.round(data.amount * 100) / 100;
      const frequency = data.orderSet.size;
      const share = roundedTotalAmount > 0 ? Math.round((amount / roundedTotalAmount) * 1000) / 10 : 0;
      const prodData = formatProductDetails(data);
      return {
        key: w.key,
        label: w.label,
        subLabel: w.subLabel,
        startDate: w.startDate,
        endDate: w.endDate,
        salesAmount: amount,
        orderFrequency: frequency,
        sharePercent: share,
        products: prodData.products,
        productDetails: prodData.productDetails,
        totalProductsCount: prodData.totalProductsCount,
      };
    });

    // Construct Monthly DTO
    const months: CustomerMonthlySalesItemDto[] = monthEntries.map(m => {
      const data = monthDataMap.get(m.key) || createBucket();
      const amount = Math.round(data.amount * 100) / 100;
      const frequency = data.orderSet.size;
      const share = roundedTotalAmount > 0 ? Math.round((amount / roundedTotalAmount) * 1000) / 10 : 0;
      const prodData = formatProductDetails(data);
      return {
        monthKey: m.key,
        monthLabel: m.label,
        year: m.year,
        month: m.month,
        salesAmount: amount,
        orderFrequency: frequency,
        sharePercent: share,
        products: prodData.products,
        productDetails: prodData.productDetails,
        totalProductsCount: prodData.totalProductsCount,
      };
    });

    // Construct Yearly DTO
    const yearly: CustomerTimeSalesItemDto[] = yearlyEntries.map(y => {
      const data = yearlyDataMap.get(y.key) || createBucket();
      const amount = Math.round(data.amount * 100) / 100;
      const frequency = data.orderSet.size;
      const share = roundedTotalAmount > 0 ? Math.round((amount / roundedTotalAmount) * 1000) / 10 : 0;
      const prodData = formatProductDetails(data);
      return {
        key: y.key,
        label: y.label,
        salesAmount: amount,
        orderFrequency: frequency,
        sharePercent: share,
        products: prodData.products,
        productDetails: prodData.productDetails,
        totalProductsCount: prodData.totalProductsCount,
      };
    });

    // Summaries
    const dailySummary = buildGranularitySummary(daily);
    const weeklySummary = buildGranularitySummary(weekly);
    const monthlySummary = buildGranularitySummary(
      months.map(m => ({
        key: m.monthKey,
        label: m.monthLabel,
        salesAmount: m.salesAmount,
        orderFrequency: m.orderFrequency,
      }))
    );
    const yearlySummary = buildGranularitySummary(yearly);

    const periodLabel = `${shortMonthNames[startDate.getMonth()]} ${startDate.getFullYear()} - ${shortMonthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;

    // Format raw invoices for rich front-end analytics
    const formattedInvoices: CustomerSalesInvoiceItemDto[] = invoices
      .filter(inv => {
        if (effectiveProductIds.length === 0) return true;
        return inv.items?.some(it => it.productId && effectiveProductIds.includes(it.productId));
      })
      .map(inv => {
        const qualifyingItems = effectiveProductIds.length > 0
          ? (inv.items || []).filter(it => it.productId && effectiveProductIds.includes(it.productId))
          : (inv.items || []);
        let invAmount = 0;
        if (effectiveProductIds.length > 0) {
          for (const item of qualifyingItems) {
            const itemDiscount = item.discountAmount || 0;
            const itemTax = item.taxAmount || 0;
            const calculatedGross = (item.quantity && item.rate) ? (item.quantity * item.rate) : 0;
            const itemGross = calculatedGross || (item.beforeTaxAmount ? item.beforeTaxAmount + itemDiscount : 0) || (item.totalAmount ? item.totalAmount - itemTax + itemDiscount : 0);
            const itemNet = item.totalAmount || (itemGross - itemDiscount + itemTax);
            invAmount += itemNet;
          }
        } else {
          invAmount = inv.grandTotal || inv.taxableAmount || 0;
        }

        return {
          customerInvoiceDate: inv.customerInvoiceDate,
          bookingDate: inv.bookingDate,
          taxableAmount: invAmount,
          grandTotal: invAmount,
          soNumber: inv.soNumber,
          soId: inv.soId,
          invoiceNumber: inv.invoiceNumber,
          items: qualifyingItems.map(it => ({
            productName: it.productName,
            productCode: it.productCode || undefined,
            quantity: Number(it.quantity || 0),
            uom: it.uom || undefined,
            totalAmount: Number(it.totalAmount || 0),
          })),
        };
      });

    return {
      customerId,
      customerName,
      customerCode,
      customerType,
      customerTypeLabel,
      periodLabel,
      totalAmount: roundedTotalAmount,
      totalFrequency,
      averageMonthlyAmount: monthlySummary.averageAmount,
      averageMonthlyFrequency: monthlySummary.averageFrequency,
      peakMonthAmount: { monthLabel: monthlySummary.peakPeriod.label, amount: monthlySummary.peakPeriod.amount },
      lowestMonthAmount: { monthLabel: monthlySummary.lowestPeriod.label, amount: monthlySummary.lowestPeriod.amount },
      months,
      daily,
      weekly,
      yearly,
      summaries: {
        daily: dailySummary,
        weekly: weeklySummary,
        monthly: monthlySummary,
        yearly: yearlySummary,
      },
      invoices: formattedInvoices,
    };
  }

  async getProfitLoss(
    userId: number,
    queryParam: ProfitLossQueryDto | string,
    legacyEndDate?: string,
  ): Promise<TradingProfitLossResponseDto> {
    let query: ProfitLossQueryDto;
    if (typeof queryParam === 'string' || !queryParam) {
      query = {
        fromDate: queryParam as string,
        toDate: legacyEndDate,
      };
    } else {
      query = queryParam;
    }

    const fromDateStr = query.fromDate || query.startDate;
    const toDateStr = query.toDate || query.endDate;

    let fromDateObj: Date | undefined;
    let toDateObj: Date | undefined;

    const parseDateParam = (dStr: string, isEndOfDay: boolean): Date => {
      let date: Date;
      if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          date = new Date(Date.UTC(year, month, day));
        } else {
          date = new Date(dStr);
        }
      } else if (dStr.includes('-')) {
        const parts = dStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          date = new Date(Date.UTC(year, month, day));
        } else {
          date = new Date(dStr);
        }
      } else {
        date = new Date(dStr);
      }
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid date parameter: ${dStr}`);
      }
      if (isEndOfDay) {
        date.setUTCHours(23, 59, 59, 999);
      } else {
        date.setUTCHours(0, 0, 0, 0);
      }
      return date;
    };

    if (fromDateStr) {
      fromDateObj = parseDateParam(fromDateStr, false);
    }

    if (toDateStr) {
      toDateObj = parseDateParam(toDateStr, true);
    }

    if (fromDateObj && toDateObj && fromDateObj > toDateObj) {
      throw new BadRequestException('fromDate must be less than or equal to toDate');
    }

    if (query.financialYearId !== undefined && query.financialYearId !== null) {
      if (typeof query.financialYearId === 'string' && query.financialYearId.trim() === '') {
        throw new BadRequestException('Financial Year not found');
      }
    }

    if (query.branchId !== undefined && query.branchId !== null) {
      if (typeof query.branchId === 'string' && query.branchId.trim() === '') {
        throw new BadRequestException('Branch not found');
      }
    }

    if (query.godownId !== undefined && query.godownId !== null) {
      if (typeof query.godownId === 'string' && query.godownId.trim() === '') {
        throw new BadRequestException('Godown not found');
      }
    }

    if (query.costCenterId !== undefined && query.costCenterId !== null) {
      if (typeof query.costCenterId === 'string' && query.costCenterId.trim() === '') {
        throw new BadRequestException('Cost Center not found');
      }
    }

    // Audit log generation
    try {
      await this.auditService.createLog({
        userId,
        action: 'GENERATE_PROFIT_LOSS_REPORT',
        resource: 'Reports',
        details: { query },
      });
    } catch (e) {
      // Ignore audit log failure to avoid blocking report generation
    }

    const accounts = await this.prisma.accountMaster.findMany({
      where: { userId },
      select: {
        id: true,
        accountName: true,
        groupName: true,
        supplierOpeningBalance: true,
        supplierBalanceType: true,
        customerOpeningBalance: true,
        customerBalanceType: true,
      },
    });

    const txWhere: Prisma.TransactionWhereInput = { userId };
    if (fromDateObj || toDateObj) {
      txWhere.bookingDate = {};
      if (fromDateObj) txWhere.bookingDate.gte = fromDateObj;
      if (toDateObj) txWhere.bookingDate.lte = toDateObj;
    }

    const txAggregations = await this.prisma.transaction.groupBy({
      by: ['accountId', 'entryType'],
      where: txWhere,
      _sum: {
        amount: true,
      },
    });

    const txMap: Record<number, { Dr: number; Cr: number }> = {};
    txAggregations.forEach((agg) => {
      if (!txMap[agg.accountId]) {
        txMap[agg.accountId] = { Dr: 0, Cr: 0 };
      }
      const amt = agg._sum.amount ? Number(agg._sum.amount) : 0;
      if (agg.entryType === 'Dr') txMap[agg.accountId].Dr += amt;
      if (agg.entryType === 'Cr') txMap[agg.accountId].Cr += amt;
    });

    let purchase = 0;
    let purchaseReturn = 0;
    let directExpenses = 0;
    let directIncome = 0;
    let sales = 0;
    let salesReturn = 0;
    let indirectIncome = 0;
    let indirectExpenses = 0;
    let ledgerOpeningStock = 0;
    let ledgerClosingStock = 0;

    const matchGroup = (groups: string[], keywords: string[], exclude: string[] = []): boolean => {
      if (!groups || groups.length === 0) return false;
      return groups.some((g) => {
        const lower = g.toLowerCase();
        const matchesKey = keywords.some((k) => lower.includes(k.toLowerCase()));
        const isExcluded = exclude.some((ex) => lower.includes(ex.toLowerCase()));
        return matchesKey && !isExcluded;
      });
    };

    const directExpensesBreakdown: any[] = [];
    const directIncomeBreakdown: any[] = [];
    const indirectExpensesBreakdown: any[] = [];
    const indirectIncomeBreakdown: any[] = [];

    const hasDateFilter = Boolean(fromDateObj || toDateObj);

    const [l1Groups, l2SubGroups, l3SubSubGroups, l4SubSubSubGroups, l5SubSubSubSubGroups] = await Promise.all([
      this.prisma.group.findMany({ select: { id: true, group_name: true, parent_id: true } }),
      this.prisma.subGroup.findMany({ select: { id: true, subgroup_name: true, group_id: true } }),
      this.prisma.subSubGroup.findMany({ select: { id: true, name: true, sub_group_id: true } }),
      this.prisma.subSubSubGroup.findMany({ select: { id: true, name: true, sub_sub_group_id: true } }),
      this.prisma.subSubSubSubGroup.findMany({ select: { id: true, name: true, sub_sub_sub_group_id: true } }),
    ]);

    const groupParentMap = new Map<string, string>();
    const l1Map = new Map<number, any>(l1Groups.map((g) => [g.id, g]));
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
    const l2Map = new Map<number, any>(l2SubGroups.map((sg) => [sg.id, sg]));
    for (const ssg of l3SubSubGroups) {
      if (l2Map.has(ssg.sub_group_id)) {
        groupParentMap.set(ssg.name.trim().toLowerCase(), l2Map.get(ssg.sub_group_id).subgroup_name);
      }
    }
    const l3Map = new Map<number, any>(l3SubSubGroups.map((sssg) => [sssg.id, sssg]));
    for (const sssg of l4SubSubSubGroups) {
      if (l3Map.has(sssg.sub_sub_group_id)) {
        groupParentMap.set(sssg.name.trim().toLowerCase(), l3Map.get(sssg.sub_sub_group_id).name);
      }
    }
    const l4Map = new Map<number, any>(l4SubSubSubGroups.map((sssg) => [sssg.id, sssg]));
    for (const sssssg of l5SubSubSubSubGroups) {
      if (l4Map.has(sssssg.sub_sub_sub_group_id)) {
        groupParentMap.set(sssssg.name.trim().toLowerCase(), l4Map.get(sssssg.sub_sub_sub_group_id).name);
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

    accounts.forEach((account) => {
      const rawGroups = account.groupName || [];
      const groups: string[] = [];
      for (const g of rawGroups) {
        if (!g) continue;
        const anc = resolveAncestors(g);
        for (const a of anc) {
          if (!groups.includes(a)) {
            groups.push(a);
          }
        }
      }
      const tx = txMap[account.id] || { Dr: 0, Cr: 0 };

      // Vendor/Customer opening balance is a Balance Sheet item (Creditors/Debtors), NOT Trading P&L purchase/sales expense.
      const opBal = Number(account.supplierOpeningBalance || account.customerOpeningBalance || 0);
      const opType = account.supplierBalanceType || account.customerBalanceType || 'Dr';

      const getDebitBal = () => {
        let bal = opType === 'Dr' ? opBal : -opBal;
        bal += tx.Dr - tx.Cr;
        return bal;
      };

      const getCreditBal = () => {
        let bal = opType === 'Cr' ? opBal : -opBal;
        bal += tx.Cr - tx.Dr;
        return bal;
      };

      if (matchGroup(groups, ['purchase return', 'purchase returns'])) {
        purchaseReturn += getCreditBal();
      } else if (matchGroup(groups, ['purchase', 'purchase accounts'], ['return'])) {
        purchase += getDebitBal();
      } else if (matchGroup(groups, ['sales return', 'sales returns', 'sale return'])) {
        salesReturn += getCreditBal();
      } else if (matchGroup(groups, ['sale', 'sales', 'sales accounts'], ['return'])) {
        sales += getCreditBal();
      } else if (matchGroup(groups, ['indirect expense', 'indirect expenses', 'indirect', 'administrative', 'selling expense', 'operating expense'])) {
        const activity = Math.abs(tx.Dr - tx.Cr);
        const bal = getDebitBal();
        const amt = Math.max(bal, activity);
        indirectExpenses += amt;
        if (amt > 0) {
          indirectExpensesBreakdown.push({
            id: account.id,
            accountName: account.accountName,
            groupName: groups,
            totalAmount: amt,
            taxableAmount: amt,
            taxAmount: 0,
            status: 'COMPLETED',
          });
        }
      } else if (matchGroup(groups, ['direct expense', 'direct expenses', 'manufacturing', 'freight inward', 'carriage inward'], ['indirect', 'income'])) {
        const activity = Math.abs(tx.Dr - tx.Cr);
        const bal = getDebitBal();
        const amt = Math.max(bal, activity);
        directExpenses += amt;
        if (amt > 0) {
          directExpensesBreakdown.push({
            id: account.id,
            accountName: account.accountName,
            groupName: groups,
            totalAmount: amt,
            taxableAmount: amt,
            taxAmount: 0,
            status: 'COMPLETED',
          });
        }
      } else if (matchGroup(groups, ['indirect income', 'indirect incomes', 'other income', 'indirect'])) {
        const activity = Math.abs(tx.Cr - tx.Dr);
        const bal = getCreditBal();
        const amt = Math.max(bal, activity);
        indirectIncome += amt;
        if (amt > 0) {
          indirectIncomeBreakdown.push({
            id: account.id,
            accountName: account.accountName,
            groupName: groups,
            totalAmount: amt,
            taxableAmount: amt,
            taxAmount: 0,
            status: 'COMPLETED',
          });
        }
      } else if (matchGroup(groups, ['direct income', 'direct incomes', 'direct sale', 'direct revenue', 'income', 'outward', 'outword', 'freight & transport (outword)', 'freight & transport (outward)'], ['indirect', 'expense'])) {
        const activity = Math.abs(tx.Cr - tx.Dr);
        const bal = getCreditBal();
        const amt = Math.max(bal, activity);
        directIncome += amt;
        if (amt > 0) {
          directIncomeBreakdown.push({
            id: account.id,
            accountName: account.accountName,
            groupName: groups,
            totalAmount: amt,
            taxableAmount: amt,
            taxAmount: 0,
            status: 'COMPLETED',
          });
        }
      } else if (matchGroup(groups, ['opening stock'])) {
        ledgerOpeningStock += getDebitBal();
      } else if (matchGroup(groups, ['closing stock'])) {
        ledgerClosingStock += getCreditBal();
      }
    });

    // Query Purchase Invoice and Sales Invoice aggregates
    const piWhereInput: Prisma.PurchaseInvoiceWhereInput = {
      userId,
      status: { in: ['GENERATED', 'COMPLETED'] as any },
    };
    const siWhereInput: Prisma.SalesInvoiceWhereInput = {
      userId,
      status: { in: ['GENERATED', 'COMPLETED'] as any },
    };

    if (fromDateObj || toDateObj) {
      const piCond: any = {};
      const siCond: any = {};
      if (fromDateObj) {
        piCond.gte = fromDateObj;
        siCond.gte = fromDateObj;
      }
      if (toDateObj) {
        piCond.lte = toDateObj;
        siCond.lte = toDateObj;
      }
      piWhereInput.OR = [
        { supplierInvoiceDate: piCond },
        { invoiceDate: piCond },
      ];
      siWhereInput.OR = [
        { customerInvoiceDate: siCond },
        { invoiceDate: siCond },
      ];
    }

    const pieWhereInput: Prisma.PurchaseInvoiceExpenseWhereInput = {
      purchaseInvoice: piWhereInput,
    };
    const sieWhereInput: Prisma.SalesInvoiceExpenseWhereInput = {
      salesInvoice: siWhereInput,
    };

    const [piAgg, siAgg, piExpenses, siExpenses] = await Promise.all([
      this.prisma.purchaseInvoice.aggregate({
        where: piWhereInput,
        _sum: { taxableAmount: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: siWhereInput,
        _sum: { taxableAmount: true },
      }),
      this.prisma.purchaseInvoiceExpense.findMany({
        where: pieWhereInput,
        include: {
          purchaseInvoice: {
            select: {
              supplierInvoiceNumber: true,
              supplierName: true,
              bookingDate: true,
            },
          },
        },
      }),
      this.prisma.salesInvoiceExpense.findMany({
        where: sieWhereInput,
        include: {
          salesInvoice: {
            select: {
              invoiceNumber: true,
              customerName: true,
              bookingDate: true,
            },
          },
        },
      }),
    ]);

    piExpenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      if (amt <= 0) return;

      const groupName = exp.groupName || 'Direct Expense';
      const record = {
        id: exp.id,
        accountName: groupName,
        supplierName: exp.purchaseInvoice?.supplierName || 'Purchase Expense',
        supplierInvoiceNumber: exp.purchaseInvoice?.supplierInvoiceNumber || '-',
        bookingDate: exp.purchaseInvoice?.bookingDate,
        totalAmount: amt,
        taxableAmount: amt,
        taxAmount: Number(exp.taxAmount || 0),
        status: 'COMPLETED',
      };

      if (matchGroup([groupName], ['indirect expense', 'indirect expenses', 'indirect', 'administrative', 'selling expense', 'operating expense'])) {
        indirectExpenses += amt;
        indirectExpensesBreakdown.push(record);
      } else {
        directExpenses += amt;
        directExpensesBreakdown.push(record);
      }
    });

    siExpenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      if (amt <= 0) return;

      const groupName = exp.groupName || 'Direct Income';
      const record = {
        id: exp.id,
        accountName: groupName,
        supplierName: exp.salesInvoice?.customerName || 'Sales Income',
        supplierInvoiceNumber: exp.salesInvoice?.invoiceNumber || '-',
        bookingDate: exp.salesInvoice?.bookingDate,
        totalAmount: amt,
        taxableAmount: amt,
        taxAmount: Number(exp.taxAmount || 0),
        status: 'COMPLETED',
      };

      if (matchGroup([groupName], ['indirect income', 'indirect incomes', 'other income', 'indirect'])) {
        indirectIncome += amt;
        indirectIncomeBreakdown.push(record);
      } else {
        directIncome += amt;
        directIncomeBreakdown.push(record);
      }
    });

    const invoicePurchases = piAgg._sum.taxableAmount ? Number(piAgg._sum.taxableAmount) : 0;
    const invoiceSales = siAgg._sum.taxableAmount ? Number(siAgg._sum.taxableAmount) : 0;

    purchase = invoicePurchases > 0 ? invoicePurchases : purchase;
    sales = invoiceSales > 0 ? invoiceSales : sales;

    // Calculate dynamic stock valuation
    const valuationMethod = query.valuationMethod || 'Weighted Average';
    const computedOpeningStock = fromDateObj
      ? await this.calculateStockValuation(userId, fromDateObj, valuationMethod, true)
      : 0;
    const computedClosingStock = await this.calculateStockValuation(
      userId,
      toDateObj || new Date(),
      valuationMethod,
      false,
    );

    const openingStock = computedOpeningStock > 0 ? computedOpeningStock : Math.max(0, ledgerOpeningStock);
    const closingStock = computedClosingStock > 0 ? computedClosingStock : Math.max(0, ledgerClosingStock);

    const netPurchase = Math.max(0, Number((purchase - purchaseReturn).toFixed(2)));
    const netSales = Math.max(0, Number((sales - salesReturn).toFixed(2)));

    const rawOpeningStock = Number(Math.max(0, openingStock).toFixed(2));
    const rawDirectExpenses = Number(Math.max(0, directExpenses).toFixed(2));
    const rawDirectIncome = Number(Math.max(0, directIncome).toFixed(2));
    const rawClosingStock = Number(Math.max(0, closingStock).toFixed(2));
    const rawIndirectIncome = Number(Math.max(0, indirectIncome).toFixed(2));
    const rawIndirectExpenses = Number(Math.max(0, indirectExpenses).toFixed(2));

    const totalTradingExpenditure = Number((rawOpeningStock + netPurchase + rawDirectExpenses).toFixed(2));
    const totalTradingIncome = Number((netSales + rawDirectIncome + rawClosingStock + rawIndirectIncome).toFixed(2));

    const grossProfitCalc = totalTradingIncome - totalTradingExpenditure;

    let grossProfit = 0;
    let grossLoss = 0;
    const isGrossProfit = grossProfitCalc >= 0;

    if (isGrossProfit) {
      grossProfit = Number(grossProfitCalc.toFixed(2));
      grossLoss = 0;
    } else {
      grossProfit = 0;
      grossLoss = Number(Math.abs(grossProfitCalc).toFixed(2));
    }

    const netProfitCalc = (grossProfit - grossLoss) - rawIndirectExpenses;

    let netProfit = 0;
    let netLoss = 0;
    const isNetProfit = netProfitCalc >= 0;

    if (isNetProfit) {
      netProfit = Number(netProfitCalc.toFixed(2));
      netLoss = 0;
    } else {
      netProfit = 0;
      netLoss = Number(Math.abs(netProfitCalc).toFixed(2));
    }

    const totalExpenditure = Number((totalTradingExpenditure + rawIndirectExpenses).toFixed(2));
    const totalIncome = totalTradingIncome;

    return {
      period: {
        fromDate: fromDateObj ? fromDateObj.toISOString().split('T')[0] : null,
        toDate: toDateObj ? toDateObj.toISOString().split('T')[0] : null,
      },
      trading: {
        openingStock: rawOpeningStock,
        purchase: Number(Math.max(0, purchase).toFixed(2)),
        purchaseReturn: Number(Math.max(0, purchaseReturn).toFixed(2)),
        netPurchase,
        directExpenses: rawDirectExpenses,
        directIncome: rawDirectIncome,
        sales: Number(Math.max(0, sales).toFixed(2)),
        salesReturn: Number(Math.max(0, salesReturn).toFixed(2)),
        netSales,
        closingStock: rawClosingStock,
        totalExpenditure: totalTradingExpenditure,
        totalIncome: totalTradingIncome,
        grossProfit,
        grossLoss,
        isGrossProfit,
      },
      profitLoss: {
        indirectIncome: rawIndirectIncome,
        indirectExpenses: rawIndirectExpenses,
        netProfit,
        netLoss,
        isNetProfit,
      },
      expenditure: {
        openingStock: rawOpeningStock,
        purchase: netPurchase,
        directExpenses: rawDirectExpenses,
        indirectExpenses: rawIndirectExpenses,
        totalExpenditure,
      },
      income: {
        sales: netSales,
        directIncome: rawDirectIncome,
        closingStock: rawClosingStock,
        indirectIncome: rawIndirectIncome,
        totalIncome,
      },
      breakdown: {
        directExpenses: directExpensesBreakdown,
        directIncome: directIncomeBreakdown,
        indirectExpenses: indirectExpensesBreakdown,
        indirectIncome: indirectIncomeBreakdown,
      },
      openingStock: rawOpeningStock,
      purchase: netPurchase,
      purchaseReturn: Number(Math.max(0, purchaseReturn).toFixed(2)),
      netPurchase,
      directExpenses: rawDirectExpenses,
      directIncome: rawDirectIncome,
      sales: netSales,
      salesReturn: Number(Math.max(0, salesReturn).toFixed(2)),
      netSales,
      closingStock: rawClosingStock,
      totalExpenditure,
      totalRevenue: totalIncome,
      grossProfit,
      grossLoss,
      indirectIncome: rawIndirectIncome,
      indirectExpenses: rawIndirectExpenses,
      netProfit,
      netLoss,
    };
  }

  private async calculateStockValuation(
    userId: number,
    cutoffDate?: Date,
    method: string = 'Weighted Average',
    isStrictlyBefore: boolean = false,
  ): Promise<number> {
    try {
      const piWhere: Prisma.PurchaseInvoiceWhereInput = {
        userId,
        status: { in: ['GENERATED', 'COMPLETED'] as any },
      };
      if (cutoffDate) {
        const cond = isStrictlyBefore ? { lt: cutoffDate } : { lte: cutoffDate };
        piWhere.OR = [
          { supplierInvoiceDate: cond },
          { invoiceDate: cond },
        ];
      }

      const purchaseItems = await this.prisma.purchaseInvoiceItem.findMany({
        where: { purchaseInvoice: piWhere },
        select: {
          productId: true,
          productCode: true,
          quantity: true,
          rate: true,
          beforeTaxAmount: true,
          amount: true,
          purchaseInvoice: { select: { bookingDate: true } },
        },
        orderBy: { purchaseInvoice: { bookingDate: 'asc' } },
      });

      if (!purchaseItems || purchaseItems.length === 0) return 0;

      const siWhere: Prisma.SalesInvoiceWhereInput = {
        userId,
        status: { in: ['GENERATED', 'COMPLETED'] as any },
      };
      if (cutoffDate) {
        const cond = isStrictlyBefore ? { lt: cutoffDate } : { lte: cutoffDate };
        siWhere.OR = [
          { customerInvoiceDate: cond },
          { invoiceDate: cond },
        ];
      }

      const salesItems = await this.prisma.salesInvoiceItem.findMany({
        where: { salesInvoice: siWhere },
        select: {
          productId: true,
          productCode: true,
          quantity: true,
        },
      });

      const salesQtyMap: Record<string, number> = {};
      salesItems.forEach((si) => {
        const key = si.productId ? String(si.productId) : si.productCode;
        salesQtyMap[key] = (salesQtyMap[key] || 0) + Number(si.quantity || 0);
      });

      const productPurchases: Record<string, typeof purchaseItems> = {};
      purchaseItems.forEach((pi) => {
        const key = pi.productId ? String(pi.productId) : pi.productCode;
        if (!productPurchases[key]) productPurchases[key] = [];
        productPurchases[key].push(pi);
      });

      let totalValuation = 0;
      const normalizedMethod = method.toUpperCase().replace(/\s+/g, '_');

      for (const key of Object.keys(productPurchases)) {
        const purchases = productPurchases[key];
        const totalPurQty = purchases.reduce((acc, p) => acc + Number(p.quantity || 0), 0);
        const totalPurAmt = purchases.reduce((acc, p) => acc + Number(p.beforeTaxAmount || p.amount || (p.quantity * p.rate)), 0);
        const soldQty = salesQtyMap[key] || 0;
        const remainingQty = totalPurQty - soldQty;

        if (remainingQty <= 0) continue;

        if (normalizedMethod === 'FIFO') {
          let remToValue = remainingQty;
          let prodVal = 0;
          for (let i = purchases.length - 1; i >= 0; i--) {
            const p = purchases[i];
            const q = Number(p.quantity || 0);
            const r = Number(p.rate || 0);
            if (remToValue <= q) {
              prodVal += remToValue * r;
              remToValue = 0;
              break;
            } else {
              prodVal += q * r;
              remToValue -= q;
            }
          }
          totalValuation += prodVal;
        } else if (normalizedMethod === 'LIFO') {
          let remToValue = remainingQty;
          let prodVal = 0;
          for (let i = 0; i < purchases.length; i++) {
            const p = purchases[i];
            const q = Number(p.quantity || 0);
            const r = Number(p.rate || 0);
            if (remToValue <= q) {
              prodVal += remToValue * r;
              remToValue = 0;
              break;
            } else {
              prodVal += q * r;
              remToValue -= q;
            }
          }
          totalValuation += prodVal;
        } else {
          // WEIGHTED_AVERAGE
          const avgRate = totalPurQty > 0 ? totalPurAmt / totalPurQty : 0;
          totalValuation += remainingQty * avgRate;
        }
      }

      return Number(totalValuation.toFixed(2));
    } catch (err) {
      return 0;
    }
  }

  async getInventoryReport(
    userId: number,
    query: InventoryQueryDto,
  ): Promise<InventoryReportResponseDto> {
    const { search, dateFrom, dateTo, page = 1, limit = 10, sortBy, sortOrder = 'asc' } = query;

    // 1. Fetch user's active products
    const userProducts = await this.prisma.product.findMany({
      where: { created_by: userId, is_deleted: false },
      select: {
        id: true,
        product_name: true,
        product_code: true,
      },
    });

    const productMap: Record<string, { id: number | string; name: string; code: string }> = {};
    userProducts.forEach((p) => {
      productMap[String(p.id)] = { id: p.id, name: p.product_name, code: p.product_code };
      if (p.product_code) {
        productMap[`code:${p.product_code.toLowerCase()}`] = { id: p.id, name: p.product_name, code: p.product_code };
      }
    });

    // Build date filters for purchase & sales invoices if specified
    const piWhere: Prisma.PurchaseInvoiceWhereInput = {
      userId,
      status: { in: ['GENERATED', 'COMPLETED'] as any },
    };
    const siWhere: Prisma.SalesInvoiceWhereInput = {
      userId,
      status: { in: ['GENERATED', 'COMPLETED'] as any },
    };

    if (dateFrom || dateTo) {
      const piCond: any = {};
      const siCond: any = {};
      if (dateFrom) {
        piCond.gte = new Date(dateFrom);
        siCond.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        if (typeof dateTo === 'string' && dateTo.length === 10) {
          dTo.setUTCHours(23, 59, 59, 999);
        }
        piCond.lte = dTo;
        siCond.lte = dTo;
      }
      piWhere.OR = [
        { supplierInvoiceDate: piCond },
        { invoiceDate: piCond },
      ];
      siWhere.OR = [
        { customerInvoiceDate: siCond },
        { invoiceDate: siCond },
      ];
    }

    // 2. Fetch purchase items and sales items
    const [purchaseItems, salesItems] = await Promise.all([
      this.prisma.purchaseInvoiceItem.findMany({
        where: { purchaseInvoice: piWhere },
        select: {
          productId: true,
          productCode: true,
          productName: true,
          quantity: true,
          rate: true,
          beforeTaxAmount: true,
          amount: true,
        },
      }),
      this.prisma.salesInvoiceItem.findMany({
        where: { salesInvoice: siWhere },
        select: {
          productId: true,
          productCode: true,
          productName: true,
          quantity: true,
        },
      }),
    ]);

    const inventoryMap: Record<
      string,
      {
        productId: number | string;
        productName: string;
        productCode: string;
        purchaseQty: number;
        totalPurchaseValue: number;
        salesQty: number;
      }
    > = {};

    const getOrCreateEntry = (
      pId: number | null | undefined,
      pCode: string | null | undefined,
      pName: string | null | undefined,
    ) => {
      let key = pId ? String(pId) : '';
      let matchedInfo = pId ? productMap[String(pId)] : null;

      if (!matchedInfo && pCode) {
        matchedInfo = productMap[`code:${pCode.toLowerCase()}`];
      }

      if (matchedInfo) {
        key = String(matchedInfo.id);
      } else if (!key) {
        key = pCode ? `code:${pCode}` : (pName || 'unknown');
      }

      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          productId: matchedInfo ? matchedInfo.id : (pId || key),
          productName: matchedInfo ? matchedInfo.name : (pName || pCode || 'Unknown Product'),
          productCode: matchedInfo ? matchedInfo.code : (pCode || ''),
          purchaseQty: 0,
          totalPurchaseValue: 0,
          salesQty: 0,
        };
      }
      return inventoryMap[key];
    };

    userProducts.forEach((p) => {
      getOrCreateEntry(p.id, p.product_code, p.product_name);
    });

    purchaseItems.forEach((pi) => {
      const entry = getOrCreateEntry(pi.productId, pi.productCode, pi.productName);
      const qty = Number(pi.quantity || 0);
      const rate = Number(pi.rate || 0);
      const value = pi.beforeTaxAmount || pi.amount || (qty * rate);

      entry.purchaseQty += qty;
      entry.totalPurchaseValue += Number(value || 0);
    });

    salesItems.forEach((si) => {
      const entry = getOrCreateEntry(si.productId, si.productCode, si.productName);
      const qty = Number(si.quantity || 0);
      entry.salesQty += qty;
    });

    let items: InventoryReportItemDto[] = Object.values(inventoryMap).map((item) => {
      const purchaseQty = Number(item.purchaseQty.toFixed(4));
      const salesQty = Number(item.salesQty.toFixed(4));
      const remainingQty = Math.max(0, Number((purchaseQty - salesQty).toFixed(4)));

      const avgPurchasingAmount = purchaseQty > 0
        ? Number((item.totalPurchaseValue / purchaseQty).toFixed(4))
        : 0;

      const totalAmount = Number((remainingQty * avgPurchasingAmount).toFixed(2));

      return {
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        purchaseQty: Number(purchaseQty.toFixed(2)),
        salesQty: Number(salesQty.toFixed(2)),
        remainingQty: Number(remainingQty.toFixed(2)),
        avgPurchasingAmount: Number(avgPurchasingAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (i) => i.productName.toLowerCase().includes(q) || (i.productCode && i.productCode.toLowerCase().includes(q)),
      );
    }

    const totalProducts = items.length;
    const totalPurchaseQty = Number(items.reduce((sum, i) => sum + i.purchaseQty, 0).toFixed(2));
    const totalSalesQty = Number(items.reduce((sum, i) => sum + i.salesQty, 0).toFixed(2));
    const totalRemainingQty = Number((totalPurchaseQty - totalSalesQty).toFixed(2));
    const totalInventoryValue = Number(items.reduce((sum, i) => sum + i.totalAmount, 0).toFixed(2));

    const summary: InventoryReportSummaryDto = {
      totalProducts,
      totalPurchaseQty,
      totalSalesQty,
      totalRemainingQty: Math.max(0, totalRemainingQty),
      totalInventoryValue,
    };

    if (sortBy) {
      items.sort((a, b) => {
        let valA = a[sortBy as keyof InventoryReportItemDto];
        let valB = b[sortBy as keyof InventoryReportItemDto];
        if (typeof valA === 'string') {
          return sortOrder === 'asc'
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }
        valA = valA || 0;
        valB = valB || 0;
        return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
    }

    const skip = (page - 1) * limit;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      data: paginatedItems,
      summary,
      meta: {
        total: totalProducts,
        page,
        limit,
        totalPages: Math.ceil(totalProducts / limit) || 1,
      },
    };
  }

  async getBalanceSheet(
    userId: number,
    query: BalanceSheetQueryDto,
  ): Promise<BalanceSheetResponseDto> {
    const { dateFrom, dateTo, asOfDate } = query;
    const targetDateStr = asOfDate || dateTo || new Date().toISOString().split('T')[0];

    // Fetch Profit & Loss for calculating Net Profit / Retained Earnings
    const plData = await this.getProfitLoss(userId, { fromDate: dateFrom, toDate: dateTo });

    const isNetProfit = plData?.profitLoss?.isNetProfit ?? ((plData?.profitLoss?.netProfit || plData?.netProfit || 0) >= (plData?.profitLoss?.netLoss || plData?.netLoss || 0));
    const rawNetProfit = plData?.profitLoss?.netProfit ?? plData?.netProfit ?? 0;
    const rawNetLoss = plData?.profitLoss?.netLoss ?? plData?.netLoss ?? 0;
    const periodNetResult = isNetProfit ? rawNetProfit : -rawNetLoss;

    const closingStock = plData?.trading?.closingStock ?? plData?.closingStock ?? 0;

    // Fetch Gross Purchases & Taxes
    const purchaseReport = await this.getPurchaseReport(userId);
    const salesReport = await this.getSalesReport(userId);

    const totalPurchases = purchaseReport?.grossPurchases || 0;
    const totalPurchaseTax = purchaseReport?.totalTaxPaid || 0;

    const totalSales = salesReport?.grossSales || 0;
    const totalSalesTax = salesReport?.totalTaxCollected || 0;

    // Non-Current Liabilities
    const longTermLoans = 0;

    // Current Liabilities
    const sundryCreditors = totalPurchases;
    const bankOverdraft = 0;
    const dutiesTaxesPayable = totalSalesTax;
    const customerAdvances = 0;

    const totalNonCurrentLiab = longTermLoans;
    const totalCurrentLiab = sundryCreditors + bankOverdraft + dutiesTaxesPayable + customerAdvances;

    // Fixed Assets
    const tangibleAssets = 0;
    const intangibleAssets = 0;

    // Current Assets
    const sundryDebtors = totalSales;
    const closingInventoryVal = closingStock;
    const inputTaxCredit = totalPurchaseTax;

    const bankCashAccounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { hasSome: ['Bank & Cash', 'BANK & CASH', 'bank & cash', 'BANK', 'CASH', 'Bank', 'Cash'] },
      },
      select: { customerOpeningBalance: true, supplierOpeningBalance: true },
    });
    const bankCashOpBal = bankCashAccounts.reduce(
      (sum, a) => sum + Number(a.customerOpeningBalance || a.supplierOpeningBalance || 0),
      0,
    );
    const liquidFunds = bankCashOpBal > 0 ? bankCashOpBal : Math.max(0, totalSales - totalPurchases);
    const supplierAdvances = 0;

    const totalNonCurrentAssets = tangibleAssets + intangibleAssets;
    const totalCurrentAssets = sundryDebtors + closingInventoryVal + inputTaxCredit + liquidFunds + supplierAdvances;
    const totalAssets = Number((totalNonCurrentAssets + totalCurrentAssets).toFixed(2));

    // Capital & Equity
    const capitalAccounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { hasSome: ['Capital', 'Capital Account', 'CAPITAL', 'Capital Accounts', 'capital account', 'capital accounts', 'capital', 'Share Capital', 'Share capital'] },
      },
      select: { customerOpeningBalance: true, supplierOpeningBalance: true },
    });
    
    const capitalAccountAmt = capitalAccounts.reduce(
      (sum, a) => sum + Number(a.customerOpeningBalance || a.supplierOpeningBalance || 0),
      0
    );
    
    const totalCapEquity = Number((capitalAccountAmt + periodNetResult).toFixed(2));

    const totalLiabilitiesAndEquity = Number((totalCapEquity + totalNonCurrentLiab + totalCurrentLiab).toFixed(2));

    const is_balanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05;
    const discrepancy_amount = Number(Math.abs(totalAssets - totalLiabilitiesAndEquity).toFixed(2));

    return {
      asOfDate: targetDateStr,
      is_balanced,
      discrepancy_amount,
      net_profit: isNetProfit ? Math.abs(periodNetResult) : 0,
      net_loss: !isNetProfit ? Math.abs(periodNetResult) : 0,
      is_net_profit: isNetProfit,
      liabilities_and_equity: {
        total: totalLiabilitiesAndEquity,
        capital_equity: {
          title: 'Capital & Equity',
          total: totalCapEquity,
          items: [
            { id: 'cap_1', name: 'Capital Account (Opening Balance)', category: 'EQUITY', amount: Math.max(0, capitalAccountAmt) },
            { id: 'cap_2', name: isNetProfit ? 'Profit & Loss A/c (Net Profit)' : 'Profit & Loss A/c (Net Loss)', category: 'EQUITY', amount: periodNetResult },
          ],
        },
        non_current_liabilities: {
          title: 'Non-Current Liabilities',
          total: totalNonCurrentLiab,
          items: [
            { id: 'ncl_1', name: 'Long-Term Loans & Borrowings', category: 'LIABILITY', amount: longTermLoans },
          ],
        },
        current_liabilities: {
          title: 'Current Liabilities',
          total: totalCurrentLiab,
          items: [
            { id: 'cl_1', name: 'Sundry Creditors (Accounts Payable)', category: 'LIABILITY', amount: sundryCreditors },
            { id: 'cl_2', name: 'Bank Overdraft / Cash Credit (C.C.)', category: 'LIABILITY', amount: bankOverdraft },
            { id: 'cl_3', name: 'Duties & Taxes Payable (Output GST)', category: 'LIABILITY', amount: dutiesTaxesPayable },
            { id: 'cl_4', name: 'Customer Advances', category: 'LIABILITY', amount: customerAdvances },
          ],
        },
      },
      assets: {
        total: totalAssets,
        non_current_assets: {
          title: 'Non-Current / Fixed Assets',
          total: totalNonCurrentAssets,
          items: [
            { id: 'nca_1', name: 'Tangible Assets (Machinery, Vehicles)', category: 'ASSET', amount: tangibleAssets },
            { id: 'nca_2', name: 'Intangible Assets (Patents, Software)', category: 'ASSET', amount: intangibleAssets },
          ],
        },
        current_assets: {
          title: 'Current Assets',
          total: totalCurrentAssets,
          items: [
            { id: 'ca_1', name: 'Sundry Debtors (Accounts Receivable)', category: 'ASSET', amount: sundryDebtors },
            { id: 'ca_2', name: 'Closing Stock / Inventory', category: 'ASSET', amount: closingInventoryVal },
            { id: 'ca_3', name: 'Input Tax Credit (Input GST)', category: 'ASSET', amount: inputTaxCredit },
            { id: 'ca_4', name: 'Liquid Funds (Cash & Bank Balance)', category: 'ASSET', amount: liquidFunds },
            { id: 'ca_5', name: 'Supplier Advances / Prepaid Expenses', category: 'ASSET', amount: supplierAdvances },
          ],
        },
      },
    };
  }
}

