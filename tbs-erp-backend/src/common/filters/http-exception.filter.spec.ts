import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { DomainException } from '../exceptions/domain.exception';
import { ErrorCode } from '../exceptions/error-codes';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/orders',
      method: 'GET',
      requestId: 'test-request-id-123',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should include errorCode derived from DomainException.getResponse().errorCode', () => {
    const exception = new DomainException(
      ErrorCode.ORDER_NOT_FOUND,
      'Order not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.errorCode).toBe('ORDER_NOT_FOUND');
  });

  it('should include requestId from (request as any).requestId', () => {
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.requestId).toBe('test-request-id-123');
  });

  it('should derive errorCode from HTTP status when exception has no errorCode', () => {
    const testCases = [
      { status: HttpStatus.BAD_REQUEST, expectedCode: 'VALIDATION_ERROR' },
      { status: HttpStatus.UNAUTHORIZED, expectedCode: 'UNAUTHORIZED' },
      { status: HttpStatus.FORBIDDEN, expectedCode: 'FORBIDDEN' },
      { status: HttpStatus.NOT_FOUND, expectedCode: 'NOT_FOUND' },
      { status: HttpStatus.CONFLICT, expectedCode: 'CONFLICT' },
      { status: HttpStatus.REQUEST_TIMEOUT, expectedCode: 'REQUEST_TIMEOUT' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, expectedCode: 'INTERNAL_ERROR' },
    ];

    for (const { status, expectedCode } of testCases) {
      const exception = new HttpException('test', status);
      mockResponse.json.mockClear();
      mockResponse.status.mockClear();

      filter.catch(exception, mockHost as any);

      const responseBody = mockResponse.json.mock.calls[0][0];
      expect(responseBody.errorCode).toBe(expectedCode);
    }
  });

  it('should include [requestId] prefix in log output', () => {
    // Access the private logger to spy on it
    const loggerSpy = jest.spyOn((filter as any).logger, 'warn');
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost as any);

    expect(loggerSpy).toHaveBeenCalled();
    const logMessage = loggerSpy.mock.calls[0][0];
    expect(logMessage).toContain('[test-request-id-123]');
  });

  it('should return response matching StandardErrorResponse shape', () => {
    const exception = new DomainException(
      ErrorCode.VALIDATION_ERROR,
      'Invalid input',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody).toHaveProperty('success', false);
    expect(responseBody).toHaveProperty('statusCode', 400);
    expect(responseBody).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    expect(responseBody).toHaveProperty('message', 'Invalid input');
    expect(responseBody).toHaveProperty('requestId', 'test-request-id-123');
    expect(responseBody).toHaveProperty('timestamp');
    expect(responseBody).toHaveProperty('path', '/api/v1/orders');
  });

  it('should fall back to requestId "unknown" when not on request', () => {
    mockRequest.requestId = undefined;
    const exception = new HttpException('test', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockHost as any);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.requestId).toBe('unknown');
  });
});
