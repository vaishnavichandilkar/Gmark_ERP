import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { ContraVoucherService } from './contra-voucher.service';
import { CreateVoucherDto } from '../dto/voucher.dto';

@ApiTags('Contra Voucher')
@Controller('contra-voucher')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContraVoucherController {
  constructor(private readonly contraVoucherService: ContraVoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contra voucher' })
  create(@Body() createDto: CreateVoucherDto, @Req() req: any) {
    return this.contraVoucherService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contra vouchers' })
  findAll(@Req() req: any) {
    return this.contraVoucherService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific contra voucher' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.contraVoucherService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contra voucher' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: CreateVoucherDto, @Req() req: any) {
    return this.contraVoucherService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contra voucher' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.contraVoucherService.remove(id, req.user.id);
  }
}
