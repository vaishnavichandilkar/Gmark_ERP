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
import { ShiftMasterService } from './shift-master.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift-master.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('Shift Master')
@Controller('masters/shift-master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShiftMasterController {
    constructor(private shiftService: ShiftMasterService) { }

    private getUserId(req: any): number {
        const id = req.user?.effectiveAdminId ?? req.user?.userId ?? req.user?.id ?? req.user?.actualUserId;
        return Number(id) || 1;
    }

    @Get()
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'List all shifts' })
    async findAll(@Request() req, @Query('search') search?: string) {
        const userId = this.getUserId(req);
        return this.shiftService.findAll(userId, search);
    }

    @Get(':id')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get shift by ID' })
    async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.shiftService.findOne(id, userId);
    }

    @Post()
    @RequirePermission('masters_create')
    @ApiOperation({ summary: 'Create new shift' })
    async create(@Request() req, @Body() dto: CreateShiftDto) {
        const userId = this.getUserId(req);
        return this.shiftService.create(dto, userId);
    }

    @Patch(':id')
    @RequirePermission('masters_edit')
    @ApiOperation({ summary: 'Update shift' })
    async update(
        @Request() req, 
        @Param('id', ParseIntPipe) id: number, 
        @Body() dto: UpdateShiftDto
    ) {
        const userId = this.getUserId(req);
        return this.shiftService.update(id, dto, userId);
    }

    @Delete(':id')
    @RequirePermission('masters_delete')
    @ApiOperation({ summary: 'Delete shift' })
    async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = this.getUserId(req);
        return this.shiftService.remove(id, userId);
    }
}
