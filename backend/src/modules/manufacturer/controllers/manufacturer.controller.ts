import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LabelGeneratorService } from '../services/label-generator.service';
import { SyntheticBatchPreviewDto } from '../dto/label-preview.dto';

@ApiTags('Manufacturer')
@Controller('manufacturer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManufacturerController {
    constructor(private readonly labelGeneratorService: LabelGeneratorService) {}

    @Post('preview-labels')
    @ApiOperation({ summary: 'Generate and stream synthetic thermal label preview PDF' })
    @ApiResponse({ status: 200, description: 'Synthetic label PDF stream' })
    async previewLabels(
        @Body() dto: SyntheticBatchPreviewDto,
        @Res() res: Response,
    ): Promise<void> {
        const buffer = await this.labelGeneratorService.generateBatchPdf(dto);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="manufacturer-label-preview.pdf"',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
}
