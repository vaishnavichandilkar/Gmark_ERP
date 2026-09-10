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
    Request 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentMasterService } from './department-master.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department-master.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('Department Master')
@Controller('masters/department-master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DepartmentMasterController {
    constructor(private departmentService: DepartmentMasterService) { }

    private getUserId(req: any): number {
        const id = req.user?.effectiveAdminId ?? req.user?.userId ?? req.user?.id ?? req.user?.actualUserId;
        return Number(id) || 1;
    }

    @Get()
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'List all departments' })
    async findAll(@Request() req, @Query('search') search?: string) {
        const userId = this.getUserId(req);
        return this.departmentService.findAll(userId, search);
    }

    @Get(':id')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get department by ID' })
    async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.departmentService.findOne(id, userId);
    }

    @Post()
    @RequirePermission('masters_create')
    @ApiOperation({ summary: 'Create new department' })
    async create(@Request() req, @Body() dto: CreateDepartmentDto) {
        const userId = this.getUserId(req);
        return this.departmentService.create(dto, userId);
    }

    @Patch(':id')
    @RequirePermission('masters_edit')
    @ApiOperation({ summary: 'Update department' })
    async update(
        @Request() req, 
        @Param('id', ParseIntPipe) id: number, 
        @Body() dto: UpdateDepartmentDto
    ) {
        const userId = this.getUserId(req);
        return this.departmentService.update(id, dto, userId);
    }

    @Delete(':id')
    @RequirePermission('masters_delete')
    @ApiOperation({ summary: 'Delete department' })
    async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.departmentService.remove(id, userId);
    }
}
