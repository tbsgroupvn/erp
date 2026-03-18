/**
 * Standard error response shape for all API errors.
 *
 * Every HTTP error response from the API must conform to this interface,
 * ensuring consistent client-side error handling across all endpoints.
 */
export interface StandardErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  error?: string;
  requestId: string;
  timestamp: string;
  path: string;
}
