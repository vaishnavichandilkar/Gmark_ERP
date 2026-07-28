import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class CustomLoggerService implements LoggerService {
    private readonly isProduction = process.env.NODE_ENV === 'production';
    private readonly sensitiveKeys = ['password', 'otp', 'token', 'refreshToken', 'secret', 'ifsc', 'accountNo', 'panNo', 'panNumber'];

    private sanitize(data: any): any {
        if (!data) return data;
        if (typeof data !== 'object') return data;
        if (Array.isArray(data)) return data.map(item => this.sanitize(item));

        const sanitized = { ...data };
        for (const key in sanitized) {
            if (this.sensitiveKeys.some(sKey => key.toLowerCase().includes(sKey.toLowerCase()))) {
                sanitized[key] = '[FILTERED]';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
        }
        return sanitized;
    }

    private format(level: string, message: any, ...optionalParams: any[]) {
        const timestamp = new Date().toISOString();
        const sanitizedParams = optionalParams.map(param => this.sanitize(param));

        if (this.isProduction) {
            console.log(JSON.stringify({
                timestamp,
                level,
                message: typeof message === 'object' ? this.sanitize(message) : message,
                context: sanitizedParams.length > 0 ? sanitizedParams : undefined,
            }));
        } else {
            const contextStr = sanitizedParams.length > 0 ? ` | context: ${JSON.stringify(sanitizedParams)}` : '';
            const msgStr = typeof message === 'object' ? JSON.stringify(this.sanitize(message)) : message;
            console.log(`[${timestamp}] [${level}] ${msgStr}${contextStr}`);
        }
    }

    log(message: any, ...optionalParams: any[]) {
        this.format('INFO', message, ...optionalParams);
    }

    error(message: any, ...optionalParams: any[]) {
        this.format('ERROR', message, ...optionalParams);
    }

    warn(message: any, ...optionalParams: any[]) {
        this.format('WARN', message, ...optionalParams);
    }

    debug?(message: any, ...optionalParams: any[]) {
        this.format('DEBUG', message, ...optionalParams);
    }
}
