import { Controller, Get, Post, Delete, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { multerConfig } from '../upload/multer.config';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
    constructor(private businessService: BusinessService) { }

    @Get('profile')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get business profile' })
    @ApiResponse({ status: 200, description: 'Returns business profile information.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    getProfile(@Request() req) {
        return this.businessService.getBusinessProfile(req.user.userId);
    }

    @Post('profile')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create/Update business profile' })
    @ApiResponse({ status: 201, description: 'Business profile created. Account pending approval.' })
    createProfile(@Body() dto: any, @Request() req) {
        return this.businessService.createBusinessDetails(req.user.userId, dto);
    }

    @Post('logo')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('logo', multerConfig))
    @ApiConsumes('multipart/form-data', 'application/json')
    @ApiOperation({ summary: 'Upload or set invoice logo' })
    @ApiResponse({ status: 200, description: 'Logo updated successfully.' })
    uploadLogo(
        @UploadedFile() file: Express.Multer.File,
        @Body('logoUrl') logoUrl: string,
        @Body('settings') settingsStr: string,
        @Request() req
    ) {
        let settings = null;
        if (settingsStr) {
            try {
                settings = typeof settingsStr === 'string' ? JSON.parse(settingsStr) : settingsStr;
            } catch {}
        }
        return this.businessService.updateInvoiceLogo(req.user.userId, file, logoUrl, settings);
    }

    @Delete('logo')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Remove custom invoice logo' })
    @ApiResponse({ status: 200, description: 'Logo removed successfully.' })
    removeLogo(@Request() req) {
        return this.businessService.removeInvoiceLogo(req.user.userId);
    }
}
