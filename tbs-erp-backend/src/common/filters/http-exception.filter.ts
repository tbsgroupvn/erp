import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/error-codes';
import { StandardErrorResponse } from '../exceptions/error-response.interface';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const requestId = (request as any).requestId || 'unknown';

    let message: string | string[];
    let error: string | undefined;
    let errorCode: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errorCode = this.deriveErrorCode(status);
    } else if (typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp.message as string | string[]) || exception.message;
      error = resp.error as string | undefined;
      errorCode = (resp.errorCode as string) || this.deriveErrorCode(status);
    } else {
      message = exception.message;
      errorCode = this.deriveErrorCode(status);
    }

    const errorResponse: StandardErrorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log 5xx errors as error, 4xx as warn
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${errorCode} - ${JSON.stringify(message)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${errorCode} - ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private deriveErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.REQUEST_TIMEOUT:
        return ErrorCode.REQUEST_TIMEOUT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
