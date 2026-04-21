import { Controller, Get, Post, Put, Body, Patch, Param, Delete, Query, UseGuards, Request, ParseIntPipe, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Purchase Orders')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Purchase Order' })
  @ApiResponse({ status: 201, description: 'PO created' })
  async create(@Body() createDto: CreatePurchaseOrderDto, @Request() req) {
    return this.service.create(createDto, req.user.userId);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Generate next available PO Number' })
  async getNextNumber(@Request() req) {
    return this.service.getNextNumber(req.user.userId);
  }

  @Get('sample-excel')
  @ApiOperation({ summary: 'Download PO Sample Excel File' })
  async downloadSample(@Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.downloadSample();
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export Purchase Orders to XLSX/PDF' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'pending', 'expiring', 'expired', 'completed', 'deleted'] })
  @ApiQuery({ name: 'search', required: false })
  async exportOrders(
    @Request() req,
    @Query('format') format: string,
    @Query('filter') filter: any,
    @Query('search') search: string,
    @Res() res: Response
  ) {
    const { buffer, filename, mimetype } = await this.service.exportPurchaseOrders(req.user.userId, format, { filter, search });
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import Purchase Orders from XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importOrders(@UploadedFile() file: any, @Request() req) {
    return this.service.importPurchaseOrders(file.buffer, req.user.userId);
  }

  @Get('supplier/:id')
  @ApiOperation({ summary: 'Fetch supplier details for PO creation' })
  async getSupplierDetails(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getSupplierDetails(id, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Purchase Orders' })
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'pending', 'expiring', 'expired', 'completed', 'deleted'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Request() req, @Query('filter') filter?: 'all' | 'pending' | 'expiring' | 'expired' | 'completed' | 'deleted', @Query('search') search?: string) {
    return this.service.findAll({ filter, search }, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PO details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.userId);
  }

  @Get(':id/print')
  @ApiOperation({ summary: 'Preview & Print Purchase Order as PDF (Opens in Browser)' })
  async printOrder(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.printPurchaseOrder(id, req.user.userId);
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `inline; filename=${filename}`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download Purchase Order as PDF File' })
  async downloadOrder(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { buffer, filename, mimetype } = await this.service.printPurchaseOrder(id, req.user.userId);
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PO' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdatePurchaseOrderDto, @Request() req) {
    return this.service.update(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a Purchase Order' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.softDelete(id, req.user.userId);
  }
}
