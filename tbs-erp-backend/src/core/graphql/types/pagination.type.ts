import { Type } from '@nestjs/common';
import { Field, ObjectType, Int } from '@nestjs/graphql';

/**
 * Generic paginated response wrapper for GraphQL.
 *
 * Usage:
 *   @ObjectType()
 *   class PaginatedOrders extends PaginatedResponse(OrderType) {}
 */
export function PaginatedResponse<T>(classRef: Type<T>): any {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType {
    @Field(() => [classRef], { description: 'List of items on the current page' })
    items: T[];

    @Field(() => Int, { description: 'Total number of matching items' })
    total: number;

    @Field(() => Int, { description: 'Current page number' })
    page: number;

    @Field(() => Int, { description: 'Number of items per page' })
    limit: number;

    @Field(() => Int, { description: 'Total number of pages' })
    totalPages: number;

    @Field({ description: 'Whether there is a next page' })
    hasNextPage: boolean;

    @Field({ description: 'Whether there is a previous page' })
    hasPreviousPage: boolean;
  }

  return PaginatedType;
}
