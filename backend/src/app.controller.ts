import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { RedisService } from './infrastructure/redis/redis.service';

const RUNTIME_ID = Math.random().toString(36).substring(7);

@ApiTags('System')
@Controller('system')
export class AppController {
    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
    ) {}

    @Get('runtime-id')
    @ApiOperation({ summary: 'Get current server runtime ID' })
    getRuntimeId() {
        return { runtimeId: RUNTIME_ID };
    }

    @Get('health')
    @ApiOperation({ summary: 'Liveness probe' })
    getHealth() {
        return { status: 'UP', timestamp: new Date().toISOString() };
    }

    @Get('ready')
    @ApiOperation({ summary: 'Readiness probe for database & cache connectivity' })
    async getReadiness() {
        const checks = {
            database: 'DOWN',
            redis: 'DOWN',
        };

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            checks.database = 'UP';
        } catch (e) {
            console.error('Readiness probe DB failure:', e);
        }

        try {
            const client = this.redisService.getClient();
            if (client && client.status === 'ready') {
                checks.redis = 'UP';
            }
        } catch (e) {
            console.error('Readiness probe Redis failure:', e);
        }

        if (checks.database === 'DOWN') {
            throw new HttpException({
                status: 'DOWN',
                checks,
                timestamp: new Date().toISOString(),
            }, HttpStatus.SERVICE_UNAVAILABLE);
        }

        return {
            status: 'UP',
            checks,
            timestamp: new Date().toISOString(),
        };
    }
}
