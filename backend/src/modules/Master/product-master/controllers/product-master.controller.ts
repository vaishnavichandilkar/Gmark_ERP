import { Body, Controller, Get, Param, Patch, Post, Put, Delete, ParseIntPipe, UseGuards, Request, Query, Res, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductMasterService } from '../services/product-master.service';
import { CreateProductDto, UpdateProductDto, ToggleProductStatusDto } from '../dto/product.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Product Master')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductMasterController {
    constructor(private readonly service: ProductMasterService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new Product' })
    @ApiResponse({ status: 201, description: 'Product created' })
    async createProduct(@Request() req, @Body() dto: CreateProductDto) {
        return this.service.createProduct(dto, req.user.userId);
    }

    @Get('generate-code')
    @ApiOperation({ summary: 'Generate next available Product Code for the user' })
    @ApiResponse({ status: 200, description: 'Product Code generated successfully' })
    async generateCode(@Request() req) {
        return this.service.generateCodeForUser(req.user.userId);
    }

    @Get('sample')
    @ApiOperation({ summary: 'Download Sample Excel file for Products' })
    async downloadSample(@Res() res: Response) {
        const file = await this.service.downloadSample();
        res.set({
            'Content-Type': file.mimetype,
            'Content-Disposition': `attachment; filename="${file.filename}"`,
            'Content-Length': file.buffer.length,
        });
        res.send(file.buffer);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export products list to XLSX or PDF format' })
    @ApiQuery({ name: 'format', required: true, enum: ['xlsx', 'pdf'], description: 'Export format' })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'uom_id', required: false, type: Number })
    @ApiQuery({ name: 'product_type', required: false, type: String, enum: ['GOODS', 'SERVICES'] })
    @ApiQuery({ name: 'status', required: false, type: String, enum: ['ACTIVE', 'INACTIVE'] })
    async exportProducts(
        @Request() req,
        @Res() res: Response,
        @Query('format') format: string,
        @Query('search') search?: string,
        @Query('uom_id') uom_id?: number,
        @Query('product_type') product_type?: string,
        @Query('status') status?: string,
    ) {
        const query = { search, uom_id, product_type, status };
        const file = await this.service.exportProducts(format.toLowerCase(), query, req.user.userId);

        res.set({
            'Content-Type': file.mimetype,
            'Content-Disposition': `attachment; filename="${file.filename}"`,
            'Content-Length': file.buffer.length,
        });

        res.send(file.buffer);
    }

    @Get('dropdown/uoms')
    @ApiOperation({ summary: 'Get active UOMs for dropdown' })
    @ApiResponse({ status: 200, description: 'List of active UOMs' })
    async getUomDropdown(@Request() req) {
        return this.service.getUomDropdown(req.user.userId);
    }

    @Get('dropdown/categories')
    @ApiOperation({ summary: 'Get active Categories for dropdown' })
    @ApiResponse({ status: 200, description: 'List of active Categories' })
    async getCategoryDropdown(@Request() req) {
        return this.service.getCategoryDropdown(req.user.userId);
    }

    @Get('sub-categories/dropdown/:categoryId')
    @ApiOperation({ summary: 'Get active sub-categories for dropdown' })
    async getSubCategories(@Request() req, @Param('categoryId', ParseIntPipe) categoryId: number) {
        return this.service.getActiveSubCategories(categoryId, req.user.userId);
    }

    @Get('sub-sub-categories/dropdown/:subCategoryId')
    @ApiOperation({ summary: 'Get active sub-sub-categories for dropdown' })
    async getSubSubCategories(@Request() req, @Param('subCategoryId', ParseIntPipe) subCategoryId: number) {
        return this.service.getActiveSubSubCategories(subCategoryId, req.user.userId);
    }

    @Get()
    @ApiOperation({ summary: 'Get Product list with pagination, search, and filters' })
    @ApiResponse({ status: 200, description: 'Product list' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'uom_id', required: false, type: Number })
    @ApiQuery({ name: 'product_type', required: false, type: String, enum: ['GOODS', 'SERVICES'] })
    @ApiQuery({ name: 'status', required: false, type: String, enum: ['ACTIVE', 'INACTIVE'] })
    async getProducts(@Request() req, @Query() query: any) {
        return this.service.getProducts(query, req.user.userId);
    }

    @Get('tax-by-hsn')
    @ApiOperation({ summary: 'Get Tax rate by HSN Code' })
    @ApiQuery({ name: 'hsnCode', required: true, type: String })
    @ApiResponse({ status: 200, description: 'Tax rate found' })
    async getTaxByHsn(@Query('hsnCode') hsnCode: string) {
        return this.service.getTaxByHsn(hsnCode);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get single Product by ID' })
    @ApiResponse({ status: 200, description: 'Product details' })
    async getProductById(@Request() req, @Param('id', ParseIntPipe) id: number) {
        return this.service.getProductById(id, req.user.userId);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an existing Product' })
    @ApiResponse({ status: 200, description: 'Product updated' })
    async updateProduct(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateProductDto
    ) {
        return this.service.updateProduct(id, dto, req.user.userId);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Activate or Deactivate a Product' })
    @ApiResponse({ status: 200, description: 'Product status updated' })
    async toggleStatus(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ToggleProductStatusDto
    ) {
        return this.service.toggleStatus(id, dto, req.user.userId);
    }

    @Get('suggestions')
    @ApiOperation({ summary: 'Get product name suggestions' })
    @ApiQuery({ name: 'name', required: true, type: String })
    @ApiResponse({ status: 200, description: 'List of product name suggestions' })
    async getSuggestions(@Request() req, @Query('name') name: string) {
        return this.service.getProductNameSuggestions(name, req.user.userId);
    }

    @Get('check-name')
    @ApiOperation({ summary: 'Check if product name is unique' })
    @ApiQuery({ name: 'name', required: true, type: String })
    @ApiQuery({ name: 'excludeId', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Uniqueness status' })
    async checkNameUnique(
        @Request() req,
        @Query('name') name: string,
        @Query('excludeId') excludeId?: string
    ) {
        const id = excludeId ? parseInt(excludeId, 10) : undefined;
        return this.service.checkProductNameUnique(name, req.user.userId, id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete a Product' })
    @ApiResponse({ status: 200, description: 'Product deleted' })
    async deleteProduct(@Request() req, @Param('id', ParseIntPipe) id: number) {
        return this.service.deleteProduct(id, req.user.userId);
    }

    @Post('import')
    @ApiOperation({ summary: 'Import products from XLSX' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async importProducts(
        @UploadedFile() file: Express.Multer.File,
        @Request() req,
    ) {
        if (!file) {
            throw new BadRequestException('Excel file is required');
        }
        return this.service.importProducts(file.buffer, req.user.userId);
    }
}
