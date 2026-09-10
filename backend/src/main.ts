import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { join } from 'path';
import * as express from 'express';
import helmet from 'helmet';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// Start gracefully - dev otp update
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Static Assets
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

    // Secure HTTP Headers
    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: false, // Turn off CSP if swagger docs are served
    }));

    // Global Config
    app.setGlobalPrefix('api/v1');
    
    // Secure CORS
    const corsOrigin = process.env.CORS_ORIGIN;
    app.enableCors({
        origin: corsOrigin ? corsOrigin.split(',') : true,
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type,Accept,Authorization,x-session-id,ngrok-skip-browser-warning',
    });

    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Content-Type: ${req.headers['content-type']}`);
        next();
    });

    // Validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));

    // Global Interceptors & Filters
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Enable Graceful Shutdown
    app.enableShutdownHooks();

    // Swagger
    setupSwagger(app);

    const configService = app.get(ConfigService);
    const port = configService.get('PORT') || configService.get('port') || 3002;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger Docs available at: http://localhost:${port}${process.env.SWAGGER_PATH || '/api/docs'}`);
}
bootstrap();
