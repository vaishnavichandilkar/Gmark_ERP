import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, ParseIntPipe, UseInterceptors, UploadedFile, Res, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ChallanService } from './challan.service';
import { SalesInvoiceService } from '../invoice/invoice.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../upload/multer.config';
import { Response } from 'express';
import { CreateChallanDto, UpdateChallanDto } from './dto/challan.dto';

@ApiTags('Challans (Customer)')
@Controller('challans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallanController {
  constructor(
    private readonly challanService: ChallanService,
    private readonly siService: SalesInvoiceService
  ) { }

  @Get('customers')
  @ApiOperation({ summary: 'Get list of customers for Challan' })
  async getCustomers(@Request() req) {
    return this.siService.getCustomers(req.user.id);
  }

  @Get('customer-sos')
  @ApiOperation({ summary: 'Get list of SOs for a specific customer (for Challan)' })
  @ApiQuery({ name: 'customerName', required: true, type: String })
  async getCustomerSOs(@Query('customerName') customerName: string, @Request() req) {
    return this.siService.getCustomerSOs(customerName, req.user.id);
  }

  @Get('customer-challans')
  @ApiOperation({ summary: 'Get list of Challan Numbers for a specific customer' })
  @ApiQuery({ name: 'customerName', required: true, type: String })
  @ApiQuery({ name: 'soNumber', required: false, type: String })
  async getCustomerChallans(
    @Query('customerName') customerName: string,
    @Query('soNumber') soNumber: string,
    @Request() req
  ) {
    return this.challanService.getCustomerChallans(customerName, req.user.id, soNumber);
  }

  @Get('product-received-qty')
  @ApiOperation({ summary: 'Get total received quantity for a product under a customer' })
  @ApiQuery({ name: 'customerName', required: true, type: String })
  @ApiQuery({ name: 'productCode', required: true, type: String })
  @ApiQuery({ name: 'soNumber', required: false, type: String })
  async getReceivedQty(
    @Query('customerName') customerName: string,
    @Query('productCode') productCode: string,
    @Query('soNumber') soNumber: string,
    @Request() req
  ) {
    return this.challanService.getReceivedQty(customerName, productCode, req.user.id, soNumber);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Challan' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateChallanDto })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async create(@UploadedFile() file: any, @Body() body: any, @Request() req) {
    // Manual parsing for multipart/form-data strings
    const items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
    const expenses = typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses;
    const accountSummary = typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary;

    const createDto: CreateChallanDto = {
      ...body,
      items,
      expenses,
      accountSummary,
      customerId: body.customerId ? parseInt(body.customerId, 10) : 0,
      soId: (body.soId && body.soId !== 'null' && body.soId !== '') ? parseInt(body.soId, 10) : undefined,
      creditDays: body.creditDays ? parseInt(body.creditDays, 10) : 0,
      grandTotal: body.grandTotal ? parseFloat(body.grandTotal) : 0,
    };

    return this.challanService.create(createDto, req.user.id, file?.path);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Sales Challans' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query() query: any, @Request() req) {
    return this.challanService.findAll({ ...query, userId: req.user.id });
  }

  @Get('sample')
  @ApiOperation({ summary: 'Download Sales Challan Sample Excel File' })
  async downloadSample(@Res() res: Response) {
    const { buffer, filename, mimetype } = await this.challanService.downloadSample();
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import Sales Challans from XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importChallans(@UploadedFile() file: any, @Request() req) {
    return this.challanService.importChallans(file.buffer, req.user.id);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export Challans to XLSX/PDF' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'search', required: false })
  async export(@Query('format') format: string, @Query('search') search: string, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.challanService.exportChallans(format, { search, userId: req.user.id });
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `attachment; filename=${filename}`, 'Content-Length': buffer.length });
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Challan details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.challanService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Challan' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateChallanDto })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() body: any,
    @Request() req,
  ) {
    const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : undefined;
    const expenses = body.expenses ? (typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses) : undefined;
    const accountSummary = body.accountSummary ? (typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary) : undefined;

    const updateDto: UpdateChallanDto = {
      ...body,
      items,
      expenses,
      accountSummary,
      customerId: (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') ? parseInt(body.customerId, 10) : undefined,
      soId: (body.soId && body.soId !== 'null' && body.soId !== '') ? parseInt(body.soId, 10) : undefined,
      creditDays: (body.creditDays !== undefined && body.creditDays !== null && body.creditDays !== '') ? parseInt(body.creditDays, 10) : undefined,
      grandTotal: body.grandTotal ? parseFloat(body.grandTotal) : undefined,
    };

    return this.challanService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Challan' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.challanService.remove(id, req.user.id);
  }

  @Get(':id/print')
  @ApiOperation({ summary: 'Preview & Print Challan' })
  async print(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.challanService.printChallan(id, req.user.id);
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `inline; filename=${filename}` });
    res.send(buffer);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download Challan as PDF' })
  async download(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.challanService.printChallan(id, req.user.id);
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `attachment; filename=${filename}` });
    res.send(buffer);
  }
}
