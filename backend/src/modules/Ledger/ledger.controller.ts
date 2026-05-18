import { Controller, Get, Query, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto/ledger.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @UseGuards(JwtAuthGuard)
  @Get('creditors')
  async getCreditors(@Query() query: LedgerQueryDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.id || 1;
    return this.ledgerService.getCreditorsSummary(query, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('debtors')
  async getDebtors(@Query() query: LedgerQueryDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.id || 1;
    return this.ledgerService.getDebtorsSummary(query, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bank-cash')
  async getBankCash(@Query() query: LedgerQueryDto, @Request() req: any) {
    const userId = req.user?.userId || req.user?.id || 1;
    return this.ledgerService.getBankCashSummary(query, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bank-cash-accounts')
  async getBankCashAccounts(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id || 1;
    return this.ledgerService.getBankCashAccountsForDropdown(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDetailed(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.id || 1;
    return this.ledgerService.getDetailedLedger(
      id, 
      userId, 
      startDate, 
      endDate, 
      type, 
      page ? parseInt(page, 10) : 1, 
      limit ? parseInt(limit, 10) : 14
    );
  }
}
