import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { join } from 'path';
import * as express from 'express';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// Start gracefully - dev otp update
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Static Assets
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

    // Global Config
    app.setGlobalPrefix('api/v1');
    app.enableCors();

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

    // Exception Filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Swagger
    setupSwagger(app);

    const configService = app.get(ConfigService);
    const port = configService.get('PORT') || configService.get('port') || 3001;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger Docs available at: http://localhost:${port}${process.env.SWAGGER_PATH || '/api/docs'}`);
}
bootstrap();
