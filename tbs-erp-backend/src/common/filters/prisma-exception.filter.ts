import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/error-codes';
import { StandardErrorResponse } from '../exceptions/error-response.interface';

/**
 * Catches Prisma client exceptions and maps them to appropriate HTTP responses.
 *
 * Handled error codes:
 * - P2002: Unique constraint violation -> 409 Conflict (DB_UNIQUE_VIOLATION)
 * - P2003: Foreign key constraint violation -> 400 Bad Request (DB_FK_VIOLATION)
 * - P2025: Record not found -> 404 Not Found (DB_RECORD_NOT_FOUND)
 * - P2014: Required relation violation -> 400 Bad Request (DB_RELATION_VIOLATION)
 * - P2021: Table does not exist -> 500 Internal Server Error (DB_TABLE_NOT_FOUND)
 * - P2024: Timed out -> 408 Request Timeout (DB_TIMEOUT)
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).requestId || 'unknown';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.handleKnownRequestError(exception, request, response, requestId);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      this.handleValidationError(exception, request, response, requestId);
    }
  }

  private handleKnownRequestError(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
    response: Response,
    requestId: string,
  ): void {
    let status: number;
    let message: string;
    let errorCode: string;

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        errorCode = ErrorCode.DB_UNIQUE_VIOLATION;
        const fields = (exception.meta?.target as string[]) || [];
        message = fields.length
          ? `A record with this ${fields.join(', ')} already exists.`
          : 'A record with these unique fields already exists.';
        break;
      }

      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.DB_FK_VIOLATION;
        const field = (exception.meta?.field_name as string) || 'field';
        message = `Invalid reference: the related ${field} does not exist.`;
        break;
      }

      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        errorCode = ErrorCode.DB_RECORD_NOT_FOUND;
        const cause = exception.meta?.cause as string | undefined;
        message = cause || 'The requested record was not found.';
        break;
      }

      case 'P2014': {
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.DB_RELATION_VIOLATION;
        message = 'The operation would violate a required relation between records.';
        break;
      }

      case 'P2021': {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = ErrorCode.DB_TABLE_NOT_FOUND;
        message = 'A database table required for this operation was not found.';
        this.logger.error(
          `[${requestId}] Table not found: ${exception.meta?.table}`,
          exception.stack,
        );
        break;
      }

      case 'P2024': {
        status = HttpStatus.REQUEST_TIMEOUT;
        errorCode = ErrorCode.DB_TIMEOUT;
        message = 'The database operation timed out. Please try again.';
        break;
      }

      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = ErrorCode.INTERNAL_ERROR;
        message = 'An unexpected database error occurred.';
        this.logger.error(
          `[${requestId}] Unhandled Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        break;
      }
    }

    this.logger.warn(
      `[${requestId}] Prisma ${exception.code}: ${request.method} ${request.url} - ${errorCode} - ${message}`,
    );

    const errorResponse: StandardErrorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message,
      error: `Prisma Error ${exception.code}`,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private handleValidationError(
    exception: Prisma.PrismaClientValidationError,
    request: Request,
    response: Response,
    requestId: string,
  ): void {
    const status = HttpStatus.BAD_REQUEST;
    const errorCode = ErrorCode.DB_VALIDATION_ERROR;

    this.logger.warn(
      `[${requestId}] Prisma Validation: ${request.method} ${request.url} - ${errorCode} - ${exception.message}`,
    );

    const errorResponse: StandardErrorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message: 'Invalid data provided. Please check your request and try again.',
      error: 'Prisma Validation Error',
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
