/**
 * Bank account balance information.
 */
export interface BankBalance {
  /** Bank account number */
  accountNumber: string;
  /** Account holder name */
  accountName: string;
  /** Bank code */
  bankCode: string;
  /** Bank name */
  bankName: string;
  /** Current available balance */
  availableBalance: number;
  /** Current ledger balance (includes pending transactions) */
  ledgerBalance: number;
  /** Currency code */
  currency: string;
  /** Balance as of this timestamp */
  asOf: Date;
}

/**
 * A single bank transaction record.
 */
export interface BankTransaction {
  /** Transaction ID from the bank */
  transactionId: string;
  /** Transaction date */
  transactionDate: Date;
  /** Value date */
  valueDate: Date;
  /** Transaction type: credit or debit */
  type: 'CREDIT' | 'DEBIT';
  /** Transaction amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Balance after this transaction */
  runningBalance: number;
  /** Transaction description / narrative */
  description: string;
  /** Counterparty account number */
  counterpartyAccount?: string;
  /** Counterparty name */
  counterpartyName?: string;
  /** Bank reference number */
  bankReference: string;
  /** Whether this transaction has been reconciled in the ERP */
  isReconciled: boolean;
}

/**
 * Result of automatic payment reconciliation.
 */
export interface ReconciliationResult {
  /** Bank code processed */
  bankCode: string;
  /** Date range of reconciliation */
  dateRange: { from: string; to: string };
  /** Total bank transactions processed */
  totalBankTransactions: number;
  /** Number of transactions auto-matched to ERP records */
  autoMatched: number;
  /** Number of transactions that could not be matched */
  unmatched: number;
  /** Number of transactions already reconciled (skipped) */
  alreadyReconciled: number;
  /** Details of auto-matched transactions */
  matches: Array<{
    bankTransactionId: string;
    erpRecordId: string;
    erpRecordType: 'VOUCHER' | 'INVOICE' | 'ORDER';
    amount: number;
    matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  /** Details of unmatched transactions */
  unmatchedTransactions: Array<{
    bankTransactionId: string;
    amount: number;
    description: string;
    transactionDate: Date;
  }>;
  /** Timestamp of reconciliation */
  reconciledAt: Date;
}

/**
 * Result of initiating a bank transfer.
 */
export interface TransferResult {
  /** Transfer reference ID */
  transferId: string;
  /** Status of the transfer */
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  /** Source account number */
  fromAccount: string;
  /** Destination account number */
  toAccount: string;
  /** Transfer amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Bank fee charged */
  fee: number;
  /** Expected completion time */
  expectedCompletionAt?: Date;
  /** Transfer reference from the bank */
  bankReference?: string;
  /** Any error message */
  errorMessage?: string;
}

/**
 * Information about a supported bank.
 */
export interface BankInfo {
  /** Bank code (e.g., VCB, TCB, BIDV) */
  code: string;
  /** Full bank name */
  name: string;
  /** Short name / abbreviation */
  shortName: string;
  /** SWIFT/BIC code */
  swiftCode: string;
  /** Whether API integration is available */
  apiAvailable: boolean;
  /** Supported features */
  features: Array<'BALANCE' | 'TRANSACTIONS' | 'TRANSFER' | 'RECONCILIATION'>;
  /** Bank logo URL */
  logoUrl?: string;
}
