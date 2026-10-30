import { Controller, Get, Query, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  POReportQueryDto,
  TrendQueryDto,
  ProfitLossQueryDto,
  InventoryQueryDto,
  BalanceSheetQueryDto,
  OverallSalesReportQueryDto,
  CustomerSalesReportQueryDto,
  SalesOutstandingReportQueryDto,
} from './dto/reports.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('balance-sheet')
  @RequirePermission('reports_view')
  @ApiOperation({ summary: 'Get Balance Sheet (Financial Position) report data' })
  async getBalanceSheet(@Query() query: BalanceSheetQueryDto, @Request() req) {
    return this.reportsService.getBalanceSheet(req.user.userId, query);
  }

  @Get('inventory')
  @RequirePermission('reports_view')
  @ApiOperation({ summary: 'Get Product Inventory report' })
  async getInventory(@Query() query: InventoryQueryDto, @Request() req) {
    return this.reportsService.getInventoryReport(req.user.userId, query);
  }

  @Get('profit-loss')
  @RequirePermission('reports_view')
  @ApiOperation({ summary: 'Get Trading & Profit and Loss report data' })
  async getProfitLoss(@Query() query: ProfitLossQueryDto, @Request() req) {
    return this.reportsService.getProfitLoss(req.user.userId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get total purchases, sales, net flow, and invoice count' })
  async getSummary(@Request() req) {
    return this.reportsService.getSummary(req.user.userId);
  }

  @Get('status-summary')
  @ApiOperation({ summary: 'Get grouped status counts for orders, invoices, GRN, and challans' })
  async getStatusSummary(@Request() req) {
    return this.reportsService.getStatusSummary(req.user.userId);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Get paginated list of purchase orders with optional filtering' })
  async getPurchaseOrders(@Query() query: POReportQueryDto, @Request() req) {
    return this.reportsService.getPurchaseOrders(query, req.user.userId);
  }

  @Get('financial-overview')
  @ApiOperation({ summary: 'Get aggregated financial overview over a period (daily)' })
  async getFinancialOverview(@Request() req) {
    return this.reportsService.getFinancialOverview(req.user.userId);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get time-series trends for purchases, sales, or products' })
  async getTrends(@Query() query: TrendQueryDto, @Request() req) {
    return this.reportsService.getTrends(query, req.user.userId);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get product statistics' })
  async getProducts(@Request() req) {
    return this.reportsService.getProductsReport(req.user.userId);
  }

  @Get('purchase')
  @ApiOperation({ summary: 'Get gross purchases and total tax paid' })
  async getPurchase(@Request() req) {
    return this.reportsService.getPurchaseReport(req.user.userId);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Get gross sales, net sales, taxes, discounts, orders and average order value' })
  async getSales(@Query() query: OverallSalesReportQueryDto, @Request() req) {
    const userId = req.user.userId || req.user.id;
    return this.reportsService.getSalesReport(userId, query);
  }

  @Get('customer-sales/filter-options')
  @ApiOperation({ summary: 'Get customer types, customers, products, and categories for report filters' })
  async getCustomerSalesFilterOptions(@Request() req) {
    const userId = req.user.userId || req.user.id;
    return this.reportsService.getCustomerSalesFilterOptions(userId);
  }

  @Get('customer-sales/groups')
  @ApiOperation({ summary: 'Get customer type-wise grouped sales data and summary with filters' })
  async getCustomerSalesGroups(@Query() query: CustomerSalesReportQueryDto, @Request() req) {
    const userId = req.user.userId || req.user.id;
    return this.reportsService.getCustomerSalesGroups(userId, query);
  }

  @Get('customer-sales/customer/:id/monthly')
  @ApiOperation({ summary: 'Get monthly sales amount and frequency analysis for a specific customer' })
  async getCustomerMonthlySales(
    @Param('id', ParseIntPipe) customerId: number,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('productIds') productIds: string,
    @Query('categoryIds') categoryIds: string,
    @Query('subCategoryIds') subCategoryIds: string,
    @Query('subSubCategoryIds') subSubCategoryIds: string,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.reportsService.getCustomerMonthlySales(userId, customerId, {
      dateFrom,
      dateTo,
      productIds,
      categoryIds,
      subCategoryIds,
      subSubCategoryIds,
    });
  }

  @Get('sales-outstanding')
  @ApiOperation({ summary: 'Get Sales Outstanding Aging Report with configurable slabs' })
  async getSalesOutstanding(
    @Query() query: SalesOutstandingReportQueryDto,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.reportsService.getSalesOutstandingReport(userId, query);
  }
}
