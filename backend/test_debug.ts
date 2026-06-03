import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { LedgerService } from './src/modules/Ledger/ledger.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ledgerService = app.get(LedgerService);
  const data = await ledgerService.getDetailedLedger(9, 2, '', '', '', 1, 50);
  
  // Just print the one with id: 16 (the Purchase)
  const p = data.items.find(x => x.id === 16);
  console.dir(p, { depth: null });
  
  // Also call the same invoiceIdMap logic locally to see what happens
  const prisma = app.get('PrismaService');
  const allS = await prisma.voucherSettlement.findMany({ where: { ledger_id: 9 } });
  console.log("Found " + allS.length + " settlements");
  
  const invs = await prisma.purchaseInvoice.findMany({ where: { OR: [{ invoiceNumber: "6767" }, { supplierInvoiceNumber: "6767" }] } });
  console.log("Purchase Invoices:");
  console.dir(invs, { depth: null });
  
  await app.close();
}
bootstrap();
