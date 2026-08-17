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

  async getSalesReport(userId: number): Promise<SalesReportResponseDto> {
    const [aggregate, count] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: { userId, status: { not: 'DELETED' as any } },
        _sum: { grandTotal: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      }),
      this.prisma.salesInvoice.count({
        where: { userId, status: { not: 'DELETED' as any } },
      }),
    ]);

    const totalTax = (aggregate._sum.igstAmount || 0) + (aggregate._sum.cgstAmount || 0) + (aggregate._sum.sgstAmount || 0);

    return {
      grossSales: aggregate._sum.grandTotal || 0,
      totalTaxCollected: totalTax,
      completedSales: count,
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

    if (fromDateStr) {
      fromDateObj = new Date(fromDateStr);
      if (isNaN(fromDateObj.getTime())) {
        throw new BadRequestException('Invalid fromDate parameter');
      }
    }

    if (toDateStr) {
      toDateObj = new Date(toDateStr);
      if (isNaN(toDateObj.getTime())) {
        throw new BadRequestException('Invalid toDate parameter');
      }
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

    accounts.forEach((account) => {
      const groups = account.groupName || [];
      const tx = txMap[account.id] || { Dr: 0, Cr: 0 };

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
      }

      if (matchGroup(groups, ['sales return', 'sales returns', 'sale return'])) {
        salesReturn += getDebitBal();
      } else if (matchGroup(groups, ['sale', 'sales', 'sales accounts'], ['return'])) {
        sales += getCreditBal();
      }

      if (matchGroup(groups, ['direct expense', 'direct expenses', 'manufacturing', 'freight', 'carriage inward', 'expense'])) {
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
      }

      if (matchGroup(groups, ['direct income', 'direct incomes', 'direct sale', 'direct revenue'])) {
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
      }

      if (matchGroup(groups, ['indirect income', 'indirect incomes', 'other income'])) {
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
      }

      if (matchGroup(groups, ['indirect expense', 'indirect expenses', 'administrative', 'selling expense', 'operating expense'])) {
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
      }

      if (matchGroup(groups, ['opening stock'])) {
        ledgerOpeningStock += getDebitBal();
      }

      if (matchGroup(groups, ['closing stock'])) {
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
      piWhereInput.bookingDate = {};
      siWhereInput.bookingDate = {};
      if (fromDateObj) {
        piWhereInput.bookingDate.gte = fromDateObj;
        siWhereInput.bookingDate.gte = fromDateObj;
      }
      if (toDateObj) {
        piWhereInput.bookingDate.lte = toDateObj;
        siWhereInput.bookingDate.lte = toDateObj;
      }
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

      const groupName = exp.groupName || 'Direct Expense';
      const record = {
        id: exp.id,
        accountName: groupName,
        supplierName: exp.salesInvoice?.customerName || 'Sales Expense/Income',
        supplierInvoiceNumber: exp.salesInvoice?.invoiceNumber || '-',
        bookingDate: exp.salesInvoice?.bookingDate,
        totalAmount: amt,
        taxableAmount: amt,
        taxAmount: Number(exp.taxAmount || 0),
        status: 'COMPLETED',
      };

      if (matchGroup([groupName], ['direct income', 'direct incomes', 'income'])) {
        directIncome += amt;
        directIncomeBreakdown.push(record);
      } else if (matchGroup([groupName], ['indirect income', 'indirect incomes', 'other income'])) {
        indirectIncome += amt;
        indirectIncomeBreakdown.push(record);
      } else if (matchGroup([groupName], ['indirect expense', 'indirect expenses'])) {
        indirectExpenses += amt;
        indirectExpensesBreakdown.push(record);
      } else {
        directExpenses += amt;
        directExpensesBreakdown.push(record);
      }
    });

    const invoicePurchases = piAgg._sum.taxableAmount ? Number(piAgg._sum.taxableAmount) : 0;
    const invoiceSales = siAgg._sum.taxableAmount ? Number(siAgg._sum.taxableAmount) : 0;

    if (invoicePurchases > purchase) purchase = invoicePurchases;
    if (invoiceSales > sales) sales = invoiceSales;

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
        piWhere.bookingDate = isStrictlyBefore ? { lt: cutoffDate } : { lte: cutoffDate };
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
        siWhere.bookingDate = isStrictlyBefore ? { lt: cutoffDate } : { lte: cutoffDate };
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
      piWhere.bookingDate = {};
      siWhere.bookingDate = {};
      if (dateFrom) {
        piWhere.bookingDate.gte = new Date(dateFrom);
        siWhere.bookingDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        piWhere.bookingDate.lte = new Date(dateTo);
        siWhere.bookingDate.lte = new Date(dateTo);
      }
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
}

