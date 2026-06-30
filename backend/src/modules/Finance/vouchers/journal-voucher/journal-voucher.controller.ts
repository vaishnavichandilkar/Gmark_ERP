import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { JournalVoucherService } from './journal-voucher.service';
import { CreateVoucherDto } from '../dto/voucher.dto';

@ApiTags('Journal Voucher')
@Controller('journal-voucher')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JournalVoucherController {
  constructor(private readonly journalVoucherService: JournalVoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new journal voucher' })
  create(@Body() createDto: CreateVoucherDto, @Req() req: any) {
    return this.journalVoucherService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all journal vouchers' })
  findAll(@Req() req: any) {
    return this.journalVoucherService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific journal voucher' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.journalVoucherService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a journal voucher' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: CreateVoucherDto, @Req() req: any) {
    return this.journalVoucherService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a journal voucher' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.journalVoucherService.remove(id, req.user.id);
  }
}
