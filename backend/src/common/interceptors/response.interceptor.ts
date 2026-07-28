import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    
    // Skip interception if headers already sent or for file downloads
    const contentType = response.getHeader('Content-Type')?.toString() || '';
    if (response.headersSent || contentType.includes('application/octet-stream') || contentType.includes('application/vnd.openxmlformats-officedocument')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Extract message if present on output object
        let message = 'Request completed successfully';
        let extractedData = data;

        if (data && typeof data === 'object') {
          if ('message' in data) {
            message = data.message;
            if (Object.keys(data).length === 1) {
              extractedData = null;
            } else {
              const { message: _, ...rest } = data;
              extractedData = rest;
            }
          }
        }
        
        return {
          success: true,
          data: extractedData === undefined ? null : extractedData,
          message,
        };
      }),
    );
  }
}
