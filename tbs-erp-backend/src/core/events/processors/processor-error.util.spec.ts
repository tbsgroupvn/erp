import { buildProcessorErrorLog } from './processor-error.util';
import { DomainException } from '@common/exceptions';
import { HttpStatus } from '@nestjs/common';

// Minimal Job mock matching bullmq Job shape
function createMockJob(overrides: Record<string, any> = {}): any {
  return {
    id: 'job-123',
    queueName: 'finance-events',
    name: 'finance.payment.received',
    attemptsMade: 2,
    data: {
      type: 'finance.payment.received',
      metadata: {
        correlationId: 'corr-abc-456',
      },
    },
    ...overrides,
  };
}

describe('buildProcessorErrorLog', () => {
  it('returns structured object with errorCode, message, requestId, jobId, queue, eventType, attemptsMade', () => {
    const job = createMockJob();
    const error = new Error('Something went wrong');

    const result = buildProcessorErrorLog(job, error);

    expect(result).toEqual({
      errorCode: 'JOB_PROCESSING_FAILED',
      message: 'Something went wrong',
      requestId: 'corr-abc-456',
      jobId: 'job-123',
      queue: 'finance-events',
      eventType: 'finance.payment.received',
      attemptsMade: 2,
    });
  });

  it('uses error.errorCode when error is DomainException', () => {
    const job = createMockJob();
    const error = new DomainException(
      'ORDER_NOT_FOUND',
      'Order #12345 was not found',
      HttpStatus.NOT_FOUND,
    );

    const result = buildProcessorErrorLog(job, error);

    expect(result.errorCode).toBe('ORDER_NOT_FOUND');
    expect(result.message).toBe('Order #12345 was not found');
  });

  it('uses JOB_PROCESSING_FAILED when error is plain Error', () => {
    const job = createMockJob();
    const error = new Error('Random failure');

    const result = buildProcessorErrorLog(job, error);

    expect(result.errorCode).toBe('JOB_PROCESSING_FAILED');
  });

  it('extracts requestId from job.data.metadata.correlationId', () => {
    const job = createMockJob({
      data: {
        type: 'order.created',
        metadata: { correlationId: 'req-from-http-789' },
      },
    });
    const error = new Error('fail');

    const result = buildProcessorErrorLog(job, error);

    expect(result.requestId).toBe('req-from-http-789');
  });

  it('falls back to job.id when job has no metadata.correlationId', () => {
    const job = createMockJob({
      data: { type: 'order.created' },
    });
    const error = new Error('fail');

    const result = buildProcessorErrorLog(job, error);

    expect(result.requestId).toBe('job-123');
  });
});
