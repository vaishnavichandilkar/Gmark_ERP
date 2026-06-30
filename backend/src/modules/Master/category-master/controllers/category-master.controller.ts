import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Request, Res, UploadedFile, UseInterceptors, BadRequestException, Delete } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoryMasterService } from '../services/category-master.service';
import { CreateCategoryDto, CreateSubCategoryDto, CreateSubSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto, UpdateSubSubCategoryDto, MoveCategoryDto } from '../dto/category.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

@ApiTags('Category Master')
@Controller('category-master')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoryMasterController {
    constructor(private readonly service: CategoryMasterService) { }

    @Post('category')
    @ApiOperation({ summary: 'Create a new Category' })
    @ApiResponse({ status: 201, description: 'Category created' })
    async createCategory(@Request() req, @Body() dto: CreateCategoryDto) {
        return this.service.createCategory(dto, req.user.userId);
    }

    @Post('sub-category')
    @ApiOperation({ summary: 'Create a new Sub Category' })
    @ApiResponse({ status: 201, description: 'Sub Category created' })
    async createSubCategory(@Request() req, @Body() dto: CreateSubCategoryDto) {
        return this.service.createSubCategory(dto, req.user.userId);
    }

    @Post('sub-sub-category')
    @ApiOperation({ summary: 'Create a new Sub Sub Category' })
    @ApiResponse({ status: 201, description: 'Sub Sub Category created' })
    async createSubSubCategory(@Request() req, @Body() dto: CreateSubSubCategoryDto) {
        return this.service.createSubSubCategory(dto, req.user.userId);
    }

    @Get('categories/dropdown')
    @ApiOperation({ summary: 'Get Categories for dropdown' })
    @ApiResponse({ status: 200, description: 'List of Categories' })
    async getDropdown(
        @Request() req,
        @Query('excludeId') excludeId?: string,
    ) {
        return this.service.getCategoriesForDropdown(
            req.user.userId,
            excludeId,
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get Category with Sub Categories listing' })
    @ApiResponse({ status: 200, description: 'Nested Category list' })
    async getListing(@Request() req) {
        return this.service.getCategoryListing(req.user.userId);
    }

    @Patch('category/:id/status')
    @ApiOperation({ summary: 'Toggle Category status' })
    @ApiResponse({ status: 200, description: 'Category status updated' })
    async toggleCategoryStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ToggleStatusDto,
    ) {
        return this.service.toggleCategoryStatus(id, dto, req.user.userId);
    }

    @Patch('sub-category/:id/status')
    @ApiOperation({ summary: 'Toggle Sub Category status' })
    @ApiResponse({ status: 200, description: 'Sub Category status updated' })
    async toggleSubCategoryStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ToggleStatusDto,
    ) {
        return this.service.toggleSubCategoryStatus(id, dto, req.user.userId);
    }

    @Patch('sub-sub-category/:id/status')
    @ApiOperation({ summary: 'Toggle Sub Sub Category status' })
    @ApiResponse({ status: 200, description: 'Sub Sub Category status updated' })
    async toggleSubSubCategoryStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ToggleStatusDto,
    ) {
        return this.service.toggleSubSubCategoryStatus(id, dto, req.user.userId);
    }

    @Patch('category/:id')
    @ApiOperation({ summary: 'Update Category name' })
    @ApiResponse({ status: 200, description: 'Category updated' })
    async updateCategory(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.service.updateCategory(id, dto, req.user.userId);
    }

    @Patch('sub-category/:id')
    @ApiOperation({ summary: 'Update Sub Category name' })
    @ApiResponse({ status: 200, description: 'Sub Category updated' })
    async updateSubCategory(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: UpdateSubCategoryDto,
    ) {
        return this.service.updateSubCategory(id, dto, req.user.userId);
    }

    @Patch('sub-sub-category/:id')
    @ApiOperation({ summary: 'Update Sub Sub Category' })
    @ApiResponse({ status: 200, description: 'Sub Sub Category updated' })
    async updateSubSubCategory(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: UpdateSubSubCategoryDto,
    ) {
        return this.service.updateSubSubCategory(id, dto, req.user.userId);
    }

    @Post('import')
    @ApiOperation({ summary: 'Import categories from XLSX' })
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
    async importCategories(
        @UploadedFile() file: Express.Multer.File,
        @Request() req,
    ) {
        if (!file) {
            throw new BadRequestException('Excel file is required');
        }
        return this.service.importCategories(file.buffer, req.user.userId);
    }

    @Patch(':id/move')
    @ApiOperation({ summary: 'Relocate category and entire subtree' })
    async moveCategory(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: MoveCategoryDto,
    ) {
        return this.service.moveCategory(id, dto, req.user.userId);
    }

    @Get(':id/move-options')
    @ApiOperation({ summary: 'Get eligible parent destinations' })
    async getMoveOptions(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.service.getMoveOptions(id, req.user.userId);
    }

    @Post('sub-category/:id/promote')
    @ApiOperation({ summary: 'Promote Sub Category to main Category' })
    async promoteSubCategory(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.service.promoteSubCategory(id, req.user.userId);
    }

    @Post('category/:id/demote/:newParentId')
    @ApiOperation({ summary: 'Demote Category to Sub Category' })
    @ApiResponse({ status: 200, description: 'Category demoted to Sub Category' })
    async demoteCategory(
        @Request() req,
        @Param('id') id: string,
        @Param('newParentId') newParentId: string,
    ) {
        return this.service.demoteCategory(id, newParentId, req.user.userId);
    }

    @Post('category/:id/demote-to-sub-sub/:subId')
    @ApiOperation({ summary: 'Demote Category to Sub Sub Category' })
    @ApiResponse({ status: 200, description: 'Category demoted to Sub Sub Category' })
    async demoteCategoryToSubSub(
        @Request() req,
        @Param('id') id: string,
        @Param('subId') subId: string,
    ) {
        return this.service.demoteCategoryToSubSubCategory(id, subId, req.user.userId);
    }

    @Post('sub-category/:id/demote-to-sub-sub/:subId')
    @ApiOperation({ summary: 'Demote Sub Category to Sub Sub Category' })
    @ApiResponse({ status: 200, description: 'Sub Category demoted to Sub Sub Category' })
    async demoteSubCategoryToSubSub(
        @Request() req,
        @Param('id') id: string,
        @Param('subId') subId: string,
    ) {
        return this.service.demoteSubCategoryToSubSub(id, subId, req.user.userId);
    }

    @Post('sub-sub-category/:id/promote-to-sub/:newParentCatId')
    @ApiOperation({ summary: 'Promote Sub Sub Category to Sub Category' })
    @ApiResponse({ status: 200, description: 'Sub Sub Category promoted to Sub Category' })
    async promoteSubSubToSub(
        @Request() req,
        @Param('id') id: string,
        @Param('newParentCatId') newParentCatId: string,
    ) {
        return this.service.promoteSubSubToSub(id, newParentCatId, req.user.userId);
    }

    @Post('sub-sub-category/:id/promote-to-category')
    @ApiOperation({ summary: 'Promote Sub Sub Category to Category' })
    @ApiResponse({ status: 200, description: 'Sub Sub Category promoted to Category' })
    async promoteSubSubToCategory(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.service.promoteSubSubToCategory(id, req.user.userId);
    }

    @Get('sample')
    @ApiOperation({ summary: 'Download Sample Excel file for Categories' })
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
    @ApiOperation({ summary: 'Export categories list to XLSX or PDF format' })
    async exportCategories(
        @Request() req,
        @Res() res: Response,
        @Query('format') format: string,
    ) {
        const file = await this.service.exportCategories(format.toLowerCase(), req.user.userId);

        res.set({
            'Content-Type': file.mimetype,
            'Content-Disposition': `attachment; filename="${file.filename}"`,
            'Content-Length': file.buffer.length,
        });

        res.send(file.buffer);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a Category' })
    @ApiResponse({ status: 200, description: 'Category deleted' })
    async deleteCategory(@Request() req, @Param('id') id: string) {
        return this.service.deleteCategory(id, req.user.userId);
    }
}
