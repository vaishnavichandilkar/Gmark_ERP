import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    async onModuleInit() {
        const maxRetries = 5;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                await this.$connect();
                this.logger.log('Database connected successfully.');
                return;
            } catch (error: any) {
                attempt++;
                if (error.code === 'P1001' && attempt < maxRetries) {
                    this.logger.warn(`Database unreachable (P1001). Retrying connection attempt ${attempt}/${maxRetries} in 2s...`);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                } else {
                    this.logger.error(`Prisma failed to connect to database: ${error.message}`);
                    throw error;
                }
            }
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
