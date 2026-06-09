import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/infrastructure/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  console.log("=== TRANSACTIONS FOR ACCOUNT 4 ===");
  const txs = await prisma.transaction.findMany({
    where: { accountId: 4 }
  });
  console.dir(txs.map(t => ({ id: t.id, invoiceNumber: t.invoiceNumber, transactionType: t.transactionType, amount: Number(t.amount), entryType: t.entryType })), { depth: null });

  await app.close();
}
bootstrap();
