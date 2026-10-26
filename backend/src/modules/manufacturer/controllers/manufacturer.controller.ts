import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    Request,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LabelGeneratorService } from '../services/label-generator.service';
import { PackageService } from '../services/package.service';
import { WeighingDeviceService } from '../services/weighing-device.service';
import { SyntheticBatchPreviewDto } from '../dto/label-preview.dto';
import { CreatePackageDto, PackageQueryDto, WeighmentTransactionDto } from '../dto/package.dto';

@ApiTags('Manufacturer')
@Controller('manufacturer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManufacturerController {
    constructor(
        private readonly labelGeneratorService: LabelGeneratorService,
        private readonly packageService: PackageService,
        private readonly weighingDeviceService: WeighingDeviceService,
    ) {}

    @Post('preview-labels')
    @ApiOperation({ summary: 'Generate and stream synthetic thermal label preview PDF' })
    @ApiResponse({ status: 200, description: 'Synthetic label PDF stream' })
    async previewLabels(
        @Body() body: any,
        @Res() res: Response,
        @Request() req?: any,
    ): Promise<void> {
        let batchDto: SyntheticBatchPreviewDto;

        if (body.items && Array.isArray(body.items)) {
            batchDto = body as SyntheticBatchPreviewDto;
        } else if (body.packages && Array.isArray(body.packages)) {
            let companyName = 'GMARK MANUFACTURING PVT LTD';
            let productName = 'Standard Product';

            try {
                if (req?.user?.userId) {
                    const shop = await this.packageService.getShopDetail(req.user.userId);
                    if (shop?.shopName) companyName = shop.shopName;
                }
            } catch (_) {}

            if (body.productId) {
                const prod = await this.packageService.getProductDetail(body.productId, req?.user?.userId);
                if (prod?.product_name) productName = prod.product_name;
            }

            const labelSize = body.labelFormat || '100x50';
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2);

            const items = body.packages.map((pkg: any, idx: number) => {
                const seq = String(idx + 1).padStart(4, '0');
                const plant = (pkg.plantCode || 'AB').trim().toUpperCase();
                const machine = (pkg.machineId || 'M01').trim().toUpperCase();
                const serial = `${dateStr}${seq}-${plant}-${machine}`;
                const netWeight = typeof pkg.netWeight === 'number' ? pkg.netWeight : parseFloat(pkg.netWeight) || 10.0;

                return {
                    companyName,
                    productName,
                    netWeight,
                    serialNumber: serial,
                    isProduction: false,
                };
            });

            batchDto = { labelSize, items };
        } else {
            batchDto = {
                labelSize: '100x50',
                items: [
                    {
                        companyName: 'GMARK MANUFACTURING PVT LTD',
                        productName: 'Standard Product Preview',
                        netWeight: 10.0,
                        serialNumber: '2610230001-AB-M01',
                    },
                ],
            };
        }

        const buffer = await this.labelGeneratorService.generateBatchPdf(batchDto);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="manufacturer-label-preview.pdf"',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }

    @Post('packages')
    @ApiOperation({ summary: 'Register weighed package, allocate daily serial, and generate label' })
    @ApiResponse({ status: 201, description: 'Package created successfully' })
    async createPackage(@Request() req, @Body() dto: CreatePackageDto) {
        return this.packageService.createPackage(req.user.userId, dto);
    }

    @Get('packages')
    @ApiOperation({ summary: 'Get paginated packages history with search, date filters, and summary totals' })
    @ApiResponse({ status: 200, description: 'Paginated packages list' })
    async getPackages(@Request() req, @Query() query: PackageQueryDto) {
        return this.packageService.getPackages(req.user.userId, query);
    }

    @Get('packages/:id')
    @ApiOperation({ summary: 'Get single package details by ID' })
    @ApiResponse({ status: 200, description: 'Package record' })
    async getPackageById(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.packageService.getPackageById(req.user.userId, id);
    }

    @Post('packages/:id/reprint')
    @ApiOperation({ summary: 'Reprint package label with audit trail' })
    @ApiResponse({ status: 200, description: 'Reprint generated' })
    async reprintPackage(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body('reason') reason?: string,
    ) {
        return this.packageService.reprintPackage(req.user.userId, id, reason);
    }

    @Post('packages/scan-out')
    @ApiOperation({ summary: 'Scan barcode for explicit Inventory Out dispatch' })
    @ApiResponse({ status: 200, description: 'Package dispatched and inventory-out recorded' })
    async scanOutPackage(
        @Request() req,
        @Body('barcodePayload') barcodePayload: string,
    ) {
        return this.packageService.scanOutPackage(req.user.userId, barcodePayload);
    }

    @Post('packages/lookup')
    @ApiOperation({ summary: 'Lookup package details by barcode without dispatching' })
    @ApiResponse({ status: 200, description: 'Package details found' })
    async lookupPackage(
        @Request() req,
        @Body('barcodePayload') barcodePayload: string,
    ) {
        return this.packageService.lookupPackage(req.user.userId, barcodePayload);
    }

    @Get('devices')
    @ApiOperation({ summary: 'Get configured weighing machines' })
    @ApiResponse({ status: 200, description: 'List of weighing devices' })
    async getDevices(@Request() req) {
        return this.weighingDeviceService.getDevices(req.user.userId);
    }

    @Post('devices')
    @ApiOperation({ summary: 'Register a new weighing machine configuration' })
    @ApiResponse({ status: 201, description: 'Weighing machine registered' })
    async createDevice(@Request() req, @Body() dto: any) {
        return this.weighingDeviceService.createDevice(req.user.userId, dto);
    }

    @Put('devices/:id')
    @ApiOperation({ summary: 'Update an existing weighing machine configuration' })
    @ApiResponse({ status: 200, description: 'Weighing machine updated' })
    async updateDevice(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: any,
    ) {
        return this.weighingDeviceService.updateDevice(req.user.userId, id, dto);
    }

    @Delete('devices/:id')
    @ApiOperation({ summary: 'Delete a weighing machine configuration' })
    @ApiResponse({ status: 200, description: 'Weighing machine removed' })
    async deleteDevice(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.weighingDeviceService.deleteDevice(req.user.userId, id);
    }

    @Post('weighments')
    @ApiOperation({ summary: 'Record audited weighment transaction from scale' })
    @ApiResponse({ status: 201, description: 'Weighment recorded' })
    async recordWeighment(
        @Request() req,
        @Body() dto: WeighmentTransactionDto,
    ) {
        return this.weighingDeviceService.recordWeighment(req.user.userId, dto);
    }
}
