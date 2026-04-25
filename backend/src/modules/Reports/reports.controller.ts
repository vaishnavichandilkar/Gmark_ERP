import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  POReportQueryDto,
  TrendQueryDto,
} from './dto/reports.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
  @ApiOperation({ summary: 'Get gross sales and total tax collected' })
  async getSales(@Request() req) {
    return this.reportsService.getSalesReport(req.user.userId);
  }
}
