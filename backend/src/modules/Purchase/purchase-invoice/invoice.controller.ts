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
  async getNextNumber() {
    const invoiceNumber = await this.service.generateInvoiceNumber();
    return { invoiceNumber };
  }

  @Get('supplier-pos')
  @ApiOperation({ summary: 'Get list of POs for a specific supplier' })
  @ApiQuery({ name: 'supplierId', required: true, type: String })
  async getSupplierPOs(@Query('supplierId') supplierId: string, @Request() req) {
    return this.service.getSupplierPOs(supplierId, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Purchase Invoice' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePurchaseInvoiceDto,
    @Request() req
  ) {
    // Parse JSON strings from multipart/form-data
    const items = typeof dto.items === 'string' ? JSON.parse(dto.items as any) : dto.items;
    const accountSummary = typeof dto.accountSummary === 'string' ? JSON.parse(dto.accountSummary as any) : dto.accountSummary;
    const poIds = typeof dto.poIds === 'string' ? JSON.parse(dto.poIds as any) : dto.poIds;
    const challanNumbers = typeof dto.challanNumbers === 'string' ? JSON.parse(dto.challanNumbers as any) : dto.challanNumbers;

    const parsedDto: CreatePurchaseInvoiceDto = {
      ...dto,
      items,
      accountSummary,
      poIds,
      challanNumbers,
      creditDays: dto.creditDays ? parseInt(dto.creditDays as any, 10) : 0,
    };

    return this.service.create(parsedDto, req.user.id, file?.path);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Purchase Invoices' })
  async findAll() {
    return this.service.findAll();
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
    @Query('format') format: string,
    @Query('search') search: string,
    @Res() res: Response
  ) {
    const { buffer, filename, mimetype } = await this.service.exportPurchaseInvoices(format, { search });
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
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
    let items;
    if (body.items) {
      items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
    }

    const updateDto: UpdatePurchaseInvoiceDto = {
      ...body,
      items: items,
      creditDays: body.creditDays ? parseInt(body.creditDays, 10) : undefined,
      poId: body.poId ? parseInt(body.poId, 10) : undefined,
    };

    return this.service.update(id, updateDto, file?.path);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Purchase Invoice' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.id);
  }
}
