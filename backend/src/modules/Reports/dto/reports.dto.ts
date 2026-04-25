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
