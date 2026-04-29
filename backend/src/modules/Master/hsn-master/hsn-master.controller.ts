import { Controller, Get, Param } from '@nestjs/common';
import { HsnMasterService } from './hsn-master.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('HSN Master')
@Controller('hsn')
export class HsnMasterController {
    constructor(private readonly hsnService: HsnMasterService) { }

    @ApiOperation({ summary: 'Get HSN details and latest tax rate by code' })
    @Get(':code')
    async getHsnByCode(@Param('code') code: string) {
        return this.hsnService.getLatestTaxByCode(code);
    }
}
