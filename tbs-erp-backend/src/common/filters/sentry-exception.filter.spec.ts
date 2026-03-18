import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SentryExceptionFilter } from './sentry-exception.filter';

// Mock @sentry/node
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetTag = jest.fn();
const mockSetUser = jest.fn();
const mockSetExtra = jest.fn();
const mockWithScope = jest.fn((callback: (scope: any) => void) => {
  callback({
    setTag: mockSetTag,
    setUser: mockSetUser,
    setExtra: mockSetExtra,
  });
});

jest.mock('@sentry/node', () => ({
  withScope: mockWithScope,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}), { virtual: true });

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new SentryExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/orders',
      method: 'POST',
      requestId: 'sentry-req-id-789',
      headers: {},
      query: {},
      ip: '127.0.0.1',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };

    jest.clearAllMocks();
  });

  it('should set requestId as Sentry tag via scope.setTag', async () => {
    const exception = new Error('Something broke');

    await filter.catch(exception, mockHost as any);

    expect(mockSetTag).toHaveBeenCalledWith('requestId', 'sentry-req-id-789');
  });

  it('should format 500 JSON with errorCode=INTERNAL_ERROR for non-HttpException, non-PrismaError', async () => {
    const exception = new Error('Unknown crash');

    await filter.catch(exception, mockHost as any);

    // Should NOT throw (should format response directly)
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.success).toBe(false);
    expect(responseBody.statusCode).toBe(500);
    expect(responseBody.errorCode).toBe('INTERNAL_ERROR');
    expect(responseBody.requestId).toBe('sentry-req-id-789');
    expect(responseBody.message).toBe('An internal server error occurred');
    // Should NOT leak error details
    expect(responseBody.message).not.toContain('Unknown crash');
  });

  it('should re-throw HttpException to let HttpExceptionFilter handle it', async () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    await expect(filter.catch(exception, mockHost as any)).rejects.toThrow(exception);

    // Should NOT format response
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should re-throw PrismaClientKnownRequestError to let PrismaExceptionFilter handle it', async () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Error P2002', {
      code: 'P2002',
      clientVersion: '6.3.0',
    });

    await expect(filter.catch(exception, mockHost as any)).rejects.toThrow(exception);

    // Should NOT format response
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
