import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/orders',
      method: 'POST',
      requestId: 'prisma-req-id-456',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  function createPrismaError(code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(`Error ${code}`, {
      code,
      clientVersion: '6.3.0',
      meta,
    });
  }

  it('P2002 should return errorCode=DB_UNIQUE_VIOLATION and requestId', () => {
    const exception = createPrismaError('P2002', { target: ['email'] });

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_UNIQUE_VIOLATION');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('P2003 should return errorCode=DB_FK_VIOLATION and requestId', () => {
    const exception = createPrismaError('P2003', { field_name: 'customerId' });

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_FK_VIOLATION');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('P2025 should return errorCode=DB_RECORD_NOT_FOUND and requestId', () => {
    const exception = createPrismaError('P2025', { cause: 'Record to update not found.' });

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_RECORD_NOT_FOUND');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('P2014 should return errorCode=DB_RELATION_VIOLATION and requestId', () => {
    const exception = createPrismaError('P2014');

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_RELATION_VIOLATION');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('P2021 should return errorCode=DB_TABLE_NOT_FOUND and requestId', () => {
    const exception = createPrismaError('P2021', { table: 'Order' });

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_TABLE_NOT_FOUND');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('P2024 should return errorCode=DB_TIMEOUT and requestId', () => {
    const exception = createPrismaError('P2024');

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_TIMEOUT');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.REQUEST_TIMEOUT);
  });

  it('PrismaClientValidationError should return errorCode=DB_VALIDATION_ERROR and requestId', () => {
    const exception = new Prisma.PrismaClientValidationError('Invalid data', {
      clientVersion: '6.3.0',
    });

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('DB_VALIDATION_ERROR');
    expect(responseBody.requestId).toBe('prisma-req-id-456');
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});
