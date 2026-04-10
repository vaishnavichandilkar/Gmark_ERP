import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ParseIntPipe, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Sales Orders')
@Controller('sales-orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesOrderController {
    constructor(private readonly service: SalesOrderService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new Sales Order' })
    @ApiResponse({ status: 201, description: 'SO created' })
    async create(@Body() createDto: CreateSalesOrderDto, @Request() req) {
        return this.service.create(createDto, req.user.userId);
    }

    @Get('next-number')
    @ApiOperation({ summary: 'Generate next available SO Number' })
    async getNextNumber() {
        return this.service.getNextNumber();
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
        @Res() res: Response
    ) {
        const { buffer, filename, mimetype } = await this.service.exportSalesOrders(format, { filter, search });
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
    async getCustomers() {
        return this.service.getCustomers();
    }

    @Get()
    @ApiOperation({ summary: 'Get all Sales Orders' })
    @ApiQuery({ name: 'filter', required: false, enum: ['all', 'pending', 'expiring', 'expired', 'completed', 'deleted'] })
    @ApiQuery({ name: 'search', required: false, type: String })
    async findAll(@Query('filter') filter?: 'all' | 'pending' | 'expiring' | 'expired' | 'completed' | 'deleted', @Query('search') search?: string) {
        return this.service.findAll({ filter, search });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get SO details by ID' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
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
    async update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateSalesOrderDto) {
        return this.service.update(id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete a Sales Order' })
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.softDelete(id);
    }
}
