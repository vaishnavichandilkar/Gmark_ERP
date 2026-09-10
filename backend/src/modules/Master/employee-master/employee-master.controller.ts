import { 
    Controller, 
    Get, 
    Post, 
    Patch, 
    Delete, 
    Body, 
    Param, 
    Query, 
    ParseIntPipe, 
    UseGuards, 
    Request,
    UseInterceptors,
    UploadedFiles
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { EmployeeMasterService } from './employee-master.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee-master.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('Employee Master')
@Controller('masters/employee-master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeMasterController {
    constructor(private employeeService: EmployeeMasterService) { }

    private getUserId(req: any): number {
        const id = req.user?.effectiveAdminId ?? req.user?.userId ?? req.user?.id ?? req.user?.actualUserId;
        return Number(id) || 1;
    }

    @Get('next-code')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get auto-generated next employee code' })
    async getNextCode(@Request() req) {
        const userId = this.getUserId(req);
        const code = await this.employeeService.generateNextCode(userId);
        return { employeeCode: code };
    }

    @Get('reporting-list')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get reporting manager list for dropdown' })
    async getReportingList(@Request() req) {
        const userId = this.getUserId(req);
        return this.employeeService.getReportingList(userId);
    }

    @Get()
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'List all active employees' })
    async findAll(
        @Request() req,
        @Query('search') search?: string,
        @Query('department') department?: string,
    ) {
        const userId = this.getUserId(req);
        return this.employeeService.findAll(userId, { search, department });
    }

    @Get(':id')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get employee details by ID' })
    async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.employeeService.findOne(id, userId);
    }

    @Post()
    @RequirePermission('masters_create')
    @ApiOperation({ summary: 'Create a new employee record' })
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'aadhaarDoc', maxCount: 1 },
        { name: 'panDoc', maxCount: 1 },
        { name: 'esicDoc', maxCount: 1 },
        { name: 'uanDoc', maxCount: 1 },
    ]))
    async create(
        @Request() req, 
        @Body() dto: CreateEmployeeDto,
        @UploadedFiles() files?: {
            aadhaarDoc?: Express.Multer.File[];
            panDoc?: Express.Multer.File[];
            esicDoc?: Express.Multer.File[];
            uanDoc?: Express.Multer.File[];
        }
    ) {
        const userId = this.getUserId(req);

        if (files) {
            if (files.aadhaarDoc?.[0]) dto.aadhaarDocUrl = files.aadhaarDoc[0].path || files.aadhaarDoc[0].filename;
            if (files.panDoc?.[0]) dto.panDocUrl = files.panDoc[0].path || files.panDoc[0].filename;
            if (files.esicDoc?.[0]) dto.esicDocUrl = files.esicDoc[0].path || files.esicDoc[0].filename;
            if (files.uanDoc?.[0]) dto.uanDocUrl = files.uanDoc[0].path || files.uanDoc[0].filename;
        }

        return this.employeeService.create(dto, userId);
    }

    @Patch(':id')
    @RequirePermission('masters_edit')
    @ApiOperation({ summary: 'Update an existing employee record' })
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'aadhaarDoc', maxCount: 1 },
        { name: 'panDoc', maxCount: 1 },
        { name: 'esicDoc', maxCount: 1 },
        { name: 'uanDoc', maxCount: 1 },
    ]))
    async update(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEmployeeDto,
        @UploadedFiles() files?: {
            aadhaarDoc?: Express.Multer.File[];
            panDoc?: Express.Multer.File[];
            esicDoc?: Express.Multer.File[];
            uanDoc?: Express.Multer.File[];
        }
    ) {
        const userId = this.getUserId(req);

        if (files) {
            if (files.aadhaarDoc?.[0]) dto.aadhaarDocUrl = files.aadhaarDoc[0].path || files.aadhaarDoc[0].filename;
            if (files.panDoc?.[0]) dto.panDocUrl = files.panDoc[0].path || files.panDoc[0].filename;
            if (files.esicDoc?.[0]) dto.esicDocUrl = files.esicDoc[0].path || files.esicDoc[0].filename;
            if (files.uanDoc?.[0]) dto.uanDocUrl = files.uanDoc[0].path || files.uanDoc[0].filename;
        }

        return this.employeeService.update(id, dto, userId);
    }

    @Delete(':id')
    @RequirePermission('masters_delete')
    @ApiOperation({ summary: 'Deactivate / remove an employee record' })
    async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.employeeService.remove(id, userId);
    }

    @Post(':id/create-user')
    @RequirePermission('masters_edit')
    @ApiOperation({ summary: 'Create or update user login account for employee with default password' })
    async createUserForEmployee(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.employeeService.createUserForEmployee(id, userId);
    }
}
