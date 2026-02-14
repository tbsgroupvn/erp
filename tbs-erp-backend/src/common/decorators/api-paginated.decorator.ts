import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/**
 * Composite decorator that adds standard pagination query parameters
 * to Swagger documentation.
 *
 * Adds: page, limit, sortBy, sortOrder query params.
 *
 * @example
 * @ApiPaginated()
 * @Get()
 * findAll(@Query() pagination: PaginationDto) { ... }
 */
export function ApiPaginated() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (default: 20, max: 100)',
      example: 20,
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      description: 'Field to sort by (default: createdAt)',
      example: 'createdAt',
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      enum: ['ASC', 'DESC'],
      description: 'Sort direction (default: DESC)',
      example: 'DESC',
    }),
  );
}
