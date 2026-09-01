import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/user-management.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('User Management')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UserManagementController {
    constructor(private userManagementService: UserManagementService) { }

    private verifyAdminRole(req: any) {
        const role = (req.user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'SELLER' && role !== 'SUPERADMIN') {
            throw new ForbiddenException('Only Admin users can manage organization users');
        }
    }

    @Post()
    @ApiOperation({ summary: 'Create a sub-user under Admin organization' })
    @ApiResponse({ status: 201, description: 'User created successfully.' })
    async createUser(@Request() req, @Body() dto: CreateUserDto) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.createUser(adminId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get list of users belonging to authenticated Admin' })
    @ApiResponse({ status: 200, description: 'Returns list of users.' })
    async getUsers(@Request() req) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.getUsersForAdmin(adminId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get user details by ID' })
    @ApiResponse({ status: 200, description: 'Returns user details.' })
    async getUserDetails(@Request() req, @Param('id', ParseIntPipe) id: number) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.getUserDetails(adminId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update user details' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    async updateUser(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateUserDto,
    ) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.updateUser(adminId, id, dto);
    }

    @Patch(':id/activate')
    @ApiOperation({ summary: 'Activate a user' })
    @ApiResponse({ status: 200, description: 'User activated successfully.' })
    async activateUser(@Request() req, @Param('id', ParseIntPipe) id: number) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.setStatus(adminId, id, 'ACTIVE');
    }

    @Patch(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiResponse({ status: 200, description: 'User deactivated successfully.' })
    async deactivateUser(@Request() req, @Param('id', ParseIntPipe) id: number) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.setStatus(adminId, id, 'INACTIVE');
    }

    @Patch(':id/reset-password')
    @ApiOperation({ summary: 'Reset user password' })
    @ApiResponse({ status: 200, description: 'Password reset successfully.' })
    async resetPassword(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ResetPasswordDto,
    ) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.resetPassword(adminId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete/deactivate user' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    async deleteUser(@Request() req, @Param('id', ParseIntPipe) id: number) {
        this.verifyAdminRole(req);
        const adminId = req.user.effectiveAdminId;
        return this.userManagementService.deleteUser(adminId, id);
    }
}
