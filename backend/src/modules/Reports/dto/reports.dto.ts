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
  totalTaxCollected: number;
  completedSales: number;
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


