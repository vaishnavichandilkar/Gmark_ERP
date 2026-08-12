import { Global, Module } from '@nestjs/common';
import { ImportValidationService } from './import-validation.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ImportValidationService],
  exports: [ImportValidationService],
})
export class ImportValidationModule {}
