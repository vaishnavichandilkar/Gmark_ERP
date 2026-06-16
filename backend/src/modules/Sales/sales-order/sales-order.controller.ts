import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ParseIntPipe, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../upload/multer.config';

@ApiTags('Sales Orders')
@Controller('sales-orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesOrderController {
    constructor(private readonly service: SalesOrderService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new Sales Order' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', multerConfig))
    async create(
        @UploadedFile() file: any,
        @Body() body: any,
        @Request() req
    ) {
        const items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
        const parsedDto: CreateSalesOrderDto = {
            ...body,
            items,
            customerId: body.customerId ? parseInt(body.customerId, 10) : undefined,
            creditDays: body.creditDays ? parseInt(body.creditDays, 10) : 0,
            customerAmt: (body.customerAmt !== undefined && body.customerAmt !== null && body.customerAmt !== '') ? parseFloat(body.customerAmt) : null,
            customerAmtExclTax: (body.customerAmtExclTax !== undefined && body.customerAmtExclTax !== null && body.customerAmtExclTax !== '') ? parseFloat(body.customerAmtExclTax) : null,
            customerAmtInclTax: (body.customerAmtInclTax !== undefined && body.customerAmtInclTax !== null && body.customerAmtInclTax !== '') ? parseFloat(body.customerAmtInclTax) : null,
        };
        return this.service.create(parsedDto, req.user.userId, file?.path);
    }

    @Get('next-number')
    @ApiOperation({ summary: 'Generate next available SO Number' })
    async getNextNumber(@Request() req) {
        return this.service.getNextNumber(req.user.userId);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export Sales Orders to XLSX/PDF' })
    @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
    @ApiQuery({ name: 'filter', required: false, enum: ['all', 'pending', 'expiring', 'expired', 'completed', 'deleted'] })
    @ApiQuery({ name: 'search', required: false })
    async exportOrders(
        @Query('format') format: string,
        @Query('filter') filter: any,
        @Query('search') search: string,
        @Request() req,
        @Res() res: Response
    ) {
        const { buffer, filename, mimetype } = await this.service.exportSalesOrders(req.user.userId, format, { filter, search });
        res.set({
            'Content-Type': mimetype,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.send(buffer);
    }

    @Post('import')
    @ApiOperation({ summary: 'Import Sales Orders from XLSX' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async importOrders(@UploadedFile() file: any, @Request() req) {
        return this.service.importSalesOrders(file.buffer, req.user.userId);
    }

    @Get('customers')
    @ApiOperation({ summary: 'Get list of all valid customers (where customerCode exists)' })
    async getCustomers(@Request() req) {
        return this.service.getCustomers(req.user.userId);
    }

    @Get()
    @ApiOperation({ summary: 'Get all Sales Orders' })
    @ApiQuery({ name: 'filter', required: false, enum: ['all', 'pending', 'expiring', 'expired', 'completed', 'deleted'] })
    @ApiQuery({ name: 'search', required: false, type: String })
    async findAll(@Request() req, @Query('filter') filter?: 'all' | 'pending' | 'expiring' | 'expired' | 'completed' | 'deleted', @Query('search') search?: string) {
        return this.service.findAll(req.user.userId, { filter, search });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get SO details by ID' })
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.service.findOne(id, req.user.userId);
    }

    @Get(':id/print')
    @ApiOperation({ summary: 'Preview & Print Sales Order as PDF (Opens in Browser)' })
    async printOrder(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
        const { buffer, filename, mimetype } = await this.service.printSalesOrder(id, req.user.userId);
        res.set({
            'Content-Type': mimetype,
            'Content-Disposition': `inline; filename=${filename}`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }

    @Get(':id/download')
    @ApiOperation({ summary: 'Download Sales Order as PDF File' })
    async downloadOrder(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
        const { buffer, filename, mimetype } = await this.service.printSalesOrder(id, req.user.userId);
        res.set({
            'Content-Type': mimetype,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.send(buffer);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update SO' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', multerConfig))
    async update(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: any,
        @Body() body: any,
        @Request() req
    ) {
        const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : undefined;
        const parsedDto: UpdateSalesOrderDto = {
            ...body,
            items,
            customerId: body.customerId ? parseInt(body.customerId, 10) : undefined,
            creditDays: (body.creditDays !== undefined && body.creditDays !== null && body.creditDays !== '') ? parseInt(body.creditDays, 10) : undefined,
            customerAmt: (body.customerAmt !== undefined && body.customerAmt !== null && body.customerAmt !== '') ? parseFloat(body.customerAmt) : undefined,
            customerAmtExclTax: (body.customerAmtExclTax !== undefined && body.customerAmtExclTax !== null && body.customerAmtExclTax !== '') ? parseFloat(body.customerAmtExclTax) : undefined,
            customerAmtInclTax: (body.customerAmtInclTax !== undefined && body.customerAmtInclTax !== null && body.customerAmtInclTax !== '') ? parseFloat(body.customerAmtInclTax) : undefined,
        };
        return this.service.update(id, parsedDto, req.user.userId, file?.path, body.removeAttachment === 'true');
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete a Sales Order' })
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.service.softDelete(id, req.user.userId);
    }
}
