import { AxiosError } from 'axios';

/**
 * Parsed error result from an API call.
 */
export interface ParsedApiError {
  errorCode: string | undefined;
  requestId: string | undefined;
  message: string;
  statusCode: number | undefined;
}

/**
 * Shape of the backend StandardErrorResponse.
 * Used internally for type-safe extraction.
 */
interface StandardErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  error?: string;
  requestId: string;
  timestamp: string;
  path: string;
}

/**
 * Parse an unknown error (typically from Axios) into a structured object
 * with errorCode, requestId, message, and statusCode.
 *
 * If the error response matches the backend StandardErrorResponse shape,
 * all fields are extracted. Otherwise, falls back to generic error info.
 */
export function parseApiError(error: unknown): ParsedApiError {
  const axiosError = error as AxiosError;
  const responseData = axiosError?.response?.data as
    | Partial<StandardErrorResponse>
    | undefined;

  // Check if response matches StandardErrorResponse shape
  if (responseData && responseData.success === false && responseData.errorCode) {
    const msg = Array.isArray(responseData.message)
      ? responseData.message[0]
      : responseData.message;

    return {
      errorCode: responseData.errorCode,
      requestId: responseData.requestId,
      message: msg || 'Unknown error',
      statusCode: responseData.statusCode,
    };
  }

  // Fallback for non-standard errors
  return {
    errorCode: undefined,
    requestId: undefined,
    message: (error as Error)?.message || 'Unknown error',
    statusCode: axiosError?.response?.status,
  };
}
