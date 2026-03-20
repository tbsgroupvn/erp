/**
 * Error code to Vietnamese user-friendly message mapping.
 *
 * Maps every backend ErrorCode value to a localized Vietnamese string.
 * Used by the centralized mutation onError handler in QueryClient.
 */

const DEFAULT_MESSAGE = '\u0110\u00e3 x\u1ea3y ra l\u1ed7i. Vui l\u00f2ng th\u1eed l\u1ea1i.';

const ERROR_MESSAGES: Record<string, string> = {
  // ─── Common HTTP ───
  VALIDATION_ERROR: 'D\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7',
  UNAUTHORIZED: 'Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i',
  FORBIDDEN: 'B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n th\u1ef1c hi\u1ec7n thao t\u00e1c n\u00e0y',
  NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y d\u1eef li\u1ec7u',
  CONFLICT: 'D\u1eef li\u1ec7u b\u1ecb xung \u0111\u1ed9t. Vui l\u00f2ng th\u1eed l\u1ea1i.',
  INTERNAL_ERROR: 'L\u1ed7i h\u1ec7 th\u1ed1ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
  REQUEST_TIMEOUT: 'Y\u00eau c\u1ea7u h\u1ebft th\u1eddi gian ch\u1edd. Vui l\u00f2ng th\u1eed l\u1ea1i.',

  // ─── Prisma-mapped (generic messages, no DB details exposed) ───
  DB_UNIQUE_VIOLATION: 'D\u1eef li\u1ec7u \u0111\u00e3 t\u1ed3n t\u1ea1i',
  DB_FK_VIOLATION: 'Kh\u00f4ng th\u1ec3 th\u1ef1c hi\u1ec7n v\u00ec d\u1eef li\u1ec7u li\u00ean quan',
  DB_RECORD_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi',
  DB_RELATION_VIOLATION: 'Kh\u00f4ng th\u1ec3 x\u00f3a v\u00ec c\u00f3 d\u1eef li\u1ec7u li\u00ean quan',
  DB_TABLE_NOT_FOUND: 'L\u1ed7i h\u1ec7 th\u1ed1ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
  DB_TIMEOUT: 'H\u1ec7 th\u1ed1ng qu\u00e1 t\u1ea3i. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
  DB_VALIDATION_ERROR: 'D\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7',

  // ─── Order ───
  ORDER_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng',
  ORDER_INVALID_TRANSITION: 'Kh\u00f4ng th\u1ec3 chuy\u1ec3n tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng',
  ORDER_ALREADY_COMPLETED: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 ho\u00e0n th\u00e0nh',
  ORDER_ALREADY_CANCELLED: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 b\u1ecb h\u1ee7y',
  ORDER_CREATION_FAILED: 'Kh\u00f4ng th\u1ec3 t\u1ea1o \u0111\u01a1n h\u00e0ng. Vui l\u00f2ng th\u1eed l\u1ea1i.',
  INSUFFICIENT_DEPOSIT: 'S\u1ed1 ti\u1ec1n \u0111\u1eb7t c\u1ecdc ch\u01b0a \u0111\u1ee7',

  // ─── Auth ───
  INVALID_CREDENTIALS: 'T\u00e0i kho\u1ea3n ho\u1eb7c m\u1eadt kh\u1ea9u kh\u00f4ng \u0111\u00fang',
  TOKEN_EXPIRED: 'Phi\u00ean \u0111\u0103ng nh\u1eadp \u0111\u00e3 h\u1ebft h\u1ea1n. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i.',
  INVALID_2FA_CODE: 'M\u00e3 x\u00e1c th\u1ef1c kh\u00f4ng \u0111\u00fang',
  ACCOUNT_INACTIVE: 'T\u00e0i kho\u1ea3n ch\u01b0a \u0111\u01b0\u1ee3c k\u00edch ho\u1ea1t',
  ACCOUNT_LOCKED: 'T\u00e0i kho\u1ea3n \u0111\u00e3 b\u1ecb kh\u00f3a',
  INVALID_REFRESH_TOKEN:
    'Phi\u00ean \u0111\u0103ng nh\u1eadp \u0111\u00e3 h\u1ebft h\u1ea1n. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i.',
  API_KEY_NOT_FOUND: 'Kh\u00f3a API kh\u00f4ng h\u1ee3p l\u1ec7',

  // ─── Container ───
  CONTAINER_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y container',
  CONTAINER_INVALID_TRANSITION:
    'Kh\u00f4ng th\u1ec3 chuy\u1ec3n tr\u1ea1ng th\u00e1i container',

  // ─── CRM / Customer ───
  CUSTOMER_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y kh\u00e1ch h\u00e0ng',
  CUSTOMER_INACTIVE: 'Kh\u00e1ch h\u00e0ng kh\u00f4ng ho\u1ea1t \u0111\u1ed9ng',
  CUSTOMER_BLOCKED: 'Kh\u00e1ch h\u00e0ng \u0111\u00e3 b\u1ecb ch\u1eb7n',

  // ─── Finance ───
  VOUCHER_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y phi\u1ebfu thu/chi',
  VOUCHER_INVALID_STATE:
    'Phi\u1ebfu thu/chi kh\u00f4ng \u1edf tr\u1ea1ng th\u00e1i h\u1ee3p l\u1ec7',
  VOUCHER_FRAUD_FLAG: 'Phi\u1ebfu thu/chi b\u1ecb \u0111\u00e1nh d\u1ea5u nghi v\u1ea5n',
  PAYMENT_FAILED: 'Thanh to\u00e1n th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.',

  // ─── Complaint ───
  COMPLAINT_CREATION_FAILED:
    'Kh\u00f4ng th\u1ec3 t\u1ea1o khi\u1ebfu n\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.',

  // ─── Customs ───
  CUSTOMS_NOT_FOUND: 'Kh\u00f4ng t\u00ecm th\u1ea5y t\u1edd khai h\u1ea3i quan',
  CUSTOMS_INVALID_TRANSITION:
    'Kh\u00f4ng th\u1ec3 chuy\u1ec3n tr\u1ea1ng th\u00e1i t\u1edd khai',

  // ─── Approval ───
  APPROVAL_FAILED: 'Ph\u00ea duy\u1ec7t th\u1ea5t b\u1ea1i',
  APPROVAL_CONDITION_PARSE_ERROR:
    'L\u1ed7i x\u1eed l\u00fd \u0111i\u1ec1u ki\u1ec7n ph\u00ea duy\u1ec7t',

  // ─── Integration ───
  INTEGRATION_SYNC_ERROR: 'L\u1ed7i \u0111\u1ed3ng b\u1ed9 d\u1eef li\u1ec7u',
  INTEGRATION_HANDLER_NOT_FOUND:
    'L\u1ed7i h\u1ec7 th\u1ed1ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',

  // ─── Infrastructure ───
  ENCRYPTION_ERROR: 'L\u1ed7i b\u1ea3o m\u1eadt. Vui l\u00f2ng th\u1eed l\u1ea1i.',
  VAULT_ERROR: 'L\u1ed7i h\u1ec7 th\u1ed1ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
  TRANSACTION_ERROR: 'L\u1ed7i giao d\u1ecbch. Vui l\u00f2ng th\u1eed l\u1ea1i.',

  // ─── WebSocket ───
  WS_AUTH_REQUIRED:
    'Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 s\u1eed d\u1ee5ng t\u00ednh n\u0103ng n\u00e0y',
  WS_AUTH_FAILED: 'X\u00e1c th\u1ef1c th\u1ea5t b\u1ea1i',
  WS_ACCOUNT_INACTIVE: 'T\u00e0i kho\u1ea3n kh\u00f4ng ho\u1ea1t \u0111\u1ed9ng',
  WS_INVALID_CHANNEL: 'K\u00eanh kh\u00f4ng h\u1ee3p l\u1ec7',
  WS_UNAUTHORIZED_CHANNEL:
    'B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n truy c\u1eadp k\u00eanh n\u00e0y',
  WS_MAX_SUBSCRIPTIONS:
    '\u0110\u00e3 \u0111\u1ea1t gi\u1edbi h\u1ea1n s\u1ed1 l\u01b0\u1ee3ng k\u1ebft n\u1ed1i',

  // ─── BullMQ ───
  JOB_PROCESSING_FAILED:
    'X\u1eed l\u00fd t\u00e1c v\u1ee5 th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.',

  // ─── Automation ───
  AUTOMATION_ACTION_FAILED:
    'H\u00e0nh \u0111\u1ed9ng t\u1ef1 \u0111\u1ed9ng th\u1ea5t b\u1ea1i',

  // ─── Batch Import ───
  BATCH_IMPORT_VALIDATION_ERROR:
    'D\u1eef li\u1ec7u nh\u1eadp kh\u00f4ng h\u1ee3p l\u1ec7',

  // ─── Rate Limiting ───
  RATE_LIMIT_EXCEEDED: 'Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',

  // ─── File Upload ───
  FILE_TOO_LARGE: 'File qu\u00e1 l\u1edbn. Vui l\u00f2ng ch\u1ecdn file nh\u1ecf h\u01a1n.',
  FILE_TYPE_NOT_ALLOWED: 'Lo\u1ea1i file kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p t\u1ea3i l\u00ean.',
};

/**
 * Get a user-friendly Vietnamese error message for a given error code.
 *
 * @param errorCode - The error code from the backend StandardErrorResponse
 * @returns Vietnamese message string, or a generic fallback if the code is unknown
 */
export function getErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) return DEFAULT_MESSAGE;
  return ERROR_MESSAGES[errorCode] ?? DEFAULT_MESSAGE;
}
