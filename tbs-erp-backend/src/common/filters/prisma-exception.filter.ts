import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Catches Prisma client exceptions and maps them to appropriate HTTP responses.
 *
 * Handled error codes:
 * - P2002: Unique constraint violation -> 409 Conflict
 * - P2003: Foreign key constraint violation -> 400 Bad Request
 * - P2025: Record not found -> 404 Not Found
 * - P2014: Required relation violation -> 400 Bad Request
 * - P2021: Table does not exist -> 500 Internal Server Error
 * - P2024: Timed out -> 408 Request Timeout
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

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.handleKnownRequestError(exception, request, response);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      this.handleValidationError(exception, request, response);
    }
  }

  private handleKnownRequestError(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
    response: Response,
  ): void {
    let status: number;
    let message: string;

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const fields = (exception.meta?.target as string[]) || [];
        message = fields.length
          ? `A record with this ${fields.join(', ')} already exists.`
          : 'A record with these unique fields already exists.';
        break;
      }

      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        const field = (exception.meta?.field_name as string) || 'field';
        message = `Invalid reference: the related ${field} does not exist.`;
        break;
      }

      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        const cause = exception.meta?.cause as string | undefined;
        message = cause || 'The requested record was not found.';
        break;
      }

      case 'P2014': {
        status = HttpStatus.BAD_REQUEST;
        message = 'The operation would violate a required relation between records.';
        break;
      }

      case 'P2021': {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'A database table required for this operation was not found.';
        this.logger.error(`Table not found: ${exception.meta?.table}`, exception.stack);
        break;
      }

      case 'P2024': {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'The database operation timed out. Please try again.';
        break;
      }

      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'An unexpected database error occurred.';
        this.logger.error(
          `Unhandled Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        break;
      }
    }

    this.logger.warn(`Prisma ${exception.code}: ${request.method} ${request.url} - ${message}`);

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error: `Prisma Error ${exception.code}`,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private handleValidationError(
    exception: Prisma.PrismaClientValidationError,
    request: Request,
    response: Response,
  ): void {
    const status = HttpStatus.BAD_REQUEST;

    this.logger.warn(`Prisma Validation: ${request.method} ${request.url} - ${exception.message}`);

    response.status(status).json({
      success: false,
      statusCode: status,
      message: 'Invalid data provided. Please check your request and try again.',
      error: 'Prisma Validation Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
