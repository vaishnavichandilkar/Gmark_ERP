import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, SendLoginOtpDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('send-login-otp')
    @ApiOperation({ summary: 'Send OTP for Login' })
    @ApiResponse({ status: 201, description: 'OTP sent successfully.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    sendLoginOtp(@Body() dto: SendLoginOtpDto) {
        return this.authService.sendLoginOtp(dto);
    }

    @Post('resend-otp')
    @ApiOperation({ summary: 'Resend OTP' })
    resendOtp(@Body('phone') phone: string) {
        return this.authService.resendOtp(phone);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login using Mobile and OTP' })
    @ApiResponse({ status: 201, description: 'Login successful. Returns access and refresh tokens.' })
    @ApiResponse({ status: 401, description: 'Invalid OTP or unauthorized user.' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh-token')
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 201, description: 'Token refresh successful.' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token.' })
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout' })
    @ApiResponse({ status: 201, description: 'Logged out successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    logout(@Request() req) {
        return this.authService.logout(req.user.userId, req.user.jti);
    }

    @Get('me')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Returns current user profile.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    getProfile(@Request() req) {
        return req.user;
    }

    @Post('mark-approval-seen')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Mark approval login page as seen' })
    @ApiResponse({ status: 200, description: 'Marked as seen successfully.' })
    markApprovalSeen(@Request() req) {
        return this.authService.markApprovalLoginSeen(req.user.userId);
    }

    @Post('language')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update user language preference' })
    @ApiResponse({ status: 200, description: 'Language updated successfully.' })
    updateLanguage(@Request() req, @Body('language') language: string) {
        return this.authService.updateLanguage(req.user.userId, language);
    }

    @Post('update-profile')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update user profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
    updateProfile(@Request() req, @Body() dto: { name: string; email: string; profileImage: string }) {
        return this.authService.updateProfile(req.user.userId, dto);
    }
}
