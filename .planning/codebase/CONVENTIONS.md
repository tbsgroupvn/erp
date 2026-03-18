# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Services: `{module}.service.ts` — Business logic, transactional operations
- Controllers: `{module}.controller.ts` — HTTP handlers, decorators, documentation
- Repositories: `{module}.repository.ts` — Data access layer, query builders
- DTOs: `{name}.dto.ts` — Data transfer objects with validation decorators
- Domain services: `{domain}.service.ts` in `domain/` subdirectory — Specialized domain logic
- State machines: `{module}-status.machine.ts` — FSM implementations for domain entities
- Listeners: `{event-name}.listener.ts` — Event handlers in `listeners/` subdirectory
- Guards: `{check}.guard.ts` in `guards/` subdirectory — Authorization/validation middleware
- Decorators: `{feature}.decorator.ts` in `decorators/` — Metadata and parameter extraction

Example paths:
- `src/modules/order/order.service.ts`
- `src/modules/order/order.controller.ts`
- `src/modules/order/dto/create-order.dto.ts`
- `src/modules/order/domain/deposit-gate.service.ts`
- `src/modules/order/domain/order-status.machine.ts`
- `src/modules/order/guards/credit-check.guard.ts`
- `src/core/auth/strategies/jwt.strategy.ts`

**Functions:**
- camelCase for all functions and methods
- Verb prefix for actions: `create*`, `update*`, `delete*`, `validate*`, `calculate*`, `generate*`
- Query methods: `find*`, `get*`, `list*`, `search*`
- Boolean-returning: `is*`, `has*`, `can*`, `should*`
- Event handlers: `handle*` or `on*`

Examples:
```typescript
async createOrder(dto: CreateOrderDto)
async updateOrderStatus(orderId: string, newStatus: OrderStatus)
async validateTransition(from: OrderStatus, to: OrderStatus)
async calculateDeposit(amount: Decimal)
async getOrderById(id: string)
async findOrdersByCustomer(customerId: string)
```

**Variables:**
- camelCase for variables and constants
- UPPER_SNAKE_CASE for constants and enums
- Prefix arrays with plural or array-like names: `orders`, `items`, `results`
- Prefix booleans with `is`, `has`, `can`, `should`: `isActive`, `hasDeposit`, `canTransition`
- Prefix flags with `is` or `use`: `isLoading`, `usePagination`

Examples:
```typescript
const ORDER_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
const APPROVAL_STEPS: Record<ApprovalType, UserRole[]> = { ... };
let isActive = false;
let hasDeposit = true;
const orders: Order[] = [];
```

**Types and Interfaces:**
- PascalCase for all types, interfaces, and classes
- Prefix interfaces with `I` or omit if self-documenting
- Result/response types: `{Operation}Result`, `{Operation}Response`
- DTO suffix: `{Action}Dto` (e.g., `CreateOrderDto`, `UpdateOrderDto`)
- Query/filter types: `{Entity}Query`, `{Entity}Filter`

Examples:
```typescript
interface ICurrentUser { ... }
interface LoginResult { ... }
interface Login2FARequiredResult { ... }
class OrderService { ... }
class CreateOrderDto { ... }
class OrderQueryDto { ... }
```

## Code Style

**Formatting:**
- Tool: Prettier (configured in `.prettierrc`)
- Single quotes: `'string'` not `"string"`
- Trailing commas: Always (arrays, objects, function args)
- Print width: 100 characters
- Tab width: 2 spaces
- Semicolons: Required at statement end
- Line endings: auto (LF on Linux/Mac, CRLF on Windows)

Configuration in `tbs-erp-backend/.prettierrc` and `tbs-erp-frontend/.prettierrc`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "endOfLine": "auto"
}
```

**Linting:**

Backend (`tbs-erp-backend/.eslintrc.js`):
- Parser: `@typescript-eslint/parser`
- Extensions: `plugin:@typescript-eslint/recommended`, `plugin:prettier/recommended`
- Key rules:
  - `@typescript-eslint/no-explicit-any`: warn (discouraged but allowed with justification)
  - `@typescript-eslint/no-unused-vars`: error (with underscore prefix for intentional ignores)
  - `@typescript-eslint/ban-ts-comment`: error (requires description for `// @ts-expect-error`)
  - Explicit function return types: off (inferred from usage)
  - Interface name prefix: off (no requirement to prefix with `I`)

Frontend (`tbs-erp-frontend/.eslintrc.json`):
- Extends: `next/core-web-vitals`, `plugin:jsx-a11y/recommended`
- Key rules:
  - Accessibility violations: warn (jsx-a11y)
  - Click events on non-interactive elements: warn
  - Autofocus: warn

## Import Organization

**Order:**
1. External/third-party imports (React, NestJS, libraries)
2. Internal absolute path imports (using `@/*` aliases)
3. Relative imports (domain-specific modules)
4. Type-only imports (group with `type` keyword)

**Backend example:**
```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { OrderRepository } from './order.repository';
import { DepositGateService } from './domain/deposit-gate.service';

import type { OrderQueryDto } from './dto/order-query.dto';
```

**Frontend example:**
```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ordersApi } from '@/lib/api/orders.api';
import { ServiceType } from '@/lib/types';
import { cn } from '@/lib/utils/cn';
```

**Path Aliases:**

Backend (`tsconfig.json`):
- `@/*`: `src/*` — Root modules
- `@common/*`: `src/common/*` — Guards, decorators, utilities
- `@core/*`: `src/core/*` — Database, auth, cache
- `@modules/*`: `src/modules/*` — Feature modules
- `@config/*`: `src/config/*` — Configuration files

Frontend (`tsconfig.json`):
- `@/*`: `src/*` — All internal code

## Error Handling

**Patterns:**
NestJS uses HTTP exception hierarchy. Always throw with appropriate status code:

```typescript
// 400 Bad Request — Invalid input, logic violation
throw new BadRequestException('Email already registered');
throw new BadRequestException(`Customer ${code} is inactive`);

// 401 Unauthorized — Missing/invalid authentication
throw new UnauthorizedException('Invalid credentials');
throw new UnauthorizedException('Missing X-API-Key header');

// 403 Forbidden — Authenticated but not allowed
throw new ForbiddenException('Insufficient permissions for this action');
throw new ForbiddenException(`Customer ${customerId} blocked for credit`);

// 404 Not Found — Resource doesn't exist
throw new NotFoundException(`Customer with ID ${id} not found`);
throw new NotFoundException(`Order ${orderId} not found`);

// 409 Conflict — State violation
throw new ConflictException('Cannot transition from COMPLETED to SOURCING');
```

**Message format:**
- Include entity identifier: `Customer 123 not found`
- Include brief context: `Cannot transition from COMPLETED to SOURCING`
- No stack traces in messages (logged separately)

**Domain validation:**
- Use domain services (e.g., `OrderStatusMachine.assertTransition()`) to throw domain-specific exceptions
- These wrap `BadRequestException` with domain context

Example:
```typescript
// In OrderStatusMachine
assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!this.validateTransition(from, to)) {
    throw new BadRequestException(
      `Invalid status transition from ${from} to ${to}. ` +
      `Allowed: ${allowed.join(', ')}`
    );
  }
}

// Usage in service
fsm.assertTransition(current, desired); // Throws BadRequestException with context
```

## Logging

**Framework:** Logger from `@nestjs/common`

**Pattern:**
```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async createOrder(dto: CreateOrderDto) {
    this.logger.log(`Creating order for customer ${dto.customerId}`);

    try {
      const result = await this.prisma.order.create({ data: dto });
      this.logger.debug(`Order ${result.id} created successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

**Levels:**
- `log()` — Info-level, normal operations
- `debug()` — Debug details, verbose tracing
- `error()` — Error messages (caught exceptions, failures)
- `warn()` — Warnings (deprecated features, unusual conditions)

**When to log:**
- Log entry points: `Creating order for customer X`
- Log successful state transitions: `Order transitioned from SOURCING to WAREHOUSE_CN`
- Log errors with context: `Failed to calculate deposit: invalid amount`
- Do NOT log sensitive data (passwords, PINs, credit card numbers, PII)

## Comments

**When to comment:**
- Complex business logic: Explain the "why", not the "what"
- Domain constraints: `// MHH service type requires deposit before sourcing`
- Performance notes: `// Query optimized with partial indexes on (customerId, status)`
- Non-obvious algorithm choices: `// Hash-based cache key to handle param ordering`

**JSDoc/TSDoc:**
- Required for public methods and exported functions
- Include `@param`, `@returns`, `@throws`, `@example` tags
- Can omit for trivial getters/setters

Example:
```typescript
/**
 * Validates whether a status transition is allowed.
 *
 * Respects domain-specific rules:
 * - MHH service type must pass through PENDING_DEPOSIT before SOURCING
 * - Terminal statuses (COMPLETED, CANCELLED, RETURNED) allow no transitions
 *
 * @param from Current order status
 * @param to Target order status
 * @param serviceType Optional service type for conditional rules (MHH-specific)
 * @returns true if transition is valid, false otherwise
 * @throws BadRequestException via assertTransition() if validation fails
 *
 * @example
 * const isValid = fsm.validateTransition(
 *   OrderStatus.QUOTATION,
 *   OrderStatus.SOURCING,
 *   ServiceType.MHH
 * ); // returns false
 */
validateTransition(from: OrderStatus, to: OrderStatus, serviceType?: ServiceType): boolean
```

**Code section markers:**
Use comment separators for visual organization:
```typescript
// ─────────────────────────────────────────────────────────
// Public Methods
// ─────────────────────────────────────────────────────────

async createOrder(dto: CreateOrderDto) { ... }

// ─────────────────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────────────────

private validateDeposit(amount: Decimal) { ... }
```

## Function Design

**Size:**
- Keep functions under 50 lines when possible
- Extract complex logic into named helper functions or separate services
- One responsibility per function (SRP)

**Parameters:**
- Prefer objects/DTOs over multiple primitive parameters
- Use named parameters for clarity

Anti-pattern:
```typescript
async createOrder(customerId, amount, serviceType, depositRate, currency, notes)
```

Better:
```typescript
async createOrder(dto: CreateOrderDto) {
  // dto contains all params, properly typed
}
```

**Return values:**
- Return data, not side effects
- Use discriminated unions for multiple return types (especially 2FA flows)

Example:
```typescript
// Type: LoginResponse | Login2FARequiredResult (discriminated by 'requires2FA' field)
async login(email: string, password: string): Promise<LoginResponse> {
  if (user.is2FAEnabled) {
    return { requires2FA: true, userId, methods, tempToken };
  } else {
    return { user, tokens };
  }
}

// Usage
const result = await authService.login(email, pwd);
if ('requires2FA' in result && result.requires2FA) {
  // Handle 2FA flow
} else {
  // Handle normal login
}
```

## Module Design

**Exports:**

Barrel files (`index.ts`) re-export all public APIs:
```typescript
// src/modules/order/index.ts
export * from './order.service';
export * from './order.controller';
export * from './order.module';
export * from './dto/create-order.dto';
export * from './dto/order-query.dto';
```

Import from barrel files at module level:
```typescript
import { OrderService } from '@modules/order';
```

Do NOT export implementation details (private services, internal DTOs).

**Barrel Files:**
- Always create barrel files (`index.ts`) for modules
- Export main service, controller, module
- Export public DTOs
- Do NOT import from barrel files within the same module (causes circular dependencies)

**Module structure:**
```
src/modules/order/
├── order.module.ts              # NestJS module definition
├── order.controller.ts          # HTTP handlers
├── order.service.ts             # Main business logic
├── order.repository.ts          # Data access
├── order-read.service.ts        # Read-model service (if needed)
├── order-status.service.ts      # Status transition logic
├── order-cancellation.service.ts # Cancellation logic
├── domain/                       # Domain-specific services
│   ├── order-status.machine.ts   # FSM implementation
│   ├── deposit-gate.service.ts   # Deposit rules
│   ├── extra-charge.service.ts   # Extra charges
│   └── ...
├── dto/
│   ├── create-order.dto.ts
│   ├── update-order.dto.ts
│   ├── order-query.dto.ts
│   └── ...
├── guards/
│   └── credit-check.guard.ts
├── listeners/
│   ├── warehouse-updated.listener.ts
│   └── ...
├── index.ts                      # Barrel file
└── types/                        # (optional) If complex types
    └── order.interface.ts
```

## API Response Format

**Consistent response wrapper:**
```typescript
export class BaseResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export class PaginatedResponse<T> extends BaseResponse<T[]> {
  meta: PaginationMeta;
}
```

**All endpoints return:**
- Success: `{ success: true, data: {...}, message?: "Created" }`
- Error: `{ success: false, message: "Error details" }` (HTTP status code + message)

**Pagination:**
- Query params: `page` (1-based), `limit` (1-100, default 20), `sortBy`, `sortOrder`
- Response includes `meta: { page, limit, total, totalPages }`

Example:
```typescript
@Get()
@ApiPaginated()
async list(@Query() query: OrderQueryDto) {
  const [items, total] = await this.orderService.findMany(query);
  return new PaginatedResponse(
    items,
    { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    'Orders retrieved'
  );
}
```

## Validation

**DTOs with decorators:**
- Use `class-validator` decorators for all input validation
- Include `@ApiProperty` for Swagger documentation

Example:
```typescript
import { IsString, IsEmail, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'Customer ID', example: 'cust-123' })
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ description: 'Internal notes', example: 'Rush delivery' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Deposit percentage', example: 50 })
  @IsInt()
  @Min(0)
  @Max(100)
  depositRate: number;
}
```

**Custom validators:**
```typescript
// In DTO
validate(): void {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (start > end) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }
}

// In controller
@Post()
async create(@Body() dto: CreateOrderDto) {
  dto.validate(); // Called explicitly before processing
  // ...
}
```

---

*Convention analysis: 2026-03-18*
