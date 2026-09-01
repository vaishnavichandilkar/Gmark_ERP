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
import { CostCentreMasterService } from './cost-centre-master.service';
import { CreateCostCentreDto, UpdateCostCentreDto } from './dto/cost-centre-master.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('Cost Centre Master')
@Controller('masters/cost-centre-master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CostCentreMasterController {
    constructor(private costCentreService: CostCentreMasterService) { }

    @Get()
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'List all cost centres' })
    async findAll(@Request() req, @Query('search') search?: string) {
        const userId = req.user.effectiveAdminId;
        return this.costCentreService.findAll(userId, search);
    }

    @Get(':id')
    @RequirePermission('masters_view')
    @ApiOperation({ summary: 'Get cost centre by ID' })
    async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = req.user.effectiveAdminId;
        return this.costCentreService.findOne(id, userId);
    }

    @Post()
    @RequirePermission('masters_create')
    @ApiOperation({ summary: 'Create new cost centre' })
    async create(@Request() req, @Body() dto: CreateCostCentreDto) {
        const userId = req.user.effectiveAdminId;
        return this.costCentreService.create(dto, userId);
    }

    @Patch(':id')
    @RequirePermission('masters_edit')
    @ApiOperation({ summary: 'Update cost centre' })
    async update(
        @Request() req, 
        @Param('id', ParseIntPipe) id: number, 
        @Body() dto: UpdateCostCentreDto
    ) {
        const userId = req.user.effectiveAdminId;
        return this.costCentreService.update(id, dto, userId);
    }

    @Delete(':id')
    @RequirePermission('masters_delete')
    @ApiOperation({ summary: 'Delete cost centre' })
    async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const userId = req.user.effectiveAdminId;
        return this.costCentreService.remove(id, userId);
    }
}
