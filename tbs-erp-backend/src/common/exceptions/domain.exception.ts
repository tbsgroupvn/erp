import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from './error-codes';

/**
 * Base exception class for all domain-specific errors.
 *
 * Extends NestJS HttpException with a typed `errorCode` property.
 * All business logic errors should throw DomainException (or a subclass)
 * instead of raw HttpException to ensure error codes are included in responses.
 *
 * @example
 * throw new DomainException(
 *   ErrorCode.ORDER_NOT_FOUND,
 *   'Order #12345 was not found',
 *   HttpStatus.NOT_FOUND,
 * );
 */
export class DomainException extends HttpException {
  public readonly errorCode: string;

  constructor(
    errorCode: ErrorCodeType | string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ message, errorCode }, status);
    this.errorCode = errorCode;
  }
}
