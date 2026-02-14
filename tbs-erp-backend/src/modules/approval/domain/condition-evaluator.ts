import { Injectable, Logger } from '@nestjs/common';

export type ConditionOperator =
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'EQ'
  | 'NEQ'
  | 'IN';

/**
 * Evaluates conditions for CONDITION nodes in approval flow graphs.
 * Supports numeric comparisons and set membership checks.
 */
@Injectable()
export class ConditionEvaluator {
  private readonly logger = new Logger(ConditionEvaluator.name);

  /**
   * Evaluate a single condition against request data.
   */
  evaluate(
    field: string,
    operator: ConditionOperator,
    conditionValue: string,
    requestData: Record<string, unknown>,
  ): boolean {
    const actualValue = this.resolveField(field, requestData);

    if (actualValue === undefined || actualValue === null) {
      this.logger.warn(
        `Field "${field}" not found in request data, defaulting to false`,
      );
      return false;
    }

    const result = this.compare(actualValue, operator, conditionValue);

    this.logger.debug(
      `Condition: ${field}(${actualValue}) ${operator} ${conditionValue} => ${result}`,
    );

    return result;
  }

  /**
   * Evaluate a condition expression string like "amount > 50000000".
   */
  evaluateExpression(
    expression: string,
    requestData: Record<string, unknown>,
  ): boolean {
    if (!expression || expression.trim() === '') {
      return true; // No condition = always true (default edge)
    }

    // Limit expression length to prevent abuse
    if (expression.length > 500) {
      this.logger.warn(`Expression too long (${expression.length} chars), rejecting`);
      return false;
    }

    // Parse simple expressions: "field operator value"
    // Supports: >, >=, <, <=, ==, !=, IN
    const match = expression.match(
      /^(\w+(?:\.\w+)*)\s*(>=|<=|!=|==|>|<|IN)\s*(.+)$/i,
    );

    if (!match) {
      this.logger.warn(
        `Cannot parse condition expression: "${expression}", defaulting to false`,
      );
      return false;
    }

    const [, field, op, value] = match;
    const operator = this.mapOperatorSymbol(op.trim());
    return this.evaluate(field, operator, value.trim(), requestData);
  }

  /**
   * Resolve a potentially nested field path (e.g. "order.amount").
   */
  private resolveField(
    field: string,
    data: Record<string, unknown>,
  ): unknown {
    // Validate field name: only allow alphanumeric characters and dots (max 10 levels)
    if (!/^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*$/.test(field)) {
      this.logger.warn(`Invalid field name: "${field}"`);
      return undefined;
    }
    const parts = field.split('.');
    if (parts.length > 10) {
      this.logger.warn(`Field path too deep: "${field}"`);
      return undefined;
    }
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private compare(
    actual: unknown,
    operator: ConditionOperator,
    conditionValue: string,
  ): boolean {
    if (operator === 'IN') {
      const values = conditionValue
        .replace(/[\[\]]/g, '')
        .split(',')
        .map((v) => v.trim().replace(/['"]/g, ''));
      return values.includes(String(actual));
    }

    const numActual = Number(actual);
    const numCondition = Number(conditionValue);

    // If both are numeric, compare as numbers
    if (!isNaN(numActual) && !isNaN(numCondition)) {
      switch (operator) {
        case 'GT':
          return numActual > numCondition;
        case 'GTE':
          return numActual >= numCondition;
        case 'LT':
          return numActual < numCondition;
        case 'LTE':
          return numActual <= numCondition;
        case 'EQ':
          return numActual === numCondition;
        case 'NEQ':
          return numActual !== numCondition;
        default:
          return false;
      }
    }

    // String comparison
    const strActual = String(actual);
    const strCondition = conditionValue.replace(/['"]/g, '');

    switch (operator) {
      case 'EQ':
        return strActual === strCondition;
      case 'NEQ':
        return strActual !== strCondition;
      default:
        return false;
    }
  }

  private mapOperatorSymbol(symbol: string): ConditionOperator {
    switch (symbol) {
      case '>':
        return 'GT';
      case '>=':
        return 'GTE';
      case '<':
        return 'LT';
      case '<=':
        return 'LTE';
      case '==':
        return 'EQ';
      case '!=':
        return 'NEQ';
      case 'IN':
        return 'IN';
      default:
        return 'EQ';
    }
  }
}
