import { IsEnum, IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportType {
  ALL = 'All',
  PURCHASE = 'Purchase',
  SALES = 'Sales',
  PRODUCTS = 'Products',
}

export enum TrendInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;
}

export class TrendQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsEnum(['purchase', 'sales', 'products'])
  type: 'purchase' | 'sales' | 'products';

  @IsEnum(TrendInterval)
  interval: TrendInterval;
}

export class PaginatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class POReportQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export interface SummaryResponseDto {
  totalPurchases: number;
  totalSales: number;
  netFlow: number;
  totalInvoices: number;
}

export interface StatusSummaryResponseDto {
  purchaseOrders: {
    created: number;
    pending: number;
    expiringSoon: number;
    expired: number;
    completed: number;
    deleted: number;
  };
  salesOrders: {
    created: number;
    pending: number;
    expiringSoon: number;
    expired: number;
    completed: number;
    deleted: number;
  };
  invoices: {
    purchase: number;
    sales: number;
    deleted: number;
  };
  grn: {
    generated: number;
    completed: number;
    deleted: number;
  };
  challans: {
    generated: number;
    completed: number;
    deleted: number;
  };
}

export interface FinancialOverviewItem {
  date: string;
  purchases: number;
  sales: number;
}

export interface ProductReportResponseDto {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  goods: number;
  services: number;
}

export interface PurchaseReportResponseDto {
  grossPurchases: number;
  totalTaxPaid: number;
  purchaseInvoices: number;
}

export interface SalesReportResponseDto {
  grossSales: number;
  netSales: number;
  totalTaxCollected: number;
  totalDiscounts: number;
  returnsAndRefunds: number;
  completedSales: number;
  totalSalesOrders: number;
  averageOrderValue: number;
}

export enum StockValuationMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  WEIGHTED_AVERAGE = 'Weighted Average',
  WEIGHTED_AVERAGE_ALT = 'WEIGHTED_AVERAGE',
}

export class ProfitLossQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  financialYearId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  godownId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  valuationMethod?: string;
}

export interface TradingProfitLossResponseDto {
  period?: {
    fromDate?: string | null;
    toDate?: string | null;
  };
  trading: {
    openingStock: number;
    purchase: number;
    purchaseReturn: number;
    netPurchase: number;
    directExpenses: number;
    directIncome: number;
    sales: number;
    salesReturn: number;
    netSales: number;
    closingStock: number;
    totalExpenditure: number;
    totalIncome: number;
    grossProfit: number;
    grossLoss: number;
    isGrossProfit: boolean;
  };
  profitLoss: {
    indirectIncome: number;
    indirectExpenses: number;
    netProfit: number;
    netLoss: number;
    isNetProfit: boolean;
  };
  expenditure?: {
    openingStock: number;
    purchase: number;
    directExpenses: number;
    indirectExpenses: number;
    totalExpenditure: number;
  };
  income?: {
    sales: number;
    directIncome: number;
    closingStock: number;
    indirectIncome: number;
    totalIncome: number;
  };
  breakdown?: {
    directExpenses: any[];
    directIncome: any[];
    indirectExpenses: any[];
    indirectIncome: any[];
  };
  openingStock?: number;
  purchase?: number;
  purchaseReturn?: number;
  netPurchase?: number;
  directExpenses?: number;
  directIncome?: number;
  sales?: number;
  salesReturn?: number;
  netSales?: number;
  closingStock?: number;
  totalExpenditure?: number;
  totalRevenue?: number;
  grossProfit?: number;
  grossLoss?: number;
  indirectIncome?: number;
  indirectExpenses?: number;
  netProfit?: number;
  netLoss?: number;
}

export class InventoryQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export interface InventoryReportItemDto {
  productId: number | string;
  productName: string;
  productCode?: string;
  purchaseQty: number;
  salesQty: number;
  remainingQty: number;
  avgPurchasingAmount: number;
  totalAmount: number;
}

export interface InventoryReportSummaryDto {
  totalProducts: number;
  totalPurchaseQty: number;
  totalSalesQty: number;
  totalRemainingQty: number;
  totalInventoryValue: number;
}

export interface InventoryReportResponseDto {
  data: InventoryReportItemDto[];
  summary: InventoryReportSummaryDto;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class BalanceSheetQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export interface BalanceSheetItemDto {
  id: string;
  code?: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY';
  subGroup?: string;
  amount: number;
  children?: BalanceSheetItemDto[];
}

export interface BalanceSheetSectionDto {
  title: string;
  total: number;
  items: BalanceSheetItemDto[];
}

export interface BalanceSheetResponseDto {
  asOfDate: string;
  is_balanced: boolean;
  discrepancy_amount: number;
  net_profit?: number;
  net_loss?: number;
  is_net_profit?: boolean;
  liabilities_and_equity: {
    total: number;
    capital_equity: BalanceSheetSectionDto;
    non_current_liabilities: BalanceSheetSectionDto;
    current_liabilities: BalanceSheetSectionDto;
  };
  assets: {
    total: number;
    non_current_assets: BalanceSheetSectionDto;
    current_assets: BalanceSheetSectionDto;
  };
}

export class OverallSalesReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class CustomerSalesReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  customerTypes?: string;

  @IsOptional()
  @IsString()
  customerIds?: string;

  @IsOptional()
  @IsString()
  productIds?: string;

  @IsOptional()
  @IsString()
  categoryIds?: string;

  @IsOptional()
  @IsString()
  subCategoryIds?: string;

  @IsOptional()
  @IsString()
  subSubCategoryIds?: string;

  @IsOptional()
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export interface PeriodComparisonDto {
  previousValue: number;
  currentValue: number;
  changePercent: number | null;
  isIncrease: boolean;
}

export interface CustomerSalesSummaryResponseDto {
  totalCustomers: number;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  repeatCustomers: number;
  newCustomers: number;
  comparisons: {
    totalCustomers: PeriodComparisonDto;
    totalSales: PeriodComparisonDto;
    totalOrders: PeriodComparisonDto;
    averageOrderValue: PeriodComparisonDto;
    repeatCustomers: PeriodComparisonDto;
    newCustomers: PeriodComparisonDto;
  };
}

export interface CustomerMonthlySalesProductItemDto {
  productName: string;
  productCode?: string;
  quantity?: number;
  uom?: string;
  totalAmount?: number;
}

export interface CustomerMonthlySalesItemDto {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  salesAmount: number;
  orderFrequency: number;
  sharePercent: number;
  products?: string[];
  productDetails?: CustomerMonthlySalesProductItemDto[];
  totalProductsCount?: number;
}

export interface CustomerSalesItemDto {
  customerId: number;
  customerName: string;
  customerCode: string;
  customerType: string;
  customerTypeLabel: string;
  totalOrders: number;
  grossSales: number;
  discounts: number;
  taxAmount: number;
  returnsRefunds: number;
  netSales: number;
  averageOrderValue: number;
  lastPurchaseDate: string | null;
  monthlySales?: CustomerMonthlySalesItemDto[];
}

export interface CustomerTypeGroupDto {
  customerType: string;
  customerTypeLabel: string;
  totalCustomers: number;
  totalSales: number;
  totalOrders: number;
  customers: CustomerSalesItemDto[];
}

export interface CustomerSalesGroupsResponseDto {
  summary: CustomerSalesSummaryResponseDto;
  groups: CustomerTypeGroupDto[];
  totalGroups: number;
  totalMatchingCustomers: number;
  totalMatchingOrders: number;
}

export interface CustomerSalesFilterOptionsResponseDto {
  customerTypes: { id: string; label: string }[];
  customers: { id: number; name: string; code: string; type: string }[];
  products: { id: number; name: string; code: string; categoryId?: string; subCategoryId?: string; subSubCategoryId?: string }[];
  categories: { id: string; name: string }[];
  subCategories: { id: string; name: string; categoryId: string }[];
  subSubCategories: { id: string; name: string; subCategoryId: string; categoryId?: string }[];
}

export interface CustomerTimeSalesItemDto {
  key: string;
  label: string;
  subLabel?: string;
  salesAmount: number;
  orderFrequency: number;
  sharePercent: number;
  products?: string[];
  productDetails?: CustomerMonthlySalesProductItemDto[];
  totalProductsCount?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  isPeak?: boolean;
}

export interface GranularitySummaryDto {
  totalPeriods: number;
  activePeriods: number;
  averageAmount: number;
  averageFrequency: number;
  peakPeriod: { label: string; amount: number; frequency: number; key?: string };
  peakFrequencyPeriod: { label: string; amount: number; frequency: number; key?: string };
  lowestPeriod: { label: string; amount: number; frequency: number; key?: string };
}

export interface CustomerSalesInvoiceItemDto {
  customerInvoiceDate: Date | string;
  bookingDate?: Date | string;
  taxableAmount?: number;
  grandTotal?: number;
  soNumber?: string;
  soId?: number;
  invoiceNumber?: string;
  items?: CustomerMonthlySalesProductItemDto[];
}

export interface CustomerMonthlySalesResponseDto {
  customerId: number;
  customerName: string;
  customerCode: string;
  customerType: string;
  customerTypeLabel: string;
  periodLabel: string;
  totalAmount: number;
  totalFrequency: number;
  averageMonthlyAmount: number;
  averageMonthlyFrequency: number;
  peakMonthAmount: { monthLabel: string; amount: number };
  lowestMonthAmount: { monthLabel: string; amount: number };
  months: CustomerMonthlySalesItemDto[];
  daily?: CustomerTimeSalesItemDto[];
  weekly?: CustomerTimeSalesItemDto[];
  yearly?: CustomerTimeSalesItemDto[];
  summaries?: {
    daily: GranularitySummaryDto;
    weekly: GranularitySummaryDto;
    monthly: GranularitySummaryDto;
    yearly: GranularitySummaryDto;
  };
  invoices?: CustomerSalesInvoiceItemDto[];
}




