/**
 * Centralized file upload MIME type and size limit constants.
 *
 * Each category defines the maximum file size (in bytes) and
 * an allowlist of MIME types for that upload context.
 */
export const FILE_UPLOAD_LIMITS = {
  IMAGE: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  DOCUMENT: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  CMS_MEDIA: {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
    ],
  },
  DRIVE: {
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  BATCH_IMPORT: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  CARRIER_RECON: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  BANK_STATEMENT: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain', // MT940 format
    ],
  },
} as const;
