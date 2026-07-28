import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
    constructor(private redisService: RedisService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
        const route = request.route?.path || request.url;
        
        // Default: 100 requests per 60 seconds per IP/route combo
        const limit = 100;
        const windowSeconds = 60;
        
        const key = `ratelimit:${ip}:${route}`;
        const redis = this.redisService.getClient();

        // Fallback: Skip check if Redis is offline/unavailable
        if (!redis || redis.status !== 'ready') {
            return true;
        }

        try {
            const current = await redis.incr(key);
            if (current === 1) {
                await redis.expire(key, windowSeconds);
            }

            if (current > limit) {
                throw new HttpException({
                    success: false,
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests. Please try again later.',
                    error: 'TooManyRequests',
                }, HttpStatus.TOO_MANY_REQUESTS);
            }

            return true;
        } catch (e) {
            if (e instanceof HttpException) throw e;
            console.error('Rate limiter guard error, bypassing for user availability:', e);
            return true;
        }
    }
}
