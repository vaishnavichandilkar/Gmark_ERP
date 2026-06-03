import { Controller, Get, Post, Body, Put, Param, Delete, Patch, Query, UseGuards, Request, Res, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { HsnMasterService } from './hsn-master.service';
import { CreateHsnMasterDto, UpdateHsnMasterDto, HsnQueryDto } from './dto/hsn-master.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('HSN Master')
@Controller('hsn-master')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class HsnMasterController {
    constructor(private readonly service: HsnMasterService) { }

    @Post()
    @RequirePermission('HSN_MASTER_CREATE')
    @ApiOperation({ summary: 'Create HSN Master record' })
    async createHsnMaster(@Request() req, @Body() dto: CreateHsnMasterDto) {
        return this.service.createHsnMaster(req.user.userId, dto);
    }

    @Get()
    @RequirePermission('HSN_MASTER_VIEW')
    @ApiOperation({ summary: 'Get paginated list of HSN Master records with filters' })
    async getHsnMasterList(@Request() req, @Query() query: HsnQueryDto) {
        return this.service.getHsnMasterList(req.user.userId, query);
    }

    @Get('dropdown')
    @RequirePermission('HSN_MASTER_VIEW')
    @ApiOperation({ summary: 'Get lightweight list for dropdowns' })
    async getHsnDropdown(@Request() req) {
        return this.service.getHsnDropdown(req.user.userId);
    }

    @Get('lookup')
    @RequirePermission('HSN_MASTER_VIEW')
    @ApiOperation({ summary: 'Get lightweight lookup list for Product Master selection' })
    async getHsnLookup(@Request() req) {
        return this.service.getHsnLookup(req.user.userId);
    }

    @Get('export')
    @RequirePermission('HSN_MASTER_EXPORT')
    @ApiOperation({ summary: 'Export HSN Master list to XLSX or PDF' })
    async exportHsnMaster(
        @Request() req,
        @Res() res: Response,
        @Query('format') format: string,
        @Query() query: HsnQueryDto
    ) {
        if (!format) {
            throw new BadRequestException('Format (xlsx or pdf) is required');
        }
        const file = await this.service.exportHsnMaster(req.user.userId, format, query);

        res.set({
            'Content-Type': file.mimetype,
            'Content-Disposition': `attachment; filename="${file.filename}"`,
            'Content-Length': file.buffer.length,
        });

        res.send(file.buffer);
    }

    @Get('sample')
    @RequirePermission('HSN_MASTER_VIEW')
    @ApiOperation({ summary: 'Download sample Excel for HSN import' })
    async downloadSample(@Res() res: Response) {
        const buffer = await this.service.getSampleExcel();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="hsn_master_sample.xlsx"',
            'Content-Length': (buffer as any).length,
        });
        res.end(buffer);
    }

    @Post('import')
    @RequirePermission('HSN_MASTER_CREATE')
    @ApiOperation({ summary: 'Import HSN records from XLSX' })
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
    async importHsnMaster(
        @UploadedFile() file: Express.Multer.File,
        @Request() req
    ) {
        if (!file) {
            throw new BadRequestException('Excel file is required');
        }
        return this.service.importHsnMaster(file.buffer, req.user.userId);
    }

    @Get(':id')
    @RequirePermission('HSN_MASTER_VIEW')
    @ApiOperation({ summary: 'Get HSN Master record by ID' })
    async getHsnMasterById(@Request() req, @Param('id') id: string) {
        return this.service.getHsnMasterById(id, req.user.userId);
    }

    @Put(':id')
    @RequirePermission('HSN_MASTER_EDIT')
    @ApiOperation({ summary: 'Update HSN Master record' })
    async updateHsnMaster(
        @Param('id') id: string,
        @Request() req,
        @Body() dto: UpdateHsnMasterDto
    ) {
        return this.service.updateHsnMaster(id, req.user.userId, dto);
    }

    @Delete(':id')
    @RequirePermission('HSN_MASTER_DELETE')
    @ApiOperation({ summary: 'Delete HSN Master record' })
    async deleteHsnMaster(@Request() req, @Param('id') id: string) {
        return this.service.deleteHsnMaster(id, req.user.userId);
    }

    @Patch(':id/status')
    @RequirePermission('HSN_MASTER_EDIT')
    @ApiOperation({ summary: 'Toggle HSN Master active status' })
    async toggleStatus(
        @Param('id') id: string,
        @Request() req,
        @Body('isActive') isActive: boolean
    ) {
        if (isActive === undefined) {
            throw new BadRequestException('isActive boolean field is required');
        }
        return this.service.toggleStatus(id, req.user.userId, isActive);
    }
}
