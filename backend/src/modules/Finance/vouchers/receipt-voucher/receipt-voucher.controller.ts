import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { ReceiptVoucherService } from './receipt-voucher.service';
import { CreateVoucherDto } from '../dto/voucher.dto';

@ApiTags('Receipt Voucher')
@Controller('receipt-voucher')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReceiptVoucherController {
  constructor(private readonly receiptVoucherService: ReceiptVoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new receipt voucher' })
  create(@Body() createDto: CreateVoucherDto, @Req() req: any) {
    return this.receiptVoucherService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all receipt vouchers' })
  findAll(@Req() req: any) {
    return this.receiptVoucherService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific receipt voucher' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.receiptVoucherService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a receipt voucher' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: CreateVoucherDto, @Req() req: any) {
    return this.receiptVoucherService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a receipt voucher' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.receiptVoucherService.remove(id, req.user.id);
  }
}
