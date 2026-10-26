import { Module } from '@nestjs/common';
import { ManufacturerController } from './controllers/manufacturer.controller';
import { LabelGeneratorService } from './services/label-generator.service';
import { PackageService } from './services/package.service';
import { WeighingDeviceService } from './services/weighing-device.service';

@Module({
    controllers: [ManufacturerController],
    providers: [
        LabelGeneratorService,
        PackageService,
        WeighingDeviceService,
    ],
    exports: [
        LabelGeneratorService,
        PackageService,
        WeighingDeviceService,
    ],
})
export class ManufacturerModule {}
