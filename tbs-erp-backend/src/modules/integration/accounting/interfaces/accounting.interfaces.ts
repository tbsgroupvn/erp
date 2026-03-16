/**
 * Result of exporting journal entries to MISA accounting format.
 */
export interface MisaExportResult {
  /** Total number of journal entries exported */
  totalEntries: number;
  /** Total debit amount */
  totalDebit: number;
  /** Total credit amount */
  totalCredit: number;
  /** Date range of exported entries */
  dateRange: { from: string; to: string };
  /** Export file URL or buffer reference */
  fileUrl?: string;
  /** MISA-compatible XML/JSON export data */
  exportFormat: 'XML' | 'JSON' | 'EXCEL';
  /** Any entries that could not be mapped */
  unmappedEntries: Array<{
    entryId: string;
    reason: string;
  }>;
  /** Timestamp of the export */
  exportedAt: Date;
}

/**
 * Result of exporting journal entries to Fast Accounting format.
 */
export interface FastExportResult {
  /** Total number of journal entries exported */
  totalEntries: number;
  /** Total debit amount */
  totalDebit: number;
  /** Total credit amount */
  totalCredit: number;
  /** Date range of exported entries */
  dateRange: { from: string; to: string };
  /** Export file URL or buffer reference */
  fileUrl?: string;
  /** Fast-compatible export format */
  exportFormat: 'CSV' | 'EXCEL' | 'FAST_XML';
  /** Any entries that could not be mapped */
  unmappedEntries: Array<{
    entryId: string;
    reason: string;
  }>;
  /** Timestamp of the export */
  exportedAt: Date;
}

/**
 * Result of syncing chart of accounts with an external accounting provider.
 */
export interface SyncResult {
  /** Accounting provider name */
  provider: 'MISA' | 'FAST';
  /** Number of accounts synced */
  totalSynced: number;
  /** Number of new accounts created */
  newAccounts: number;
  /** Number of accounts updated */
  updatedAccounts: number;
  /** Number of accounts that failed to sync */
  failedAccounts: number;
  /** Details of failed syncs */
  failures: Array<{
    accountCode: string;
    reason: string;
  }>;
  /** Timestamp of the sync */
  syncedAt: Date;
}

/**
 * DTO for requesting financial statement export.
 */
export interface FinancialStatementType {
  /** Type of financial statement */
  type: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'TRIAL_BALANCE' | 'GENERAL_LEDGER';
}

/**
 * Result of importing bank statements.
 */
export interface ImportResult {
  /** Bank code */
  bankCode: string;
  /** Total number of transactions imported */
  totalTransactions: number;
  /** Number of new transactions (not duplicates) */
  newTransactions: number;
  /** Number of duplicate transactions skipped */
  duplicateTransactions: number;
  /** Number of transactions that failed to import */
  failedTransactions: number;
  /** Details of failed imports */
  failures: Array<{
    line: number;
    reason: string;
  }>;
  /** Total credit amount */
  totalCredit: number;
  /** Total debit amount */
  totalDebit: number;
  /** Timestamp of the import */
  importedAt: Date;
}
