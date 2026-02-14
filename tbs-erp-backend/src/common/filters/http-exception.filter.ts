import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface HttpExceptionResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[];
    let error: string | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp.message as string | string[]) || exception.message;
      error = resp.error as string | undefined;
    } else {
      message = exception.message;
    }

    const errorResponse: HttpExceptionResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log 5xx errors as error, 4xx as warn
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
