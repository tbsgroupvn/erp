import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ComplianceStatus } from '@prisma/client';

export interface ComplianceCheckResult {
  ruleId: string;
  ruleType: string;
  hsCodePattern: string;
  message: string;
  severity: string;
  permitType: string | null;
}

export interface ComplianceAlert {
  id: string;
  declarationId: string;
  lineId: string | null;
  alertType: string;
  severity: string;
  message: string;
  hsCode: string | null;
}

/**
 * Service for checking customs declaration lines against compliance rules.
 *
 * Compliance checks include:
 *  - HS code matching against RESTRICTED, PROHIBITED, and PERMIT_REQUIRED rules
 *  - Value anomaly detection (declared value significantly below internal value)
 *  - Permit requirement flagging
 *
 * Rules support wildcard matching for HS code patterns (e.g., "3926.*" matches
 * any code starting with "3926.").
 */
@Injectable()
export class ComplianceCheckerService {
  private readonly logger = new Logger(ComplianceCheckerService.name);

  /** Threshold below which a value anomaly is flagged (30%) */
  private readonly VALUE_ANOMALY_THRESHOLD = 0.3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks all lines of a customs declaration against active compliance rules.
   *
   * For each line:
   *  - Matches HS code against rules (supporting wildcard patterns)
   *  - Checks for value anomalies (declared < 30% of internal)
   *  - Creates ComplianceAlert records for each violation
   *  - Updates line-level and declaration-level compliance status
   *
   * @param declarationId - The customs declaration ID to check
   * @returns Array of newly created compliance alerts
   */
  async checkDeclaration(declarationId: string): Promise<ComplianceAlert[]> {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: { lines: true },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    // Load all active compliance rules
    const rules = await this.prisma.complianceRule.findMany({
      where: { isActive: true },
    });

    // Clear existing alerts for this declaration before re-checking
    await this.prisma.complianceAlert.deleteMany({
      where: { declarationId },
    });

    const newAlerts: ComplianceAlert[] = [];
    let hasProhibited = false;
    let hasWarning = false;

    for (const line of declaration.lines) {
      const lineAlerts: ComplianceAlert[] = [];

      // Check HS code against compliance rules
      for (const rule of rules) {
        if (this.matchHsCode(line.declaredHsCode, rule.hsCodePattern)) {
          const severity = rule.ruleType === 'PROHIBITED' ? 'CRITICAL' : 'WARNING';

          const alert = await this.prisma.complianceAlert.create({
            data: {
              declarationId,
              lineId: line.id,
              alertType: rule.ruleType,
              severity,
              message: rule.message,
              hsCode: line.declaredHsCode,
            },
          });

          lineAlerts.push(alert);

          if (rule.ruleType === 'PROHIBITED') {
            hasProhibited = true;
          } else {
            hasWarning = true;
          }

          // If a permit is required, flag the line
          if (rule.ruleType === 'PERMIT_REQUIRED' && rule.permitType) {
            await this.prisma.customsDeclarationLine.update({
              where: { id: line.id },
              data: {
                requiresPermit: true,
                permitType: rule.permitType,
              },
            });
          }
        }
      }

      // Check for value anomaly: declared value < 30% of internal value
      const declaredValue = Number(line.declaredTotalValue);
      const internalValue = Number(line.internalTotalValue);

      if (internalValue > 0 && declaredValue < internalValue * this.VALUE_ANOMALY_THRESHOLD) {
        const alert = await this.prisma.complianceAlert.create({
          data: {
            declarationId,
            lineId: line.id,
            alertType: 'VALUE_ANOMALY',
            severity: 'WARNING',
            message:
              `Gia tri khai bao (${declaredValue}) thap hon 30% gia tri thuc te (${internalValue}). ` +
              `Ty le: ${((declaredValue / internalValue) * 100).toFixed(1)}%`,
            hsCode: line.declaredHsCode,
          },
        });

        lineAlerts.push(alert);
        hasWarning = true;
      }

      // Update line compliance status
      const lineStatus = lineAlerts.some((a) => a.alertType === 'PROHIBITED')
        ? ComplianceStatus.BLOCKED
        : lineAlerts.length > 0
          ? ComplianceStatus.WARNING
          : ComplianceStatus.CLEAR;

      await this.prisma.customsDeclarationLine.update({
        where: { id: line.id },
        data: { complianceStatus: lineStatus },
      });

      newAlerts.push(...lineAlerts);
    }

    // Update declaration-level compliance status
    const declarationStatus = hasProhibited
      ? ComplianceStatus.BLOCKED
      : hasWarning
        ? ComplianceStatus.WARNING
        : ComplianceStatus.CLEAR;

    await this.prisma.customsDeclaration.update({
      where: { id: declarationId },
      data: { complianceStatus: declarationStatus },
    });

    this.logger.log(
      `Compliance check for declaration ${declaration.code}: ` +
        `${newAlerts.length} alerts found, status=${declarationStatus}`,
    );

    return newAlerts;
  }

  /**
   * Quick compliance check for a single HS code.
   *
   * Checks the code against all active rules without creating any database
   * records. Useful for real-time validation in the UI.
   *
   * @param hsCode - The HS code to check
   * @returns Status and matching compliance check results
   */
  async checkHsCode(
    hsCode: string,
  ): Promise<{ status: ComplianceStatus; alerts: ComplianceCheckResult[] }> {
    const rules = await this.prisma.complianceRule.findMany({
      where: { isActive: true },
    });

    const alerts: ComplianceCheckResult[] = [];
    let hasProhibited = false;
    let hasWarning = false;

    for (const rule of rules) {
      if (this.matchHsCode(hsCode, rule.hsCodePattern)) {
        alerts.push({
          ruleId: rule.id,
          ruleType: rule.ruleType,
          hsCodePattern: rule.hsCodePattern,
          message: rule.message,
          severity: rule.ruleType === 'PROHIBITED' ? 'CRITICAL' : 'WARNING',
          permitType: rule.permitType,
        });

        if (rule.ruleType === 'PROHIBITED') {
          hasProhibited = true;
        } else {
          hasWarning = true;
        }
      }
    }

    const status = hasProhibited
      ? ComplianceStatus.BLOCKED
      : hasWarning
        ? ComplianceStatus.WARNING
        : ComplianceStatus.CLEAR;

    return { status, alerts };
  }

  /**
   * Matches an HS code against a rule pattern.
   *
   * Supports wildcard patterns:
   *  - "3926.*" matches "3926.90.99", "3926.10.00", etc.
   *  - "3926.90.*" matches "3926.90.99", "3926.90.10", etc.
   *  - Exact match: "3926.90.99" matches only "3926.90.99"
   *
   * @param hsCode - The actual HS code to test
   * @param pattern - The rule pattern (may contain wildcards)
   * @returns true if the HS code matches the pattern
   */
  private matchHsCode(hsCode: string, pattern: string): boolean {
    // Exact match
    if (pattern === hsCode) {
      return true;
    }

    // Wildcard match: convert pattern to regex
    if (pattern.includes('*')) {
      const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr);
        return regex.test(hsCode);
      } catch {
        this.logger.warn(`Invalid compliance rule pattern: ${pattern}`);
        return false;
      }
    }

    return false;
  }
}
