import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { PaymentVoucherService } from './payment-voucher.service';
import { CreateVoucherDto } from '../dto/voucher.dto';

@ApiTags('Payment Voucher')
@Controller('payment-voucher')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentVoucherController {
  constructor(private readonly paymentVoucherService: PaymentVoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payment voucher' })
  create(@Body() createDto: CreateVoucherDto, @Req() req: any) {
    return this.paymentVoucherService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payment vouchers' })
  findAll(@Req() req: any) {
    return this.paymentVoucherService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payment voucher' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.paymentVoucherService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a payment voucher' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: CreateVoucherDto, @Req() req: any) {
    return this.paymentVoucherService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payment voucher' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.paymentVoucherService.remove(id, req.user.id);
  }
}
