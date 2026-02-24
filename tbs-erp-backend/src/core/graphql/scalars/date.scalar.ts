import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'DateTime custom scalar type (ISO 8601)';

  parseValue(value: unknown): Date {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    throw new Error('DateTimeScalar can only parse string or number values');
  }

  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('DateTimeScalar can only serialize Date instances');
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      return new Date(ast.kind === Kind.INT ? parseInt(ast.value, 10) : ast.value);
    }
    throw new Error('DateTimeScalar can only parse string or int literals');
  }
}

@Scalar('Decimal', () => Number)
export class DecimalScalar implements CustomScalar<number, number> {
  description = 'Decimal custom scalar type for monetary values';

  parseValue(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    throw new Error('DecimalScalar can only parse string or number values');
  }

  serialize(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    if (typeof value === 'string') return parseFloat(value);
    throw new Error('DecimalScalar cannot serialize the given value');
  }

  parseLiteral(ast: ValueNode): number {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return parseFloat(ast.value);
    }
    throw new Error('DecimalScalar can only parse float or int literals');
  }
}
