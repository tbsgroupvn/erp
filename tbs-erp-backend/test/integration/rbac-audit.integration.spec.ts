/**
 * RBAC Audit Integration Test
 *
 * Scans ALL controllers imported by AppModule via NestJS module metadata
 * and verifies every HTTP route handler has explicit access control:
 * - @Roles() for role-restricted endpoints
 * - @Public() for unauthenticated endpoints
 * - @UseGuards(JwtAuthGuard/AuthGuard) for authenticated endpoints
 *
 * Uses metadata-only scanning (no DI resolution, no DB/Redis connection).
 * This test acts as a CI safety net: any new endpoint added without
 * proper protection will cause this test to fail.
 *
 * Run with e2e config:
 *   cd tbs-erp-backend && npx jest --config test/jest-e2e.json \
 *     --testRegex="rbac-audit\\.integration\\.spec\\.ts$" \
 *     --runInBand --forceExit --no-cache
 */

import 'reflect-metadata';
import {
  METHOD_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../src/core/rbac/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

// Set required env vars (some modules read env at import time)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DATABASE_URL =
  'postgresql://test_user:test_password@localhost:5432/test_db';

/**
 * Recursively extract all controller classes from a NestJS module
 * by reading @Module() metadata without instantiating anything.
 */
function extractControllers(
  moduleClass: any,
  visited = new Set<any>(),
): any[] {
  if (!moduleClass || visited.has(moduleClass)) return [];
  visited.add(moduleClass);

  const controllers: any[] = [];

  // Get controllers declared in this module
  const moduleControllers: any[] =
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) || [];
  controllers.push(...moduleControllers);

  // Recurse into imported modules
  const imports: any[] =
    Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) || [];
  for (const imp of imports) {
    // Handle dynamic modules (e.g., ConfigModule.forRoot())
    const mod = imp?.module || imp;
    if (typeof mod === 'function') {
      controllers.push(...extractControllers(mod, visited));
    }
  }

  return controllers;
}

/**
 * Get all HTTP route handler method names from a controller class prototype.
 */
function getHttpHandlers(
  controllerClass: any,
): Array<{ methodName: string; handler: Function }> {
  const handlers: Array<{ methodName: string; handler: Function }> = [];
  const prototype = controllerClass.prototype;
  if (!prototype) return handlers;

  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor',
  );

  for (const methodName of methodNames) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
    if (!descriptor || typeof descriptor.value !== 'function') continue;

    const handler = descriptor.value;
    const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler);
    if (httpMethod === undefined) continue;

    handlers.push({ methodName, handler });
  }

  return handlers;
}

/**
 * Check if a guard list contains an auth guard (JwtAuthGuard or AuthGuard('jwt')).
 */
function hasAuthGuard(guards: any[] | undefined): boolean {
  if (!guards || !Array.isArray(guards)) return false;
  return guards.some((guard) => {
    if (typeof guard === 'function') {
      const name = guard.name || '';
      // Check class name for known auth guards
      if (
        name === 'JwtAuthGuard' ||
        name === 'RolesGuard' ||
        name.includes('AuthGuard')
      ) {
        return true;
      }
      // AuthGuard('jwt') from @nestjs/passport returns a mixin with a hashed name
      // Check toString() for MixinAuthGuard pattern
      try {
        const src = guard.toString();
        if (src.includes('MixinAuthGuard')) return true;
      } catch {
        // toString may fail for some objects
      }
      return false;
    }
    // Handle instances or other forms
    if (guard?.constructor?.name) {
      return (
        guard.constructor.name === 'JwtAuthGuard' ||
        guard.constructor.name.includes('AuthGuard')
      );
    }
    return false;
  });
}

describe('RBAC Audit - Controller Decoration Coverage', () => {
  // Import AppModule lazily to allow env vars to be set first
  let AppModule: any;
  let allControllers: any[];

  beforeAll(async () => {
    // Dynamic import so env vars are available when modules evaluate
    const appModuleFile = await import('../../src/app.module');
    AppModule = appModuleFile.AppModule;

    // Extract all controller classes from module metadata tree
    allControllers = extractControllers(AppModule);
  }, 30000);

  it('every HTTP handler has @Roles() or @Public() or is guarded by auth', () => {
    const violations: string[] = [];

    for (const controllerClass of allControllers) {
      if (!controllerClass?.prototype) continue;

      // Check class-level metadata
      const classRoles: string[] | undefined = Reflect.getMetadata(
        ROLES_KEY,
        controllerClass,
      );
      const classPublic: boolean | undefined = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        controllerClass,
      );
      const classGuards: any[] | undefined = Reflect.getMetadata(
        GUARDS_METADATA,
        controllerClass,
      );

      const classHasRoles =
        Array.isArray(classRoles) && classRoles.length > 0;
      const classHasPublic = !!classPublic;
      const classHasAuthGuard = hasAuthGuard(classGuards);

      // If class has @Public() or @Roles(), all methods are covered
      if (classHasPublic || classHasRoles) continue;

      const handlers = getHttpHandlers(controllerClass);

      for (const { methodName, handler } of handlers) {
        // Check handler-level metadata
        const handlerRoles: string[] | undefined = Reflect.getMetadata(
          ROLES_KEY,
          handler,
        );
        const handlerPublic: boolean | undefined = Reflect.getMetadata(
          IS_PUBLIC_KEY,
          handler,
        );
        const handlerGuards: any[] | undefined = Reflect.getMetadata(
          GUARDS_METADATA,
          handler,
        );

        const hasRoles =
          Array.isArray(handlerRoles) && handlerRoles.length > 0;
        const hasPublic = !!handlerPublic;
        const methodHasAuthGuard = hasAuthGuard(handlerGuards);

        // Protected if any of: @Roles, @Public, class-level auth guard, method-level auth guard
        if (
          !hasRoles &&
          !hasPublic &&
          !classHasAuthGuard &&
          !methodHasAuthGuard
        ) {
          violations.push(`${controllerClass.name}.${methodName}`);
        }
      }
    }

    if (violations.length > 0) {
      console.error(
        '\n=== UNPROTECTED ENDPOINTS (no @Roles, @Public, or auth guard) ===\n' +
          violations.map((v) => `  - ${v}`).join('\n') +
          `\n\nTotal violations: ${violations.length}\n`,
      );
    }

    expect(violations).toEqual([]);
  });

  it('every HTTP handler has explicit @Roles() or @Public() decorator', () => {
    /**
     * KNOWN_EXCEPTIONS: endpoints that intentionally rely on class-level
     * @UseGuards(JwtAuthGuard, RolesGuard) for protection without listing an
     * explicit @Roles() on each method.
     *
     * All entries here are authenticated + role-guarded at the controller level.
     * Adding a NEW endpoint to this list requires a code-review justification
     * comment explaining why per-method @Roles is not needed.
     *
     * To resolve a known exception properly: add @Roles(...) to each method
     * and remove the entry from this list.
     */
    const KNOWN_EXCEPTIONS: Array<{ controller: string; method: string }> = [
      // BatchController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'BatchController', method: 'importOrders' },
      { controller: 'BatchController', method: 'exportOrders' },
      { controller: 'BatchController', method: 'exportARReport' },
      { controller: 'BatchController', method: 'getJobStatus' },

      // CodController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'CodController', method: 'recordCODCollection' },
      { controller: 'CodController', method: 'getDriverCollections' },
      { controller: 'CodController', method: 'confirmRemittance' },
      { controller: 'CodController', method: 'findAll' },
      { controller: 'CodController', method: 'getReconciliation' },
      { controller: 'CodController', method: 'flagShortage' },

      // CommissionController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'CommissionController', method: 'createRule' },
      { controller: 'CommissionController', method: 'getRules' },
      { controller: 'CommissionController', method: 'calculateCommission' },
      { controller: 'CommissionController', method: 'getMyCommissions' },
      { controller: 'CommissionController', method: 'getTeamCommissions' },
      { controller: 'CommissionController', method: 'approveCommission' },
      { controller: 'CommissionController', method: 'getMonthlyReport' },

      // ContractController — class-level @UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
      { controller: 'ContractController', method: 'findAll' },
      { controller: 'ContractController', method: 'exportPdf' },
      { controller: 'ContractController', method: 'findOne' },
      { controller: 'ContractController', method: 'create' },
      { controller: 'ContractController', method: 'update' },
      { controller: 'ContractController', method: 'updateStatus' },
      { controller: 'ContractController', method: 'delete' },

      // InventoryController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'InventoryController', method: 'createStockItem' },
      { controller: 'InventoryController', method: 'recordMovement' },
      { controller: 'InventoryController', method: 'getCurrentStock' },
      { controller: 'InventoryController', method: 'getStockItem' },
      { controller: 'InventoryController', method: 'getLowStockAlerts' },
      { controller: 'InventoryController', method: 'getMovementHistory' },
      { controller: 'InventoryController', method: 'doStocktake' },

      // LostAndFoundController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'LostAndFoundController', method: 'createLostItem' },
      { controller: 'LostAndFoundController', method: 'findAll' },
      { controller: 'LostAndFoundController', method: 'attemptMatch' },
      { controller: 'LostAndFoundController', method: 'claimItem' },
      { controller: 'LostAndFoundController', method: 'markForDisposal' },
      { controller: 'LostAndFoundController', method: 'getStatistics' },

      // OperationCostController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'OperationCostController', method: 'recordCost' },
      { controller: 'OperationCostController', method: 'findAll' },
      { controller: 'OperationCostController', method: 'getCostSummary' },
      { controller: 'OperationCostController', method: 'getContainerCosts' },
      { controller: 'OperationCostController', method: 'allocateCosts' },
      { controller: 'OperationCostController', method: 'getCostPerKg' },
      { controller: 'OperationCostController', method: 'getVarianceReport' },
      { controller: 'OperationCostController', method: 'getOrderCost' },

      // MasterOrderController — class-level @UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
      { controller: 'MasterOrderController', method: 'create' },
      { controller: 'MasterOrderController', method: 'findAll' },
      { controller: 'MasterOrderController', method: 'findById' },
      { controller: 'MasterOrderController', method: 'addSubOrder' },

      // ServiceFeeConfigController — class-level @UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
      { controller: 'ServiceFeeConfigController', method: 'findAll' },
      { controller: 'ServiceFeeConfigController', method: 'findOne' },
      { controller: 'ServiceFeeConfigController', method: 'create' },
      { controller: 'ServiceFeeConfigController', method: 'update' },
      { controller: 'ServiceFeeConfigController', method: 'remove' },

      // PurchaseController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'PurchaseController', method: 'createPurchaseRequest' },
      { controller: 'PurchaseController', method: 'approvePR' },
      { controller: 'PurchaseController', method: 'convertToPO' },
      { controller: 'PurchaseController', method: 'createPurchaseOrder' },
      { controller: 'PurchaseController', method: 'recordReceipt' },
      { controller: 'PurchaseController', method: 'findAll' },
      { controller: 'PurchaseController', method: 'getVendorPurchases' },

      // TrackingController — class-level @UseGuards(JwtAuthGuard, RolesGuard)
      { controller: 'TrackingController', method: 'addTrackingEvent' },
      { controller: 'TrackingController', method: 'getPackageTracking' },
      { controller: 'TrackingController', method: 'getContainerTracking' },
      { controller: 'TrackingController', method: 'syncExternalTracking' },
      { controller: 'TrackingController', method: 'getCustomerTracking' },
      { controller: 'TrackingController', method: 'estimateDelivery' },
    ];

    const undecorated: string[] = [];

    for (const controllerClass of allControllers) {
      if (!controllerClass?.prototype) continue;

      const classRoles: string[] | undefined = Reflect.getMetadata(
        ROLES_KEY,
        controllerClass,
      );
      const classPublic: boolean | undefined = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        controllerClass,
      );

      const classHasRoles =
        Array.isArray(classRoles) && classRoles.length > 0;
      const classHasPublic = !!classPublic;

      if (classHasPublic || classHasRoles) continue;

      const handlers = getHttpHandlers(controllerClass);

      for (const { methodName, handler } of handlers) {
        const handlerRoles: string[] | undefined = Reflect.getMetadata(
          ROLES_KEY,
          handler,
        );
        const handlerPublic: boolean | undefined = Reflect.getMetadata(
          IS_PUBLIC_KEY,
          handler,
        );

        const hasRoles =
          Array.isArray(handlerRoles) && handlerRoles.length > 0;
        const hasPublic = !!handlerPublic;

        if (!hasRoles && !hasPublic) {
          undecorated.push(`${controllerClass.name}.${methodName}`);
        }
      }
    }

    // Log undecorated endpoints for visibility
    if (undecorated.length > 0) {
      console.warn(
        `\n=== ENDPOINTS WITHOUT EXPLICIT @Roles() or @Public() ===\n` +
          `These endpoints rely on @UseGuards(JwtAuthGuard) for protection.\n` +
          `Consider adding @Roles(...) for explicit documentation.\n\n` +
          undecorated.map((v) => `  - ${v}`).join('\n') +
          `\n\nTotal: ${undecorated.length}\n`,
      );
    }

    // Strict enforcement: any endpoint not in KNOWN_EXCEPTIONS must have
    // an explicit @Roles() or @Public() decorator. This acts as a regression
    // gate — adding a new undecorated endpoint will cause this test to fail.
    const unexpectedUndecorated = undecorated.filter(
      (ep) =>
        !KNOWN_EXCEPTIONS.some(
          (ex) => ep === `${ex.controller}.${ex.method}`,
        ),
    );

    if (unexpectedUndecorated.length > 0) {
      console.error(
        `\n=== NEW UNDECORATED ENDPOINTS (not in KNOWN_EXCEPTIONS) ===\n` +
          `Add @Roles(...) or @Public() to these handlers, or add them to\n` +
          `KNOWN_EXCEPTIONS in rbac-audit.integration.spec.ts with a justification.\n\n` +
          unexpectedUndecorated.map((v) => `  - ${v}`).join('\n') +
          `\n\nTotal: ${unexpectedUndecorated.length}\n`,
      );
    }

    expect(unexpectedUndecorated).toEqual([]);
  });

  it('audit report lists all controllers and their access level', () => {
    const report: Array<{
      controller: string;
      method: string;
      accessLevel: string;
    }> = [];

    for (const controllerClass of allControllers) {
      if (!controllerClass?.prototype) continue;

      const classRoles: string[] | undefined = Reflect.getMetadata(
        ROLES_KEY,
        controllerClass,
      );
      const classPublic: boolean | undefined = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        controllerClass,
      );
      const classGuards: any[] | undefined = Reflect.getMetadata(
        GUARDS_METADATA,
        controllerClass,
      );

      const classHasAuthGuard = hasAuthGuard(classGuards);

      const handlers = getHttpHandlers(controllerClass);

      for (const { methodName, handler } of handlers) {
        const handlerRoles: string[] | undefined = Reflect.getMetadata(
          ROLES_KEY,
          handler,
        );
        const handlerPublic: boolean | undefined = Reflect.getMetadata(
          IS_PUBLIC_KEY,
          handler,
        );
        const handlerGuards: any[] | undefined = Reflect.getMetadata(
          GUARDS_METADATA,
          handler,
        );

        let accessLevel: string;
        if (handlerPublic || classPublic) {
          accessLevel = 'public';
        } else {
          const roles = handlerRoles?.length
            ? handlerRoles
            : classRoles?.length
              ? classRoles
              : undefined;
          if (roles && roles.length > 0) {
            accessLevel = `roles:${roles.join(',')}`;
          } else if (classHasAuthGuard || hasAuthGuard(handlerGuards)) {
            accessLevel = 'authenticated';
          } else {
            accessLevel = 'UNPROTECTED';
          }
        }

        report.push({
          controller: controllerClass.name,
          method: methodName,
          accessLevel,
        });
      }
    }

    // Log the full audit report for visibility
    console.log('\n=== RBAC AUDIT REPORT ===');
    console.log(`Total endpoints discovered: ${report.length}`);
    console.log(`Total controllers: ${allControllers.length}`);

    const publicCount = report.filter((r) => r.accessLevel === 'public').length;
    const roleCount = report.filter((r) =>
      r.accessLevel.startsWith('roles:'),
    ).length;
    const authCount = report.filter(
      (r) => r.accessLevel === 'authenticated',
    ).length;
    const unprotectedCount = report.filter(
      (r) => r.accessLevel === 'UNPROTECTED',
    ).length;

    console.log(
      `\nBreakdown: ${publicCount} public, ${roleCount} role-restricted, ${authCount} authenticated, ${unprotectedCount} unprotected`,
    );

    console.log(
      '\nController | Method | Access Level',
      '\n' + '-'.repeat(80),
    );
    for (const entry of report) {
      console.log(
        `${entry.controller} | ${entry.method} | ${entry.accessLevel}`,
      );
    }
    console.log('=== END REPORT ===\n');

    // Sanity check: discovery should find endpoints
    expect(report.length).toBeGreaterThan(0);
  });
});
