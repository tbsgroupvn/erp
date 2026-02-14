import { IPaginatedResult } from './paginated-result.interface';
import { PaginationDto } from '../dto/pagination.dto';

/**
 * Generic base service interface that defines standard CRUD operations.
 * All module services should implement this interface to ensure consistency.
 *
 * @template T - The entity type returned by the service
 * @template CreateDto - The DTO type for creating a new entity
 * @template UpdateDto - The DTO type for updating an existing entity
 *
 * @example
 * @Injectable()
 * export class OrderService implements IBaseService<Order, CreateOrderDto, UpdateOrderDto> {
 *   async findAll(pagination: PaginationDto, filters?: any): Promise<IPaginatedResult<Order>> { ... }
 *   async findById(id: string): Promise<T | null> { ... }
 *   async create(dto: CreateOrderDto): Promise<Order> { ... }
 *   async update(id: string, dto: UpdateOrderDto): Promise<Order> { ... }
 *   async delete(id: string): Promise<Order> { ... }
 * }
 */
export interface IBaseService<T, CreateDto = any, UpdateDto = any> {
  /**
   * Retrieves a paginated list of entities.
   * @param pagination - Pagination parameters (page, limit, sort)
   * @param filters - Optional filtering criteria
   */
  findAll(
    pagination: PaginationDto,
    filters?: Record<string, unknown>,
  ): Promise<IPaginatedResult<T>>;

  /**
   * Retrieves a single entity by its ID.
   * @param id - The entity's unique identifier
   * @returns The entity if found, or null
   */
  findById(id: string): Promise<T | null>;

  /**
   * Creates a new entity.
   * @param dto - The data for creating the entity
   * @returns The newly created entity
   */
  create(dto: CreateDto): Promise<T>;

  /**
   * Updates an existing entity.
   * @param id - The entity's unique identifier
   * @param dto - The data for updating the entity
   * @returns The updated entity
   */
  update(id: string, dto: UpdateDto): Promise<T>;

  /**
   * Deletes an entity by its ID (soft or hard delete depending on implementation).
   * @param id - The entity's unique identifier
   * @returns The deleted entity
   */
  delete(id: string): Promise<T>;
}
