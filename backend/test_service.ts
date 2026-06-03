import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { LedgerService } from './src/modules/Ledger/ledger.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ledgerService = app.get(LedgerService);
  const data = await ledgerService.getDetailedLedger(9, 2, '', '', '', 1, 50);
  console.log(JSON.stringify(data.items, null, 2));
  await app.close();
}
bootstrap();
