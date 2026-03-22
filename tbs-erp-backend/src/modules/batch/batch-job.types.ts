export enum BatchJobType {
  IMPORT_ORDERS = 'IMPORT_ORDERS',
  IMPORT_CUSTOMERS = 'IMPORT_CUSTOMERS',
  EXPORT_ORDERS = 'EXPORT_ORDERS',
  EXPORT_AR_REPORT = 'EXPORT_AR_REPORT',
  EXPORT_COMMISSION = 'EXPORT_COMMISSION',
  EXPORT_CUSTOMS = 'EXPORT_CUSTOMS',
}

export interface BatchJobPayload {
  type: BatchJobType;
  userId: string;
  /** For imports: file path in temp storage */
  filePath?: string;
  /** For exports: query filters */
  filters?: Record<string, unknown>;
  format?: 'XLSX' | 'CSV';
}

export interface BatchJobResult {
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors?: Array<{ row: number; field: string; message: string }>;
  /** For exports: path to generated file */
  outputFilePath?: string;
}
