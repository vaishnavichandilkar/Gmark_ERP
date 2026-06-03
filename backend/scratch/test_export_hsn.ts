import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { HsnMasterService } from '../src/modules/Master/hsn-master/hsn-master.service';

async function run() {
    const prisma = new PrismaService();
    const service = new HsnMasterService(prisma);
    try {
        console.log("Calling exportHsnMaster('pdf', {})...");
        const result = await service.exportHsnMaster('pdf', {});
        console.log("Export success! Buffer size:", result.buffer.length);
    } catch (err) {
        console.error("Export failed with error:", err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
