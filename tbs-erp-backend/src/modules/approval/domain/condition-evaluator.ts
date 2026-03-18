import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';

export type ConditionOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'IN';

// ---------------------------------------------------------------------------
// Token types used by the compound expression parser
// ---------------------------------------------------------------------------

type TokenKind =
  | 'OPERATOR_LOGICAL' // AND, OR, NOT
  | 'LPAREN'           // (
  | 'RPAREN'           // )
  | 'CONDITION';       // a single comparison: "field op value"

interface Token {
  kind: TokenKind;
  value: string;
}

// Regex that matches a single comparison atom (no parens, no AND/OR/NOT).
// Captures: field  op  value
// Value can be:
//   - a quoted string:  'VIP'  or  "VIP"
//   - an IN list:       ['A','B']  or  [A, B]
//   - a plain number:   50000000
//   - a bare word:      CANCELLED
const ATOM_RE = /^(\w+(?:\.\w+)*)\s*(>=|<=|!=|==|>|<|IN)\s*(.+)$/i;

/**
 * Evaluates conditions for CONDITION nodes in approval flow graphs.
 * Supports numeric comparisons and set membership checks.
 *
 * Simple expressions:
 *   "amount > 50000000"
 *   "status IN ['PENDING','ACTIVE']"
 *
 * Compound expressions (evaluateCompound):
 *   "amount > 50000000 AND customerTier == 'VIP'"
 *   "(discountPercent > 5 OR discountAmount > 100000000) AND serviceType == 'MHH'"
 *   "NOT status == 'CANCELLED'"
 *
 * Test cases (used in unit tests / manual verification):
 *   // "amount > 50000000"                                    → delegates to evaluateExpression
 *   // "amount > 50000000 AND customerTier == 'VIP'"          → compound AND
 *   // "(a > 1 OR b < 2) AND c == 'X'"                       → nested groups
 *   // "NOT status == 'CANCELLED'"                            → NOT prefix
 *   // "NOT (a > 1 AND b > 2)"                               → NOT over group
 *   // "a > 1 OR b > 2 OR c > 3"                             → chained OR
 */
@Injectable()
export class ConditionEvaluator {
  private readonly logger = new Logger(ConditionEvaluator.name);

  /** Maximum allowed expression length (characters). */
  private readonly MAX_EXPR_LEN = 500;

  /** Maximum nesting depth for parenthesised groups. */
  private readonly MAX_DEPTH = 5;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

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
      this.logger.warn(`Field "${field}" not found in request data, defaulting to false`);
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
   * This method is backward-compatible and unchanged.
   */
  evaluateExpression(expression: string, requestData: Record<string, unknown>): boolean {
    if (!expression || expression.trim() === '') {
      return true; // No condition = always true (default edge)
    }

    // Limit expression length to prevent abuse
    if (expression.length > this.MAX_EXPR_LEN) {
      this.logger.warn(`Expression too long (${expression.length} chars), rejecting`);
      return false;
    }

    // Parse simple expressions: "field operator value"
    // Supports: >, >=, <, <=, ==, !=, IN
    const match = expression.match(/^(\w+(?:\.\w+)*)\s*(>=|<=|!=|==|>|<|IN)\s*(.+)$/i);

    if (!match) {
      this.logger.warn(`Cannot parse condition expression: "${expression}", defaulting to false`);
      return false;
    }

    const [, field, op, value] = match;
    const operator = this.mapOperatorSymbol(op.trim());
    return this.evaluate(field, operator, value.trim(), requestData);
  }

  /**
   * Evaluate a potentially compound boolean expression.
   *
   * If the expression does not contain AND/OR/NOT it falls back to
   * `evaluateExpression()` so existing callers are unaffected.
   *
   * Security guards:
   *   - max expression length: 500 characters
   *   - max nesting depth: 5 levels of parentheses
   *
   * @param expression  e.g. "amount > 50000000 AND customerTier == 'VIP'"
   * @param requestData The request payload to evaluate against
   */
  evaluateCompound(expression: string, requestData: Record<string, unknown>): boolean {
    if (!expression || expression.trim() === '') {
      return true;
    }

    if (expression.length > this.MAX_EXPR_LEN) {
      this.logger.warn(`Compound expression too long (${expression.length} chars), rejecting`);
      return false;
    }

    const trimmed = expression.trim();

    // Fast path: no compound operators → delegate to simple evaluator
    if (!this.isCompound(trimmed)) {
      return this.evaluateExpression(trimmed, requestData);
    }

    // Check nesting depth before tokenising (cheap O(n) scan)
    if (!this.checkDepth(trimmed)) {
      this.logger.warn(`Expression exceeds max nesting depth (${this.MAX_DEPTH}), rejecting`);
      return false;
    }

    try {
      const tokens = this.tokenize(trimmed);
      const parser = new ExpressionParser(tokens, this, requestData);
      return parser.parse();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to parse compound expression "${trimmed}": ${message}`);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Determine quickly whether an expression needs the compound parser.
   * We look for word-boundary AND/OR/NOT tokens or parentheses.
   */
  private isCompound(expr: string): boolean {
    return /\b(AND|OR|NOT)\b/i.test(expr) || expr.includes('(');
  }

  /**
   * Verify nesting depth stays within MAX_DEPTH.
   */
  private checkDepth(expr: string): boolean {
    let depth = 0;
    for (const ch of expr) {
      if (ch === '(') {
        depth++;
        if (depth > this.MAX_DEPTH) return false;
      } else if (ch === ')') {
        depth--;
      }
    }
    return true;
  }

  /**
   * Tokenize a compound expression into a flat list of tokens.
   *
   * Strategy: scan left-to-right, greedily accumulating characters
   * into the current "atom" until we hit a logical keyword, paren,
   * or end of string.
   *
   * Quoted strings inside atoms are treated as opaque (we don't
   * split on AND/OR inside single-quotes).
   */
  private tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = expr.length;

    const skipSpaces = () => {
      while (i < len && expr[i] === ' ') i++;
    };

    const readAtom = (): string => {
      let atom = '';
      let inSingleQuote = false;
      let inBracket = 0;

      while (i < len) {
        const ch = expr[i];

        // Track single-quoted strings
        if (ch === "'") {
          inSingleQuote = !inSingleQuote;
          atom += ch;
          i++;
          continue;
        }

        // Inside a quoted string: consume everything
        if (inSingleQuote) {
          atom += ch;
          i++;
          continue;
        }

        // Track bracket nesting (for IN [x, y])
        if (ch === '[') {
          inBracket++;
          atom += ch;
          i++;
          continue;
        }
        if (ch === ']') {
          inBracket--;
          atom += ch;
          i++;
          continue;
        }

        // Inside brackets: consume everything
        if (inBracket > 0) {
          atom += ch;
          i++;
          continue;
        }

        // Parenthesis ends the atom
        if (ch === '(' || ch === ')') break;

        // Check for logical keyword boundary: ' AND ', ' OR ', ' NOT '
        // We need at least a space before the keyword
        if (ch === ' ') {
          const rest = expr.slice(i);
          if (/^ AND\b/i.test(rest) || /^ OR\b/i.test(rest)) {
            break;
          }
          // Trailing spaces inside the atom (e.g. "amount > 50000000   ")
          // are trimmed later; accumulate and continue
        }

        atom += ch;
        i++;
      }

      return atom.trim();
    };

    while (i < len) {
      skipSpaces();
      if (i >= len) break;

      const ch = expr[i];

      if (ch === '(') {
        tokens.push({ kind: 'LPAREN', value: '(' });
        i++;
        continue;
      }

      if (ch === ')') {
        tokens.push({ kind: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      // Check for logical keyword at current position (word boundary)
      const rest = expr.slice(i);

      if (/^AND\b/i.test(rest)) {
        tokens.push({ kind: 'OPERATOR_LOGICAL', value: 'AND' });
        i += 3;
        continue;
      }

      if (/^OR\b/i.test(rest)) {
        tokens.push({ kind: 'OPERATOR_LOGICAL', value: 'OR' });
        i += 2;
        continue;
      }

      if (/^NOT\b/i.test(rest)) {
        tokens.push({ kind: 'OPERATOR_LOGICAL', value: 'NOT' });
        i += 3;
        continue;
      }

      // Otherwise: read an atom (comparison expression)
      const atom = readAtom();
      if (atom.length > 0) {
        tokens.push({ kind: 'CONDITION', value: atom });
      }
    }

    return tokens;
  }

  // -------------------------------------------------------------------------
  // Field resolution & comparison (shared by evaluate + compound parser)
  // -------------------------------------------------------------------------

  /**
   * Resolve a potentially nested field path (e.g. "order.amount").
   */
  private resolveField(field: string, data: Record<string, unknown>): unknown {
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

  private compare(actual: unknown, operator: ConditionOperator, conditionValue: string): boolean {
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

  // -------------------------------------------------------------------------
  // Package-internal: used by ExpressionParser to evaluate single atoms
  // -------------------------------------------------------------------------

  /** @internal */
  _evalAtom(atom: string, requestData: Record<string, unknown>): boolean {
    const match = atom.match(ATOM_RE);
    if (!match) {
      this.logger.warn(`Cannot parse atom: "${atom}", defaulting to false`);
      return false;
    }
    const [, field, op, value] = match;
    const operator = this.mapOperatorSymbol(op.trim().toUpperCase());
    return this.evaluate(field, operator, value.trim(), requestData);
  }
}

// =============================================================================
// Recursive-Descent Parser
// =============================================================================

/**
 * Simple recursive-descent parser for compound boolean expressions.
 *
 * Grammar:
 *   expr     ::= orExpr
 *   orExpr   ::= andExpr ( 'OR' andExpr )*
 *   andExpr  ::= notExpr ( 'AND' notExpr )*
 *   notExpr  ::= 'NOT' notExpr | primary
 *   primary  ::= '(' expr ')' | CONDITION
 */
class ExpressionParser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly evaluator: ConditionEvaluator,
    private readonly requestData: Record<string, unknown>,
  ) {}

  parse(): boolean {
    const result = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new DomainException(
        ErrorCode.APPROVAL_CONDITION_PARSE_ERROR,
        `Unexpected token "${this.tokens[this.pos].value}" at position ${this.pos}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return result;
  }

  // ---------------------------------------------------------------------------

  private parseOr(): boolean {
    let left = this.parseAnd();

    while (this.peek()?.value?.toUpperCase() === 'OR') {
      this.consume(); // eat OR
      const right = this.parseAnd();
      left = left || right;
    }

    return left;
  }

  private parseAnd(): boolean {
    let left = this.parseNot();

    while (this.peek()?.value?.toUpperCase() === 'AND') {
      this.consume(); // eat AND
      const right = this.parseNot();
      left = left && right;
    }

    return left;
  }

  private parseNot(): boolean {
    if (this.peek()?.value?.toUpperCase() === 'NOT') {
      this.consume(); // eat NOT
      return !this.parseNot();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): boolean {
    const token = this.peek();

    if (!token) {
      throw new DomainException(ErrorCode.APPROVAL_CONDITION_PARSE_ERROR, 'Unexpected end of expression', HttpStatus.BAD_REQUEST);
    }

    if (token.kind === 'LPAREN') {
      this.consume(); // eat (
      const result = this.parseOr();

      const closing = this.peek();
      if (!closing || closing.kind !== 'RPAREN') {
        throw new DomainException(ErrorCode.APPROVAL_CONDITION_PARSE_ERROR, 'Missing closing parenthesis', HttpStatus.BAD_REQUEST);
      }
      this.consume(); // eat )
      return result;
    }

    if (token.kind === 'CONDITION') {
      this.consume();
      return this.evaluator._evalAtom(token.value, this.requestData);
    }

    throw new DomainException(ErrorCode.APPROVAL_CONDITION_PARSE_ERROR, `Unexpected token "${token.value}" (kind=${token.kind})`, HttpStatus.BAD_REQUEST);
  }

  // ---------------------------------------------------------------------------

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }
}
