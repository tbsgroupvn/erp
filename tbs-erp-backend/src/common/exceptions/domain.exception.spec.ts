import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
import { ErrorCode, ErrorCodeType } from './error-codes';

describe('DomainException', () => {
  it('should extend HttpException', () => {
    const exception = new DomainException(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
    );
    expect(exception).toBeInstanceOf(HttpException);
  });

  it('should carry errorCode as a string property', () => {
    const exception = new DomainException(
      ErrorCode.NOT_FOUND,
      'Record not found',
    );
    expect(exception.errorCode).toBe('NOT_FOUND');
    expect(typeof exception.errorCode).toBe('string');
  });

  it('should return object with { message, errorCode } from getResponse()', () => {
    const exception = new DomainException(
      ErrorCode.CONFLICT,
      'Duplicate record',
    );
    const response = exception.getResponse() as Record<string, unknown>;
    expect(response).toHaveProperty('message', 'Duplicate record');
    expect(response).toHaveProperty('errorCode', 'CONFLICT');
  });

  it('should default status to 400 (BAD_REQUEST)', () => {
    const exception = new DomainException(
      ErrorCode.VALIDATION_ERROR,
      'Invalid input',
    );
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('should accept custom HttpStatus', () => {
    const exception = new DomainException(
      ErrorCode.NOT_FOUND,
      'Order not found',
      HttpStatus.NOT_FOUND,
    );
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);

    const forbiddenException = new DomainException(
      ErrorCode.FORBIDDEN,
      'Access denied',
      HttpStatus.FORBIDDEN,
    );
    expect(forbiddenException.getStatus()).toBe(HttpStatus.FORBIDDEN);
  });
});

describe('ErrorCode registry', () => {
  it('should contain all required common HTTP error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.REQUEST_TIMEOUT).toBe('REQUEST_TIMEOUT');
  });

  it('should contain all required Prisma-mapped error codes', () => {
    expect(ErrorCode.DB_UNIQUE_VIOLATION).toBe('DB_UNIQUE_VIOLATION');
    expect(ErrorCode.DB_FK_VIOLATION).toBe('DB_FK_VIOLATION');
    expect(ErrorCode.DB_RECORD_NOT_FOUND).toBe('DB_RECORD_NOT_FOUND');
    expect(ErrorCode.DB_RELATION_VIOLATION).toBe('DB_RELATION_VIOLATION');
    expect(ErrorCode.DB_TABLE_NOT_FOUND).toBe('DB_TABLE_NOT_FOUND');
    expect(ErrorCode.DB_TIMEOUT).toBe('DB_TIMEOUT');
    expect(ErrorCode.DB_VALIDATION_ERROR).toBe('DB_VALIDATION_ERROR');
  });

  it('should contain domain-specific error codes', () => {
    // Order
    expect(ErrorCode.ORDER_NOT_FOUND).toBe('ORDER_NOT_FOUND');
    expect(ErrorCode.ORDER_INVALID_TRANSITION).toBe('ORDER_INVALID_TRANSITION');

    // Auth
    expect(ErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');

    // Container
    expect(ErrorCode.CONTAINER_NOT_FOUND).toBe('CONTAINER_NOT_FOUND');

    // CRM
    expect(ErrorCode.CUSTOMER_NOT_FOUND).toBe('CUSTOMER_NOT_FOUND');

    // Finance
    expect(ErrorCode.VOUCHER_NOT_FOUND).toBe('VOUCHER_NOT_FOUND');

    // Customs
    expect(ErrorCode.CUSTOMS_NOT_FOUND).toBe('CUSTOMS_NOT_FOUND');

    // WebSocket
    expect(ErrorCode.WS_AUTH_REQUIRED).toBe('WS_AUTH_REQUIRED');

    // BullMQ
    expect(ErrorCode.JOB_PROCESSING_FAILED).toBe('JOB_PROCESSING_FAILED');
  });

  it('should have ErrorCodeType as a union type that accepts valid error codes', () => {
    // This test validates that ErrorCodeType is properly derived from ErrorCode values
    const code: ErrorCodeType = ErrorCode.VALIDATION_ERROR;
    expect(code).toBe('VALIDATION_ERROR');

    // TypeScript compilation will fail if ErrorCodeType doesn't accept these
    const codes: ErrorCodeType[] = [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.DB_UNIQUE_VIOLATION,
      ErrorCode.ORDER_NOT_FOUND,
      ErrorCode.INVALID_CREDENTIALS,
      ErrorCode.WS_AUTH_REQUIRED,
      ErrorCode.JOB_PROCESSING_FAILED,
    ];
    expect(codes).toHaveLength(7);
  });
});
