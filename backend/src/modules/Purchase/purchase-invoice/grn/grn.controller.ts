import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, ParseIntPipe, UseInterceptors, UploadedFile, Res, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { GrnService } from './grn.service';
import { PurchaseInvoiceService } from '../invoice.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../upload/multer.config';
import { Response } from 'express';
import { CreateGrnDto, UpdateGrnDto } from './dto/grn.dto';

@ApiTags('Goods Receipt Note (GRN)')
@Controller('grn')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GrnController {
  constructor(
    private readonly grnService: GrnService,
    private readonly piService: PurchaseInvoiceService
  ) { }

  @Get('suppliers')
  @ApiOperation({ summary: 'Get list of suppliers for GRN' })
  async getSuppliers(@Request() req) {
    return this.piService.getSuppliers(req.user.id);
  }

  @Get('supplier-pos')
  @ApiOperation({ summary: 'Get list of POs for a specific supplier (for GRN)' })
  @ApiQuery({ name: 'supplierName', required: true, type: String })
  async getSupplierPOs(@Query('supplierName') supplierName: string, @Request() req) {
    return this.piService.getSupplierPOs(supplierName, req.user.id);
  }

  @Get('supplier-challans')
  @ApiOperation({ summary: 'Get list of Challan Numbers for a specific supplier' })
  @ApiQuery({ name: 'supplierName', required: true, type: String })
  async getSupplierChallans(@Query('supplierName') supplierName: string, @Request() req) {
    return this.grnService.getSupplierChallans(supplierName, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new GRN' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateGrnDto })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async create(@UploadedFile() file: any, @Body() body: any, @Request() req) {
    // Manual parsing for multipart/form-data strings
    const items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
    const accounts = typeof body.accounts === 'string' ? JSON.parse(body.accounts) : body.accounts;
    const accountSummary = typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary;

    const createDto: CreateGrnDto = {
      ...body,
      items,
      accounts,
      accountSummary,
      creditDays: body.creditDays ? parseInt(body.creditDays, 10) : 0,
      poId: body.poId ? parseInt(body.poId, 10) : undefined,
      grandTotal: body.grandTotal ? parseFloat(body.grandTotal) : 0,
    };

    return this.grnService.create(createDto, req.user.id, file?.path);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Goods Receipt Notes' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  async findAll(@Request() req, @Query('search') search?: string, @Query('supplierId') supplierId?: string) {
    return this.grnService.findAll({ search, supplierId, userId: req.user.id });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export GRNs to XLSX/PDF' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'search', required: false })
  async export(@Query('format') format: string, @Query('search') search: string, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.grnService.exportGrns(format, { search, userId: req.user.id });
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `attachment; filename=${filename}`, 'Content-Length': buffer.length });
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get GRN details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.grnService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update GRN' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateGrnDto })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : undefined;
    const accounts = body.accounts ? (typeof body.accounts === 'string' ? JSON.parse(body.accounts) : body.accounts) : undefined;
    const accountSummary = body.accountSummary ? (typeof body.accountSummary === 'string' ? JSON.parse(body.accountSummary) : body.accountSummary) : undefined;

    const updateDto: UpdateGrnDto = {
      ...body,
      items,
      accounts,
      accountSummary,
      creditDays: (body.creditDays !== undefined && body.creditDays !== null && body.creditDays !== '') ? parseInt(body.creditDays, 10) : undefined,
      poId: body.poId ? parseInt(body.poId, 10) : undefined,
      grandTotal: body.grandTotal ? parseFloat(body.grandTotal) : undefined,
    };

    return this.grnService.update(id, updateDto, file?.path);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete GRN' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.grnService.remove(id, req.user.id);
  }

  @Get(':id/print')
  @ApiOperation({ summary: 'Preview & Print GRN' })
  async print(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.grnService.printGrn(id, req.user.id);
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `inline; filename=${filename}` });
    res.send(buffer);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download GRN as PDF' })
  async download(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.grnService.printGrn(id, req.user.id);
    res.set({ 'Content-Type': mimetype, 'Content-Disposition': `attachment; filename=${filename}` });
    res.send(buffer);
  }
}
