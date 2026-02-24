import { SetMetadata } from '@nestjs/common';

/**
 * Data classification levels for TBS ERP, aligned with ISO 27001 A.8 Asset Management.
 *
 * These classifications determine the sensitivity level of data handled by controller endpoints
 * and are used for:
 * - Access control decisions (ISO 27001 A.9)
 * - Audit logging granularity (ISO 27001 A.12)
 * - Data retention policy enforcement (NĐ 13/2023, Article 11)
 * - Cross-border data transfer controls (NĐ 13/2023, Article 26)
 * - Incident response prioritization (ISO 27001 A.16)
 */
export enum DataClassification {
  /**
   * PUBLIC — Information that can be freely disclosed.
   * Examples: Company name, published service list, public blog posts, FAQs.
   * No access control required.
   */
  PUBLIC = 'PUBLIC',

  /**
   * INTERNAL — Business operational data, not for external disclosure.
   * Examples: Orders, inventory counts, tracking data, task lists.
   * Requires authentication. Logged in audit trail.
   */
  INTERNAL = 'INTERNAL',

  /**
   * CONFIDENTIAL — Sensitive business data with financial or contractual value.
   * Examples: Financial statements, contracts, pricing data, commission rates, AR/AP records.
   * Requires authentication + role-based access. Enhanced audit logging.
   * Subject to Vietnamese tax law retention requirements (Luật Kế toán 2015, Art. 41).
   */
  CONFIDENTIAL = 'CONFIDENTIAL',

  /**
   * RESTRICTED — Highest sensitivity. Personally Identifiable Information (PII),
   * authentication credentials, and system secrets.
   * Examples: Passwords, 2FA secrets, personal phone numbers, salary data, bank accounts.
   * Requires authentication + strict role access. Full audit logging.
   * Subject to NĐ 13/2023/NĐ-CP data protection requirements.
   * Must be encrypted at rest and in transit.
   */
  RESTRICTED = 'RESTRICTED',
}

export const DATA_CLASSIFICATION_KEY = 'data-classification';

/**
 * Decorator to classify the data sensitivity level of a controller endpoint.
 *
 * @example
 * ```typescript
 * @DataClass(DataClassification.RESTRICTED)
 * @Get('users/:id')
 * getUserDetails() { ... }
 * ```
 *
 * @example
 * ```typescript
 * @DataClass(DataClassification.CONFIDENTIAL)
 * @Get('finance/report')
 * getFinancialReport() { ... }
 * ```
 */
export const DataClass = (classification: DataClassification) =>
  SetMetadata(DATA_CLASSIFICATION_KEY, classification);
