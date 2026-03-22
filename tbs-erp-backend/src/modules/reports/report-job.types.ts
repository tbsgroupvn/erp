export enum ReportJobType {
  DAILY_REVENUE = 'DAILY_REVENUE',
  DAILY_CONTAINER_TRACKING = 'DAILY_CONTAINER_TRACKING',
  WEEKLY_AR_AGING = 'WEEKLY_AR_AGING',
  MONTHLY_COMMISSION = 'MONTHLY_COMMISSION',
}

export interface ReportJobPayload {
  reportType: ReportJobType;
  /** ISO date string: YYYY-MM-DD */
  date: string;
  /** userId if triggered manually via API */
  requestedBy?: string;
  format: 'CSV' | 'HTML';
  /** Email addresses for delivery */
  recipients?: string[];
}
