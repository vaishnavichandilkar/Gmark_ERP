import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            console.error('Unhandled Exception:', exception);
        }

        let message: string | string[] = 'Internal server error';

        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null && (exceptionResponse as any).message) {
                const msg = (exceptionResponse as any).message;
                message = Array.isArray(msg) ? msg.join(', ') : msg;
            } else {
                message = exception.message;
            }
        } else if (exception && typeof exception === 'object' && (exception as any).code === 'P2002') {
            const target = (exception as any).meta?.target;
            const targetStr = Array.isArray(target) ? target.join(', ') : target;
            message = `The ${targetStr || 'field'} is already registered or taken. Please provide a different one.`;
            status = HttpStatus.CONFLICT;
        } else if (exception && (exception.constructor.name === 'PrismaClientValidationError' || (exception as any).name === 'PrismaClientValidationError')) {
            message = `Validation Error: ${(exception as any).message.split('\n').pop()}`;
            status = HttpStatus.BAD_REQUEST;
        }

        const errorName = exception instanceof Error ? exception.name : 'UnknownError';

        response.status(status).json({
            success: false,
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: message,
            error: errorName,
        });
    }
}
