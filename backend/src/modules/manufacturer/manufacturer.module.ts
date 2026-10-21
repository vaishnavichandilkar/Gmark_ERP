import { Module } from '@nestjs/common';
import { ManufacturerController } from './controllers/manufacturer.controller';
import { LabelGeneratorService } from './services/label-generator.service';

@Module({
    controllers: [ManufacturerController],
    providers: [LabelGeneratorService],
    exports: [LabelGeneratorService],
})
export class ManufacturerModule {}
