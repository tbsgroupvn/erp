# Phase 5: RBAC Audit & Coverage - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure every controller endpoint has explicit access control (`@Roles()` or `@Public()`), implement data scoping so roles see only permitted data, and improve 403 error responses with user role + required role details. This phase does NOT add new roles, change the role hierarchy, or modify authentication flows.

</domain>

<decisions>
## Implementation Decisions

### RBAC Audit Approach
- Create an integration test using NestJS `DiscoveryService` that scans all controller methods via reflection
- The test asserts every method has either `@Roles()` decorator OR `@Public()` marker — zero undecorated methods allowed
- The test runs in CI and fails if any new endpoint is added without explicit access control
- For the initial pass: audit all 84 controllers and add missing `@Roles()` decorators based on the 22-role matrix from CLAUDE.md
- Claude has discretion on the exact role assignments per endpoint (based on business logic analysis)
- Public endpoints (already marked `@Public()`) remain untouched

### Data Scoping Rules
- Sales (`SALE`) sees only own customers (filtered by `salesRepId === currentUser.id`)
- Sales Leader (`SALES_LEADER`) sees own team's customers
- CEO, COO, CFO, Directors see all data (no scoping)
- Warehouse staff (`WAREHOUSE_CN_AGENT`, `WAREHOUSE_VN_STAFF`) see only warehouse-relevant data
- Accountants see finance-relevant data across all orders
- Implement data scoping via a reusable `DataScopeInterceptor` or query filter utility that injects `where` conditions based on user role
- Key data scoping targets: customer queries (CRM), order queries, complaint queries
- Claude has discretion on implementation approach (interceptor vs service-level filter vs Prisma middleware)

### 403 Error Response Format
- Update `RolesGuard` to use `DomainException` (Phase 1) instead of raw `ForbiddenException`
- Include in error response: `errorCode: 'FORBIDDEN'`, user's current role, required roles for the endpoint
- Error message format: `"Bạn không có quyền thực hiện thao tác này. Vai trò hiện tại: {role}. Yêu cầu: {requiredRoles}"`
- Return `requestId` in 403 responses (already handled by Phase 1 exception filters)

### Claude's Discretion
- Exact role assignments per controller method (based on business domain analysis)
- Data scoping implementation approach (interceptor vs service filter vs Prisma middleware)
- Whether to scope data at the controller level (interceptor) or service level (query builder)
- How to handle cross-role visibility (e.g., accountant needs order data but shouldn't modify orders)
- Integration test structure (single test file vs per-module test files)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### RBAC infrastructure
- `tbs-erp-backend/src/core/rbac/guards/roles.guard.ts` — Current RolesGuard (allows all when no @Roles, uses raw ForbiddenException)
- `tbs-erp-backend/src/core/rbac/decorators/roles.decorator.ts` — @Roles() decorator with ROLES_KEY metadata
- `tbs-erp-backend/src/common/decorators/public.decorator.ts` — @Public() decorator
- `tbs-erp-backend/src/common/decorators/roles.decorator.ts` — Alternative roles decorator (may be duplicate)

### Role reference
- `CLAUDE.md` — 22 roles listed: CEO, COO, CFO, DIRECTOR_OPERATIONS, SALES_DIRECTOR, SALES_LEADER, SALE, MARKETING_STAFF, CSKH, CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST, HR_MANAGER, LOGISTICS_MANAGER, XNK_MANAGER, XNK_STAFF, WAREHOUSE_MANAGER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF, DRIVER

### Controller examples (well-decorated)
- `tbs-erp-backend/src/modules/order/order.controller.ts` — Has @Roles per method (11 occurrences)
- `tbs-erp-backend/src/modules/accounts-receivable/accounts-receivable.controller.ts` — Has @Roles per method (14 occurrences)

### Error infrastructure (from Phase 1)
- `tbs-erp-backend/src/common/exceptions/domain.exception.ts` — DomainException base class
- `tbs-erp-backend/src/common/exceptions/error-codes.ts` — ErrorCode registry (add FORBIDDEN)

### Business process reference
- `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` — Business process docs with role responsibilities per stage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RolesGuard`: Already functional — needs DomainException upgrade and role info in error
- `@Roles()` decorator: Already used on ~60 methods across 10+ controllers
- `@Public()` decorator: Already exists for public endpoints
- `DomainException`: Phase 1 infrastructure — use for 403 errors
- `ICurrentUser` interface: Has `role`, `id`, `companyId` — sufficient for data scoping

### Established Patterns
- `@Roles(UserRole.CEO, UserRole.COO)` at method level
- `@UseGuards(JwtAuthGuard, RolesGuard)` at controller level (or global)
- `request.user` contains `ICurrentUser` with role and id
- Prisma queries use `where` clauses — data scoping adds conditions

### Integration Points
- 84 controller files — need @Roles audit
- `RolesGuard` — upgrade error response
- `ErrorCode` registry — add FORBIDDEN
- CRM/order/complaint services — add data scoping queries

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- Integration test must catch future undecorated endpoints (CI safety net)
- Vietnamese error message for 403 responses
- Data scoping: Sales sees own, CEO/COO/CFO see all

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-rbac-audit-coverage*
*Context gathered: 2026-03-19*
