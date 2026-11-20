import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis | null = null;

    constructor(private configService: ConfigService) {}

    onModuleInit() {
        const enableRedis = this.configService.get<string>('ENABLE_REDIS');
        if (enableRedis === 'false') {
            console.log('[Redis] ENABLE_REDIS is false. Running in offline fallback mode.');
            return;
        }

        const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
        const port = this.configService.get<number>('REDIS_PORT') || 6379;
        const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

        this.client = new Redis({
            host,
            port,
            password,
            maxRetriesPerRequest: null,
            lazyConnect: true,
            retryStrategy(times) {
                // If Redis is offline, avoid repeated connection attempts in development
                if (times > 1) {
                    return null; 
                }
                return 1000;
            }
        });

        this.client.on('error', (err: any) => {
            // Silence ECONNREFUSED and AggregateError to prevent console pollution when Redis is offline
            const isConnRefused = 
                err?.code === 'ECONNREFUSED' ||
                err?.message?.includes('ECONNREFUSED') ||
                (Array.isArray(err?.errors) && err.errors.some((e: any) => e?.code === 'ECONNREFUSED' || e?.message?.includes('ECONNREFUSED')));

            if (isConnRefused) {
                return;
            }
            console.error('Redis connection error:', err);
        });

        this.client.connect().catch(() => {
            // Soft warning, offline mode fallback
            console.warn('[Redis] Redis not connected. Running in offline fallback mode.');
        });
    }

    onModuleDestroy() {
        if (this.client) {
            this.client.disconnect();
        }
    }

    getClient(): Redis | null {
        return this.client;
    }

    async get(key: string): Promise<string | null> {
        try {
            if (!this.client || this.client.status !== 'ready') return null;
            return await this.client.get(key);
        } catch {
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (!this.client || this.client.status !== 'ready') return;
            if (ttlSeconds) {
                await this.client.set(key, value, 'EX', ttlSeconds);
            } else {
                await this.client.set(key, value);
            }
        } catch (e) {
            // Silently ignore cache failures if Redis connection is down
        }
    }

    async del(key: string): Promise<void> {
        try {
            if (!this.client || this.client.status !== 'ready') return;
            await this.client.del(key);
        } catch (e) {
            // Silently ignore cache failures if Redis connection is down
        }
    }

    async setSession(jti: string, sessionData: any, ttlSeconds: number): Promise<void> {
        await this.set(`session:${jti}`, JSON.stringify(sessionData), ttlSeconds);
    }

    async getSession(jti: string): Promise<any | null> {
        const data = await this.get(`session:${jti}`);
        return data ? JSON.parse(data) : null;
    }

    async revokeSession(jti: string): Promise<void> {
        await this.del(`session:${jti}`);
    }
}
