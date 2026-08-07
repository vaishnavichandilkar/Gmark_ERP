import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, ParseIntPipe, UseInterceptors, UploadedFile, Res, Delete, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { PurchaseInvoiceService } from './invoice.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto } from './invoice/dto/invoice.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../upload/multer.config';
import { Response } from 'express';

@ApiTags('Purchase Invoices')
@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PurchaseInvoiceController {
  constructor(private readonly service: PurchaseInvoiceService) { }

  @Get('suppliers')
  @ApiOperation({ summary: 'Get list of suppliers from Account Master for dropdown' })
  async getSuppliers(@Request() req) {
    return this.service.getSuppliers(req.user.id);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Generate next available Purchase Invoice number' })
  async getNextNumber(@Request() req) {
    const invoiceNumber = await this.service.generateInvoiceNumber(req.user.id);
    return { invoiceNumber };
  }

  @Get('supplier-pos')
  @ApiOperation({ summary: 'Get list of POs for a specific supplier' })
  @ApiQuery({ name: 'supplierId', required: true, type: String })
  @ApiQuery({ name: 'excludeInvoiceId', required: false, type: Number })
  async getSupplierPOs(@Query('supplierId') supplierId: string, @Query('excludeInvoiceId') excludeInvoiceId: string, @Request() req) {
    const excId = excludeInvoiceId ? parseInt(excludeInvoiceId, 10) : undefined;
    return this.service.getSupplierPOs(supplierId, req.user.id, excId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Purchase Invoice' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Request() req
  ) {
    // Parse JSON strings from multipart/form-data
    const items = typeof body.items === 'string' ? JSON.parse(body.items as any) : body.items;
    const accountSummary = typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary as any) : body.accountSummary;
    const poIds = typeof body.poIds === 'string' ? JSON.parse(body.poIds as any) : body.poIds;
    const challanNumbers = typeof body.challanNumbers === 'string' ? JSON.parse(body.challanNumbers as any) : body.challanNumbers;
    const expenses = typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses;

    const parsedDto: CreatePurchaseInvoiceDto = {
      ...body,
      items,
      accountSummary,
      poIds,
      challanNumbers,
      expenses,
      creditDays: body.creditDays ? parseInt(body.creditDays as any, 10) : 0,
    };

    return this.service.create(parsedDto, req.user.id, file?.path ? file.path.replace(/\\/g, '/') : undefined);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Purchase Invoices' })
  async findAll(@Query() query: any, @Request() req) {
    return this.service.findAll({ ...query, userId: req.user.id });
  }

  @Get('sample-excel')
  @ApiOperation({ summary: 'Download PI Sample Excel File' })
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
  @ApiOperation({ summary: 'Export Purchase Invoices to XLSX/PDF' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'search', required: false })
  async exportInvoices(
    @Request() req,
    @Query('format') format: string,
    @Query('search') search: string,
    @Res() res: Response
  ) {
    const { buffer, filename, mimetype } = await this.service.exportPurchaseInvoices(req.user.id, format, { search });
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import Purchase Invoices from XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importInvoices(@UploadedFile() file: any, @Request() req) {
    return this.service.importPurchaseInvoices(file.buffer, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Invoice details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.id);
  }

  @Get(':id/print')
  @ApiOperation({ summary: 'Preview & Print Purchase Invoice as PDF (Opens in Browser)' })
  async printInvoice(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.printPurchaseInvoice(id, req.user.id);
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `inline; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download Purchase Invoice as PDF File' })
  async downloadInvoice(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.printPurchaseInvoice(id, req.user.id);
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Purchase Invoice with multipart support' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        supplierInvoiceNumber: { type: 'string' },
        supplierInvoiceDate: { type: 'string', format: 'date' },
        bookingDate: { type: 'string', format: 'date' },
        supplierName: { type: 'string' },
        address: { type: 'string' },
        poNumber: { type: 'string' },
        challanNumber: { type: 'string' },
        creditDays: { type: 'integer' },
        poId: { type: 'integer' },
        items: { type: 'string', description: 'JSON string of UpdatePurchaseInvoiceItemDto[]' },
        file: { type: 'string', format: 'binary' },
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
    const accountSummary = body.accountSummary ? (typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary) : undefined;
    const poIds = body.poIds ? (typeof body.poIds === 'string' ? JSON.parse(body.poIds) : body.poIds) : undefined;
    const challanNumbers = body.challanNumbers ? (typeof body.challanNumbers === 'string' ? JSON.parse(body.challanNumbers) : body.challanNumbers) : undefined;

    const updateDto: UpdatePurchaseInvoiceDto = {
      ...body,
      items,
      expenses,
      accountSummary,
      poIds,
      challanNumbers,
      creditDays: (body.creditDays !== undefined && body.creditDays !== null && body.creditDays !== '') ? parseInt(body.creditDays, 10) : undefined,
      poId: body.poId ? parseInt(body.poId, 10) : undefined,
    };

    return this.service.update(id, updateDto, req.user.id, file?.path ? file.path.replace(/\\/g, '/') : undefined);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Purchase Invoice' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.id);
  }
}
