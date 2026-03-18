import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';

export interface ProcessorErrorLog {
  errorCode: string;
  message: string;
  requestId: string;
  jobId: string;
  queue: string;
  eventType: string;
  attemptsMade: number;
}

/**
 * Build a structured error log object from a BullMQ job failure.
 *
 * Extracts correlationId from job metadata for end-to-end request tracing.
 * Uses DomainException.errorCode when available, falls back to JOB_PROCESSING_FAILED.
 *
 * @param job - The BullMQ job that failed
 * @param error - The error that caused the failure
 * @returns Structured error log object
 */
export function buildProcessorErrorLog(
  job: Job,
  error: Error | unknown,
): ProcessorErrorLog {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const correlationId = job.data?.metadata?.correlationId || job.id || 'unknown';

  return {
    errorCode:
      error instanceof DomainException
        ? error.errorCode
        : ErrorCode.JOB_PROCESSING_FAILED,
    message: errorObj.message,
    requestId: correlationId,
    jobId: job.id || 'unknown',
    queue: job.queueName,
    eventType: job.data?.type || job.name || 'unknown',
    attemptsMade: job.attemptsMade,
  };
}

/**
 * Log a structured error from a BullMQ processor failure.
 *
 * Wraps buildProcessorErrorLog and outputs the result as JSON via the
 * provided NestJS Logger, including the original stack trace.
 *
 * @param logger - NestJS Logger instance from the processor
 * @param job - The BullMQ job that failed
 * @param error - The error that caused the failure
 */
export function logProcessorError(
  logger: Logger,
  job: Job,
  error: Error | unknown,
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const logEntry = buildProcessorErrorLog(job, error);

  logger.error(JSON.stringify(logEntry), errorObj.stack);
}
