# Phase 5: RBAC Audit & Coverage - Research

**Researched:** 2026-03-19
**Domain:** NestJS RBAC / Authorization / Data Scoping
**Confidence:** HIGH

## Summary

Phase 5 addresses three requirements (SEC-01, SEC-02, SEC-03) that ensure every controller endpoint has explicit access control, a CI-enforced integration test validates decorator presence, and data scoping restricts visibility by role. The codebase already has substantial RBAC infrastructure: `RolesGuard`, `@Roles()` decorator, `@Public()` decorator, `DataScopeGuard`, `DataScopeService`, and a comprehensive `CaslAbilityFactory` with per-role ability definitions. However, 14 of 94 controller files currently lack any RBAC decorators (`@Roles` or `@Public`), and the `RolesGuard` uses raw `ForbiddenException` instead of `DomainException`.

The existing `DataScopeService` in `src/core/rbac/data-scope.service.ts` already implements the exact scoping rules specified in SEC-03 (Sales sees own, Sales Leader sees team, CEO sees all). The `DataScopeGuard` in `src/common/guards/data-scope.guard.ts` builds scope filters and attaches them to `request.dataScope`. However, only ~10 controller/service files currently consume these scope filters. The primary work is: (1) writing an integration test using NestJS `DiscoveryService` + `Reflector` to scan all controllers, (2) adding missing `@Roles()` decorators to 14 undecorated controllers, (3) upgrading `RolesGuard` to use `DomainException` with role details, and (4) wiring `DataScopeService` into key services (CRM, orders, complaints) that don't yet apply scoping.

**Primary recommendation:** Use `DiscoveryService.getControllers()` + `Reflector` to build the audit test, add `@Roles()` to all undecorated non-public controllers, upgrade `RolesGuard` error response to include user role + required roles, and ensure CRM/order/complaint services use `DataScopeService` for query filtering.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Create an integration test using NestJS `DiscoveryService` that scans all controller methods via reflection
- The test asserts every method has either `@Roles()` decorator OR `@Public()` marker -- zero undecorated methods allowed
- The test runs in CI and fails if any new endpoint is added without explicit access control
- For the initial pass: audit all 84 controllers and add missing `@Roles()` decorators based on the 22-role matrix from CLAUDE.md
- Claude has discretion on the exact role assignments per endpoint (based on business logic analysis)
- Public endpoints (already marked `@Public()`) remain untouched
- Sales (`SALE`) sees only own customers (filtered by `salesRepId === currentUser.id`)
- Sales Leader (`SALES_LEADER`) sees own team's customers
- CEO, COO, CFO, Directors see all data (no scoping)
- Warehouse staff see only warehouse-relevant data
- Accountants see finance-relevant data across all orders
- Implement data scoping via a reusable `DataScopeInterceptor` or query filter utility
- Key data scoping targets: customer queries (CRM), order queries, complaint queries
- Update `RolesGuard` to use `DomainException` (Phase 1) instead of raw `ForbiddenException`
- Include in error response: `errorCode: 'FORBIDDEN'`, user's current role, required roles
- Error message format: `"Ban khong co quyen thuc hien thao tac nay. Vai tro hien tai: {role}. Yeu cau: {requiredRoles}"`
- Return `requestId` in 403 responses (already handled by Phase 1 exception filters)

### Claude's Discretion
- Exact role assignments per controller method (based on business domain analysis)
- Data scoping implementation approach (interceptor vs service filter vs Prisma middleware)
- Whether to scope data at the controller level (interceptor) or service level (query builder)
- How to handle cross-role visibility (e.g., accountant needs order data but shouldn't modify orders)
- Integration test structure (single test file vs per-module test files)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Every controller method has explicit `@Roles()` decorator (or is explicitly marked `@Public()`) | 14 of 94 controller files lack RBAC decorators; existing `@Roles()` and `@Public()` decorators are well-established; `ROLES_KEY` and `IS_PUBLIC_KEY` metadata keys are the detection targets |
| SEC-02 | Integration test exists that scans all controller methods via NestJS reflection and asserts RBAC decorator presence | NestJS v11.1.15 `DiscoveryService` + `Reflector` API fully supports this; `getControllers()` returns all controller instances; `Reflector.getAllAndOverride()` checks metadata per method |
| SEC-03 | All 22 roles have correct data scoping -- Sales sees only own customers, CEO sees all, etc. | `DataScopeService` already implements correct scoping logic; `DataScopeGuard` exists; only ~10 files currently use it; CRM service already injects `DataScopeService` but not all queries apply it |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/core | 11.1.15 | DiscoveryService, Reflector for metadata scanning | Built-in NestJS reflection API |
| @nestjs/common | 11.1.16 | SetMetadata, Guards, Decorators | Core NestJS decorators |
| jest | 29.7.0 | Test runner for integration test | Already configured in project |
| @prisma/client | (installed) | UserRole enum, database queries | Already used for role definitions |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @casl/ability | ^6.7.2 | CaslAbilityFactory for fine-grained permissions | Already in package.json, used by RbacModule |
| @casl/prisma | ^1.5.0 | CASL + Prisma integration | Already in package.json |

### No New Dependencies Required
This phase requires zero new npm packages. All necessary APIs are available in the existing NestJS core and testing stack.

## Architecture Patterns

### Existing RBAC Architecture
```
src/
├── core/rbac/
│   ├── guards/roles.guard.ts       # RolesGuard (needs DomainException upgrade)
│   ├── decorators/roles.decorator.ts # @Roles() with ROLES_KEY
│   ├── casl-ability.factory.ts      # Per-role CASL abilities (already complete)
│   ├── data-scope.service.ts        # Query filter builder by role
│   ├── roles.enum.ts                # Role groups, isExecutive(), getRoleLabel()
│   └── rbac.module.ts               # Exports CaslAbilityFactory, DataScopeService
├── common/
│   ├── guards/
│   │   ├── data-scope.guard.ts      # Attaches request.dataScope
│   │   └── roles.guard.ts           # Re-export of core RolesGuard
│   ├── decorators/
│   │   ├── public.decorator.ts      # @Public() with IS_PUBLIC_KEY
│   │   ├── roles.decorator.ts       # Re-export of core @Roles()
│   │   └── data-scope.decorator.ts  # @DataScope() param decorator
│   └── exceptions/
│       ├── domain.exception.ts      # DomainException (Phase 1)
│       └── error-codes.ts           # ErrorCode registry (FORBIDDEN exists)
```

### Pattern 1: Controller RBAC Decoration
**What:** Every controller uses `@UseGuards(JwtAuthGuard, RolesGuard)` at class level, and `@Roles(UserRole.X, ...)` at method level.
**When to use:** All authenticated endpoints.
**Example (from order.controller.ts):**
```typescript
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('orders')
export class OrderController {
  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER)
  async findAll() { /* ... */ }
}
```

### Pattern 2: Public Endpoint Decoration
**What:** Endpoints accessible without authentication use `@Public()` which bypasses JwtAuthGuard.
**When to use:** Health checks, public website API, webhook receivers.
**Example (from public.controller.ts):**
```typescript
@Public()
@Post('leads')
@HttpCode(HttpStatus.CREATED)
async captureLeads(@Body() dto: CaptureLeadDto) { /* ... */ }
```

### Pattern 3: Data Scope at Service Level
**What:** Services inject `DataScopeService` and call `getDataScopeFilter(user, entityType)` to get Prisma WHERE conditions.
**When to use:** List/read endpoints where role-based data filtering is needed.
**Example (from crm.service.ts):**
```typescript
@Injectable()
export class CrmService {
  constructor(private readonly dataScopeService: DataScopeService) {}

  async findAll(query: CustomerQueryDto, user: ICurrentUser) {
    const scopeFilter = await this.dataScopeService.getDataScopeFilter(
      { userId: user.id, role: user.role, branch: user.branch },
      'customer',
    );
    return this.repository.findMany({
      where: { ...queryFilters, ...scopeFilter },
    });
  }
}
```

### Pattern 4: DiscoveryService Integration Test
**What:** Use `DiscoveryService.getControllers()` to get all controller instances, then iterate methods via `Object.getOwnPropertyNames()` on the prototype, checking each for `ROLES_KEY` or `IS_PUBLIC_KEY` metadata.
**When to use:** CI enforcement that no endpoint is accidentally unprotected.
**Architecture:**
```typescript
// test/integration/rbac-audit.integration.spec.ts
import { Test } from '@nestjs/testing';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@core/rbac/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

describe('RBAC Audit', () => {
  let discoveryService: DiscoveryService;
  let reflector: Reflector;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    discoveryService = module.get(DiscoveryService);
    reflector = module.get(Reflector);
  });

  it('every controller method has @Roles or @Public', () => {
    const controllers = discoveryService.getControllers();
    const undecorated: string[] = [];

    for (const wrapper of controllers) {
      const instance = wrapper.instance;
      if (!instance || !instance.constructor) continue;
      const prototype = Object.getPrototypeOf(instance);
      const methods = Object.getOwnPropertyNames(prototype)
        .filter(m => m !== 'constructor');

      for (const method of methods) {
        const handler = prototype[method];
        // Check for HTTP method decorator (Get, Post, etc.)
        const httpMethod = Reflect.getMetadata('method', handler);
        if (httpMethod === undefined) continue; // Skip non-route methods

        const roles = reflector.getAllAndOverride(ROLES_KEY, [handler, instance.constructor]);
        const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, instance.constructor]);

        if (!roles?.length && !isPublic) {
          undecorated.push(`${instance.constructor.name}.${method}`);
        }
      }
    }

    expect(undecorated).toEqual([]);
  });
});
```

### Anti-Patterns to Avoid
- **Class-level @Roles() as catch-all:** Never apply a single `@Roles()` at controller class level to cover all methods. Each method should specify its own required roles for explicit documentation and fine-grained control.
- **Implicit allow-all for missing decorators:** The current `RolesGuard` returns `true` when no `@Roles()` is found (BAC-07 comment). This is the exact gap SEC-01 closes -- after this phase, the audit test prevents ANY method from being deployed without explicit access control.
- **Data scoping in controllers:** Don't put WHERE clause logic in controllers. Use `DataScopeService` in the service layer to keep controllers thin.
- **Hardcoded user IDs in scope filters:** Always use `user.id` from `ICurrentUser`, never hardcode. The `DataScopeService.getTeamMemberIds()` pattern with caching is the correct approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Controller discovery | Manual list of controllers | `DiscoveryService.getControllers()` | Automatically discovers all registered controllers, never goes stale |
| Metadata reflection | Manual decorator parsing | `Reflector.getAllAndOverride()` | Handles class + method level merge, consistent with NestJS internals |
| Role hierarchy checks | Custom role hierarchy logic | `isExecutive()`, `isSalesRole()` etc. from `roles.enum.ts` | Already defined with correct groupings |
| Data scope WHERE clauses | Per-controller filter logic | `DataScopeService.getDataScopeFilter()` | Already handles all 22 roles with correct scoping, cached team lookups |
| Role labels for error messages | Hardcoded strings | `getRoleLabel()` from `roles.enum.ts` | Vietnamese labels already defined for all 22 roles |

**Key insight:** The RBAC infrastructure is already 80% built. This phase is about closing gaps (14 undecorated controllers, missing data scope consumption, error format upgrade) rather than building new architecture.

## Common Pitfalls

### Pitfall 1: Duplicate @Roles Decorator Imports
**What goes wrong:** The codebase has TWO `roles.decorator.ts` files -- one at `src/core/rbac/decorators/` and one at `src/common/decorators/`. Both export `ROLES_KEY = 'roles'` and `Roles`. Controllers import from either path.
**Why it happens:** Re-export pattern for convenience, but creates confusion.
**How to avoid:** Both files use the same `ROLES_KEY` string value (`'roles'`), so the metadata is compatible. The audit test should check for `ROLES_KEY` regardless of import source. Controllers can import from either path -- both work identically.
**Warning signs:** If someone creates a third roles decorator with a different key, the audit test would miss it.

### Pitfall 2: Health/Metrics Controllers Need @Public(), Not @Roles()
**What goes wrong:** Health and metrics endpoints (`/health`, `/metrics`) are intentionally unauthenticated (consumed by Kubernetes probes and Prometheus scrapers). Adding `@Roles()` would break infrastructure monitoring.
**Why it happens:** These controllers don't use `JwtAuthGuard` or `RolesGuard` -- they're infrastructure endpoints.
**How to avoid:** Mark them with `@Public()` to satisfy the audit test. The `JwtAuthGuard` already respects `@Public()` by skipping authentication. The audit test should accept `@Public()` as valid.
**Affected files:** `src/core/health/health.controller.ts`, `src/core/metrics/metrics.controller.ts`, `src/modules/health/health.controller.ts`

### Pitfall 3: Public CMS Controller Missing Decorators
**What goes wrong:** `public-cms.controller.ts` has no `@Public()` on individual methods. It routes to `/public/cms/*` and is intended to be unauthenticated, but neither `@Public()` nor `@Roles()` is present.
**Why it happens:** Developer assumed the route path implies public access, but the JwtAuthGuard checks metadata, not routes.
**How to avoid:** Add `@Public()` at class level for controllers that are entirely public.

### Pitfall 4: Workplace Controllers (Chat, Calendar, Drive, Wiki, Video) Need All-User Access
**What goes wrong:** These "workplace" controllers (chat, calendar, drive, wiki, video, search) use only `JwtAuthGuard` -- any authenticated user can access them. Adding restrictive `@Roles()` could break functionality.
**Why it happens:** Workplace features are inherently available to all authenticated employees regardless of role.
**How to avoid:** Use `@Roles()` with all 22 roles, or create an `@AllAuthenticated()` decorator that sets `ROLES_KEY` to the complete UserRole enum values. The simpler approach is to use all roles in `@Roles()`, which satisfies the audit test while preserving current behavior.
**Recommendation:** Create a `ALL_ROLES` constant in `roles.enum.ts` that contains all 22 roles, then use `@Roles(...ALL_ROLES)` for workplace controllers. This is explicit, self-documenting, and audit-friendly.

### Pitfall 5: DataScopeService Already Exists But Is Underutilized
**What goes wrong:** Only ~10 files currently consume `DataScopeService` or `DataScopeGuard`. Many services that should scope data (complaint queries, order reads for sales users) don't apply scope filters.
**Why it happens:** Data scoping was built as infrastructure but not fully wired into all consuming services.
**How to avoid:** Focus on the three key targets from CONTEXT.md: CRM, orders, complaints. CRM already injects `DataScopeService`. Verify it's actually called in list/read methods. Wire it into complaint and order read paths.

### Pitfall 6: Integration Test Requires Full AppModule Bootstrap
**What goes wrong:** The `DiscoveryService` only discovers controllers that are registered in modules imported by the test's root module. A partial module setup would miss controllers.
**Why it happens:** NestJS discovery relies on the module tree.
**How to avoid:** Import the full `AppModule` in the test. This requires all environment variables and dependencies to be available. Use `test/setup.ts` (already exists) for env vars. Mock external services (database, Redis) if needed. Consider using `.compile()` without `.init()` to avoid connecting to real services -- `DiscoveryService` only needs the module metadata, not runtime connections.
**Important:** `Test.createTestingModule({ imports: [AppModule] }).compile()` compiles the module tree (registers controllers, resolves metadata) WITHOUT calling `onModuleInit` lifecycle hooks. This is sufficient for reflection-based testing.

## Code Examples

### Example 1: Upgraded RolesGuard with DomainException
```typescript
// Source: Derived from existing roles.guard.ts + Phase 1 DomainException pattern
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpStatus } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ICurrentUser } from '../interfaces/current-user.interface';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';
import { getRoleLabel } from '../roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;

    if (!user) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Không tìm thấy thông tin người dùng.',
        HttpStatus.FORBIDDEN,
      );
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      const userRoleLabel = getRoleLabel(user.role);
      const requiredLabels = requiredRoles.map(r => getRoleLabel(r)).join(', ');
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        `Bạn không có quyền thực hiện thao tác này. Vai trò hiện tại: ${userRoleLabel}. Yêu cầu: ${requiredLabels}`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
```

### Example 2: ALL_ROLES Constant for Workplace Controllers
```typescript
// Source: Extend existing roles.enum.ts
import { UserRole } from '@prisma/client';

/** All 22 roles - use for endpoints accessible to any authenticated user */
export const ALL_ROLES: UserRole[] = Object.values(UserRole);
```

### Example 3: RBAC Audit Integration Test Structure
```typescript
// Source: NestJS DiscoveryService API (v11.1.15)
// File: test/integration/rbac-audit.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { ROLES_KEY } from '../../src/core/rbac/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

describe('RBAC Coverage Audit', () => {
  let module: TestingModule;
  let discoveryService: DiscoveryService;
  let reflector: Reflector;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    discoveryService = module.get(DiscoveryService);
    reflector = module.get(Reflector);
  }, 60000);

  afterAll(async () => {
    await module?.close();
  });

  it('every HTTP handler has @Roles() or @Public()', () => {
    const controllers = discoveryService.getControllers();
    const violations: string[] = [];

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const controllerClass = instance.constructor;
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = Object.getOwnPropertyNames(prototype)
        .filter(name => name !== 'constructor');

      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;

        // Only check HTTP route handlers (methods with @Get, @Post, etc.)
        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        if (httpMethod === undefined) continue;

        // Check for @Roles() at method OR class level
        const roles = reflector.getAllAndOverride(ROLES_KEY, [
          handler, controllerClass,
        ]);

        // Check for @Public() at method OR class level
        const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
          handler, controllerClass,
        ]);

        if ((!roles || roles.length === 0) && !isPublic) {
          violations.push(`${controllerClass.name}.${methodName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

### Example 4: Data Scope Application in Service
```typescript
// Pattern for wiring DataScopeService into a service that doesn't yet use it
// Example: complaint.service.ts
async findAll(query: QueryDto, user: ICurrentUser) {
  const scopeFilter = await this.dataScopeService.getDataScopeFilter(
    { userId: user.id, role: user.role, branch: user.branch },
    'order', // complaints are order-linked
  );

  return this.prisma.complaint.findMany({
    where: {
      ...this.buildQueryFilter(query),
      order: scopeFilter, // scope via the related order
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `if (!requiredRoles) return true` | Audit test enforces all methods decorated | This phase | Zero undecorated methods possible |
| Raw `ForbiddenException` | `DomainException(ErrorCode.FORBIDDEN, ...)` with role info | This phase | Consistent error format, user sees which role needed |
| Per-controller manual scope logic | `DataScopeService.getDataScopeFilter()` utility | Already exists | Centralized, cached, supports all 22 roles |

**Note on RolesGuard behavior:** The current guard has a comment "BAC-07 fix: If no @Roles() decorator, allow all authenticated users." This is the correct runtime behavior AFTER this phase, because the audit test guarantees every method HAS a decorator. The guard's allow-all fallback becomes unreachable code (dead path) once SEC-01 is satisfied.

## Open Questions

1. **AppModule compilation in test without real database/Redis**
   - What we know: `Test.createTestingModule({ imports: [AppModule] }).compile()` resolves all providers. If PrismaService or CacheService try to connect on compile, the test needs mocks.
   - What's unclear: Whether `.compile()` triggers connection attempts. NestJS v11 docs suggest `compile()` only resolves the DI tree without calling lifecycle hooks.
   - Recommendation: Try compilation first. If it fails, override PrismaService and CacheService with mocks in the test module. Alternatively, use `overrideProvider()` for database-connecting services.

2. **Whether to change RolesGuard fallback behavior**
   - What we know: Current fallback `return true` when no `@Roles()` is explicitly allowed (BAC-07). The audit test makes this moot.
   - What's unclear: Whether to change the guard to deny-by-default as defense-in-depth.
   - Recommendation: Keep `return true` fallback to avoid breaking anything during transition. The test is the enforcement mechanism, not the runtime guard. A deny-by-default guard could cause cascading failures if a decorator is accidentally missed in a hotfix.

3. **Attendance GPS controller: role assignment**
   - What we know: GPS check-in/check-out is used by all employees, not just specific roles.
   - Recommendation: Use `@Roles(...ALL_ROLES)` for attendance endpoints.

## Codebase Audit Findings

### Controllers WITHOUT Any RBAC Decorator (14 files)
These are the files that need `@Roles()` or `@Public()` added:

| Controller File | Current Guards | Recommendation |
|----------------|---------------|----------------|
| `core/health/health.controller.ts` | None | `@Public()` at class level (K8s probes) |
| `core/metrics/metrics.controller.ts` | None | `@Public()` at class level (Prometheus scraper) |
| `modules/health/health.controller.ts` | None | `@Public()` at class level (duplicate health check) |
| `modules/public/public-cms.controller.ts` | None | `@Public()` at class level (public website) |
| `modules/chat/chat.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/calendar/calendar.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/drive/drive.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/wiki/wiki.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/video/video.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/search/search.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all authenticated users |
| `modules/attendance/attendance.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all employees |
| `modules/attendance/attendance-gps.controller.ts` | JwtAuthGuard | `@Roles(...ALL_ROLES)` -- all employees |
| `modules/customer-portal/customer-portal.controller.ts` | JwtAuthGuard | Role-specific per method (customer impersonation) |
| `modules/approval/delegation/delegation.controller.ts` | Unknown | Check and add appropriate roles |

### Controllers WITH @Roles But Missing On Some Methods
The 80 controllers that DO have `@Roles()` may still have individual methods without decoration. The integration test will catch these. The per-method audit is the test's job, not manual research.

### Data Scope Current Coverage
| Service | Uses DataScopeService? | Uses DataScopeGuard? | Needs Work? |
|---------|----------------------|---------------------|-------------|
| CRM (crm.service.ts) | YES (injected) | NO | Verify usage in findAll |
| Order (order.service.ts) | YES (injected) | YES (controller) | Verify usage in reads |
| Complaint | NO | NO | YES -- needs scoping |
| Master Order | YES (injected) | YES (controller) | Verify usage |
| Cash | NO | YES (controller) | May need service-level |
| Quotation | NO | YES (controller) | May need service-level |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="rbac" --forceExit` |
| Full suite command | `cd tbs-erp-backend && npx jest --forceExit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Every method has @Roles or @Public | integration | `cd tbs-erp-backend && npx jest --config jest.config.js --testPathPattern=test/integration/rbac-audit --runInBand --forceExit` | Wave 0 |
| SEC-02 | Integration test scans all controllers via reflection | integration | Same as SEC-01 (the test IS the requirement) | Wave 0 |
| SEC-03 | Data scoping -- Sales sees own, CEO sees all | integration | `cd tbs-erp-backend && npx jest --testPathPattern="data-scope" --forceExit` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-backend && npx jest --testPathPattern="rbac" --forceExit`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --forceExit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/integration/rbac-audit.integration.spec.ts` -- covers SEC-01, SEC-02
- [ ] `src/core/rbac/data-scope.service.spec.ts` -- covers SEC-03 (unit test for scope filter logic)
- [ ] `ALL_ROLES` constant in `roles.enum.ts` -- needed for workplace controller decoration

## Sources

### Primary (HIGH confidence)
- NestJS DiscoveryService API: Verified from `node_modules/@nestjs/core/discovery/discovery-service.d.ts` (v11.1.15)
- Existing codebase: `roles.guard.ts`, `roles.decorator.ts`, `public.decorator.ts`, `data-scope.service.ts`, `casl-ability.factory.ts`, `roles.enum.ts`
- `ROLES_KEY` = `'roles'`, `IS_PUBLIC_KEY` = `'isPublic'` confirmed from source

### Secondary (MEDIUM confidence)
- NestJS reflection metadata: `METHOD_METADATA`, `PATH_METADATA` from `@nestjs/common/constants` for detecting route handlers
- CASL v6.7.2 ability definitions: Verified from `casl-ability.factory.ts` source

### Tertiary (LOW confidence)
- None -- all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Existing infrastructure studied from actual source files, patterns verified
- Pitfalls: HIGH - Identified from actual codebase analysis (14 undecorated controllers found, duplicate decorator files discovered)
- Test approach: MEDIUM - DiscoveryService API verified from type definitions, but full AppModule compilation in test environment needs validation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable NestJS v11 RBAC patterns, no breaking changes expected)
