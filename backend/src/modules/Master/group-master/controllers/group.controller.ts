import { Body, Controller, Get, Param, Patch, Post, Put, Delete, ParseIntPipe, UseGuards, Request, UploadedFile, UseInterceptors, BadRequestException, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GroupMasterService } from '../services/group.service';
import { CreateGroupDto, UpdateGroupDto, UpdateGroupStatusDto } from '../dto/group-master.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

@ApiTags('Group Master')
@Controller('group-master')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupMasterController {
    constructor(private readonly groupService: GroupMasterService) { }

    @Get()
    @ApiOperation({ summary: 'Get all groups in hierarchical structure' })
    @ApiResponse({ status: 200, description: 'Hierarchical list of groups' })
    async getAllGroups(@Request() req) {
        return this.groupService.getAllGroups(req.user.userId);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export groups list to XLSX or PDF format' })
    async exportGroups(
        @Request() req,
        @Res() res: Response,
        @Query('format') format: string,
    ) {
        const file = await this.groupService.exportGroups(format.toLowerCase(), req.user.userId);

        res.set({
            'Content-Type': file.mimetype,
            'Content-Disposition': `attachment; filename="${file.filename}"`,
            'Content-Length': file.buffer.length,
        });

        res.send(file.buffer);
    }

    @Get('dropdown')
    @ApiOperation({ summary: 'Get groups for dropdown' })
    @ApiResponse({ status: 200, description: 'List of groups for dropdown' })
    async getDropdown(@Request() req) {
        return this.groupService.getDropdownGroups(req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new group' })
    @ApiResponse({ status: 201, description: 'Group created' })
    async createGroup(@Request() req, @Body() dto: CreateGroupDto) {
        return this.groupService.createGroup(dto, req.user.userId);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an existing group' })
    @ApiResponse({ status: 200, description: 'Group updated' })
    async updateGroup(
        @Request() req,
        @Param('id') id: string, // Accept virtual UID string
        @Body() dto: UpdateGroupDto,
    ) {
        return this.groupService.updateGroup(id, dto, req.user.userId);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Toggle group status' })
    @ApiResponse({ status: 200, description: 'Status updated' })
    async updateStatus(
        @Request() req,
        @Param('id') id: string, // Accept virtual UID string
        @Body() dto: UpdateGroupStatusDto,
    ) {
        return this.groupService.updateStatus(id, dto, req.user.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a group' })
    @ApiResponse({ status: 200, description: 'Group deleted successfully' })
    async deleteGroup(
        @Request() req,
        @Param('id') id: string, // Accept virtual UID string
    ) {
        return this.groupService.deleteGroup(id, req.user.userId);
    }

    @Get('sample-excel')
    @ApiOperation({ summary: 'Download sample Excel for group import' })
    async downloadSample(@Request() req, @Res() res: Response) {
        const buffer = await this.groupService.getSampleExcel();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="group_master_sample.xlsx"',
            'Content-Length': (buffer as any).length,
        });
        res.end(buffer);
    }

    @Post('import')
    @ApiOperation({ summary: 'Import groups from XLSX' })
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
    async importGroups(
      @UploadedFile() file: Express.Multer.File,
      @Request() req,
    ) {
      if (!file) {
        throw new BadRequestException('Excel file is required');
      }
      return this.groupService.importGroups(file.buffer, req.user.userId);
    }
}
