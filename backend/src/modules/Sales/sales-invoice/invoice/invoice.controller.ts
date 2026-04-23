import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, ParseIntPipe, UseInterceptors, UploadedFile, Res, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SalesInvoiceService } from './invoice.service';
import { CreateSalesInvoiceDto, UpdateSalesInvoiceDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../upload/multer.config';
import { Response } from 'express';

@ApiTags('Sales Invoices')
@Controller('sales-invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesInvoiceController {
  constructor(private readonly service: SalesInvoiceService) { }

  @Get('customers')
  @ApiOperation({ summary: 'Get list of customers from Account Master for dropdown' })
  async getCustomers(@Request() req) {
    return this.service.getCustomers(req.user.id);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Generate next available Sales Invoice number' })
  async getNextNumber(@Request() req) {
    return this.service.generateNextNumber(req.user.id);
  }

  @Get('customer-sos')
  @ApiOperation({ summary: 'Get list of SOs for a specific customer' })
  @ApiQuery({ name: 'customerId', required: true, type: String })
  @ApiQuery({ name: 'excludeInvoiceId', required: false, type: Number })
  async getCustomerSOs(@Query('customerId') customerId: string, @Query('excludeInvoiceId') excludeInvoiceId: string, @Request() req) {
    const excId = excludeInvoiceId ? parseInt(excludeInvoiceId, 10) : undefined;
    return this.service.getCustomerSOs(customerId, req.user.id, excId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Sales Invoice' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Optional invoice document' },
        customerId: { type: 'number', example: 1 },
        customerName: { type: 'string', example: 'Vaishu' },
        address: { type: 'string', example: 'H. No 4451...' },
        creditDays: { type: 'number', example: 34 },
        gstNumber: { type: 'string', example: '09AAACH...' },
        soId: { type: 'number', nullable: true },
        soNumbers: { type: 'string', description: 'JSON string of string[]' },
        challanNumbers: { type: 'string', description: 'JSON string of string[]' },
        invoiceDate: { type: 'string', format: 'date' },
        bookingDate: { type: 'string', format: 'date' },
        customerInvoiceNumber: { type: 'string' },
        customerInvoiceDate: { type: 'string', format: 'date' },
        items: { type: 'string', description: 'JSON string of SalesInvoiceItemDto[]' },
        accountSummary: { type: 'string', description: 'JSON string of SalesInvoiceAccountSummaryDto' },
        expenses: { type: 'string', description: 'JSON string of SalesInvoiceExpenseDto[]' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async create(
    @UploadedFile() file: any,
    @Body() body: any,
    @Request() req
  ) {
    const items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
    const accountSummary = typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary;
    const soNumbers = typeof body.soNumbers === 'string' ? JSON.parse(body.soNumbers) : body.soNumbers;
    const challanNumbers = typeof body.challanNumbers === 'string' ? JSON.parse(body.challanNumbers) : body.challanNumbers;
    const expenses = typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses;

    const parsedDto: CreateSalesInvoiceDto = {
      ...body,
      items,
      accountSummary,
      soNumbers,
      challanNumbers,
      expenses,
      customerId: body.customerId ? parseInt(body.customerId, 10) : 0,
      soId: (body.soId && body.soId !== 'null' && body.soId !== '') ? parseInt(body.soId, 10) : null,
      creditDays: body.creditDays ? parseInt(body.creditDays, 10) : 0,
    };

    return this.service.create(parsedDto, req.user.id, file?.path);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Sales Invoices' })
  async findAll(@Query() query: any, @Request() req) {
    return this.service.findAll({ ...query, userId: req.user.id });
  }

  @Get('sample')
  @ApiOperation({ summary: 'Download Sales Invoice Sample Excel File' })
  async downloadSample(@Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.downloadSample();
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export Sales Invoices to XLSX/PDF' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'search', required: false })
  async exportInvoices(
    @Query('format') format: string,
    @Query('search') search: string,
    @Request() req,
    @Res() res: Response
  ) {
    const { buffer, filename, mimetype } = await this.service.exportSalesInvoices(format, { search, userId: req.user.id });
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import Sales Invoices from XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importInvoices(@UploadedFile() file: any, @Request() req) {
    return this.service.importSalesInvoices(file.buffer, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Invoice details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Sales Invoice' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Update invoice document' },
        status: { type: 'string', enum: ['GENERATED', 'DELETED'] },
        customerId: { type: 'number' },
        customerName: { type: 'string' },
        address: { type: 'string' },
        creditDays: { type: 'number' },
        gstNumber: { type: 'string' },
        soId: { type: 'number', nullable: true },
        soNumbers: { type: 'string', description: 'JSON string of string[]' },
        challanNumbers: { type: 'string', description: 'JSON string of string[]' },
        invoiceDate: { type: 'string', format: 'date' },
        bookingDate: { type: 'string', format: 'date' },
        customerInvoiceNumber: { type: 'string' },
        customerInvoiceDate: { type: 'string', format: 'date' },
        items: { type: 'string', description: 'JSON string of SalesInvoiceItemDto[]' },
        expenses: { type: 'string', description: 'JSON string of SalesInvoiceExpenseDto[]' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() body: any,
    @Request() req
  ) {
    const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : undefined;
    const expenses = body.expenses ? (typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses) : undefined;

    const updateDto: UpdateSalesInvoiceDto = {
      ...body,
      items,
      expenses,
      customerId: body.customerId ? parseInt(body.customerId, 10) : undefined,
      soId: (body.soId && body.soId !== 'null' && body.soId !== '') ? parseInt(body.soId, 10) : undefined,
      creditDays: body.creditDays ? parseInt(body.creditDays, 10) : undefined,
      taxableAmount: body.taxableAmount ? parseFloat(body.taxableAmount) : undefined,
    };

    return this.service.update(id, updateDto, req.user.id, file?.path);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Sales Invoice' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.id);
  }
}
