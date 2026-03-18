# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Backend Runner:**
- Framework: Jest 29+
- Config: `tbs-erp-backend/jest.config.js`
- Transformer: ts-jest (TypeScript → JavaScript)
- Test env: Node.js

**Frontend Runner:**
- Framework: Jest 29+ (unit/integration)
- Framework: Vitest (optional, configured in `vitest.config.ts`)
- E2E: Playwright (configured in `playwright.config.ts`)
- Test env: jsdom (for browser APIs)
- Config: `tbs-erp-frontend/jest.config.js`

**Assertion Library:**
- Backend: Jest built-in matchers (`expect()`)
- Frontend: Jest built-in + React Testing Library for components

**Run Commands:**

Backend:
```bash
npm test                    # Run all unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:e2e          # Integration tests (if configured)
npm test -- --testNamePattern="OrderStatus"  # Run specific suite
```

Frontend:
```bash
npm test                    # Run Jest unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run e2e              # Run Playwright E2E tests
npm run e2e:headed       # E2E with visible browser
npx playwright test --project=chromium  # Single browser
```

## Test File Organization

**Location - Backend:**
- Co-located with source: `{module}.service.ts` + `{module}.service.spec.ts`
- Same directory as source file
- Special note: State machines and guards also have specs in same location

Example structure:
```
src/modules/order/
├── order.service.ts
├── order.service.spec.ts          # Test file alongside source
├── domain/
│   ├── order-status.machine.ts
│   └── order-status.machine.spec.ts
└── guards/
    ├── credit-check.guard.ts
    └── credit-check.guard.spec.ts
```

**Location - Frontend:**
- E2E tests: `e2e/` directory at root
- Organized by feature: `e2e/orders/`, `e2e/auth/`, `e2e/finance/`

Example structure:
```
e2e/
├── auth/
│   ├── auth.spec.ts
│   └── login.spec.ts
├── orders/
│   ├── order-create.spec.ts
│   └── order-lifecycle.spec.ts
└── dashboard/
    └── dashboard.spec.ts
```

**Naming:**
- Backend: `{module}.service.spec.ts` (extension: `.spec.ts`)
- Frontend E2E: `{feature}.spec.ts` (extension: `.spec.ts`)
- Pattern is standardized and matches Jest default regex: `.*\.spec\.ts$`

## Test Structure

**Backend test suite organization:**

```typescript
describe('OrderStatusMachine', () => {
  let fsm: OrderStatusMachine;

  beforeEach(() => {
    fsm = new OrderStatusMachine();
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-001: Happy path lifecycle transitions
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-001: Happy path lifecycle transitions', () => {
    const lifecyclePairs: [OrderStatus, OrderStatus][] = [];
    for (let i = 0; i < ORDER_LIFECYCLE.length - 1; i++) {
      lifecyclePairs.push([ORDER_LIFECYCLE[i], ORDER_LIFECYCLE[i + 1]]);
    }

    it.each(lifecyclePairs)(
      'should allow forward transition from %s to %s',
      (from, to) => {
        expect(fsm.validateTransition(from, to)).toBe(true);
      },
    );

    it('should cover all 12 consecutive lifecycle transitions', () => {
      expect(lifecyclePairs).toHaveLength(12);
    });

    it('should allow the full lifecycle without throwing', () => {
      for (const [from, to] of lifecyclePairs) {
        expect(() => fsm.assertTransition(from, to)).not.toThrow();
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-002: MHH deposit gate
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-002: MHH deposit gate', () => {
    it('should block QUOTATION -> SOURCING for MHH service type', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.MHH),
      ).toBe(false);
    });

    it('should throw BadRequestException for MHH QUOTATION -> SOURCING via assertTransition', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.MHH),
      ).toThrow(BadRequestException);
    });
  });
});
```

**Key patterns:**
- Top-level `describe()` wraps the class/unit being tested
- `beforeEach()` resets state (instantiate fresh object, reset mocks)
- `afterEach()` cleans up (clear mocks, close connections)
- Nested `describe()` groups related tests with test case ID prefix (e.g., TC-ORD-001)
- Each `it()` tests one behavior
- Use `Arrange-Act-Assert` pattern in comments

**AAA Pattern (Arrange-Act-Assert):**

```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({ ... } as any);

      // Act
      const result = await service.login(
        'test@example.com',
        'Test123!@#',
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login('wrong@example.com', 'Test123!@#', 'test-agent', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

## Mocking

**Framework:** Jest `jest.fn()`, `jest.spyOn()`, `jest.mock()`

**Patterns:**

1. **Module mocking (top-level):**
```typescript
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn().mockReturnValue('mock-secret'),
    keyuri: jest.fn().mockReturnValue('otpauth://totp/mock?issuer=TBS%20ERP'),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));
```

2. **Service injection with mocks (NestJS Test.createTestingModule):**
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AuthService,
    {
      provide: PrismaService,
      useValue: {
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
          findFirst: jest.fn(),
        },
        session: {
          create: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    },
    {
      provide: ConfigService,
      useValue: {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            'jwt.secret': 'test-secret',
            'jwt.refreshSecret': 'test-refresh-secret',
          };
          return config[key] ?? defaultValue;
        }),
      },
    },
    {
      provide: JwtService,
      useValue: {
        sign: jest.fn((payload) => `mock-token-${payload.sub}`),
        verify: jest.fn(),
      },
    },
  ],
}).compile();

service = module.get<AuthService>(AuthService);
prismaService = module.get<PrismaService>(PrismaService);
```

3. **Spying on methods (override after instantiation):**
```typescript
jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);
```

4. **Clearing mocks:**
```typescript
afterEach(() => {
  jest.clearAllMocks(); // Reset all mocks after each test
});
```

**What to mock:**
- External services (Database via Prisma, Cache, SMS, HTTP clients)
- Third-party libraries with side effects (OAuth providers, payment gateways)
- Time-dependent functions (use `jest.useFakeTimers()` for date/time tests)

**What NOT to mock:**
- Core business logic classes (test the real implementation)
- Data validation (test with real DTOs)
- Guard/decorator logic (test with real implementations)
- Error handling paths (test with real exceptions)

Example of testing real logic vs mocking:
```typescript
// Real state machine — do NOT mock
const fsm = new OrderStatusMachine();
expect(fsm.validateTransition(from, to)).toBe(true);

// External dependency — DO mock
jest.spyOn(prismaService.order, 'create').mockResolvedValue({ id: 'ord-123' } as any);
```

## Fixtures and Factories

**Mock Data Pattern:**

```typescript
// At top of test file
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: '',
  fullName: 'Test User',
  role: 'SALE',
  branch: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  phone: null,
  saleCode: null,
  is2FAEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
  phoneNumber: null,
  preferredTwoFactorMethod: 'TOTP',
  resetToken: null,
  resetTokenExpiry: null,
  leaderId: null,
};

// In beforeAll hook (if password hash needed)
beforeAll(async () => {
  mockUser.passwordHash = await bcrypt.hash('Test123!@#', 10);
});

// In test cases, clone and modify
it('should handle 2FA enabled user', async () => {
  const user2FA = {
    ...mockUser,
    is2FAEnabled: true,
    twoFactorSecret: 'encrypted-secret',
  };
  jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user2FA as any);
  // test...
});
```

**Location:**
- Keep mock data in same test file (top level, before `describe()`)
- If shared across multiple test files, create `test/fixtures/` directory

Example shared fixture:
```
test/
├── fixtures/
│   ├── mock-user.fixture.ts
│   ├── mock-order.fixture.ts
│   └── mock-customer.fixture.ts
├── setup.ts
└── ...
```

## Coverage

**Requirements:**
Frontend: Enforced thresholds
```javascript
// jest.config.js
coverageThresholds: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

Backend: Not enforced (informational only)

**View Coverage:**

Backend:
```bash
npm run test:cov        # Generates /coverage directory
open coverage/index.html  # View in browser
```

Frontend:
```bash
npm run test:cov        # Generates /coverage directory
open coverage/lcov-report/index.html
```

Coverage report includes:
- File-by-file line coverage percentages
- Uncovered lines highlighted
- Branch coverage (conditional paths)
- Function coverage (defined functions tested)

## Test Types

**Unit Tests:**
- Scope: Single service/function in isolation
- Mocking: All external dependencies
- Speed: Fast (sub-millisecond per test)
- Location: `{module}.service.spec.ts` in same directory as source

Example:
```typescript
// Test OrderStatusMachine.validateTransition() in isolation
const fsm = new OrderStatusMachine();
expect(fsm.validateTransition(from, to)).toBe(true);
```

**Integration Tests:**
- Scope: Multiple services + real dependencies (or in-memory equivalents)
- Mocking: Minimal (use real database or test doubles)
- Speed: Slower (can take seconds)
- Location: Ignored in default Jest config via `testPathIgnorePatterns`

To enable integration tests:
```bash
# Manually run integration tests
npm test -- test/integration/
```

**E2E Tests - Frontend (Playwright):**
- Scope: Real browser, real backend
- Testing: User workflows (login → create order → checkout)
- Location: `e2e/{feature}/{scenario}.spec.ts`
- Speed: Very slow (seconds per test)

Example E2E test structure:
```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Order Creation Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/login');
  });

  test('should create order as SALE user', async () => {
    // Login
    await page.fill('input[name="email"]', 'sale@tbs.vn');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Đăng nhập")');
    await page.waitForURL('/dashboard');

    // Create order
    await page.click('a:has-text("Tạo đơn hàng")');
    await page.selectOption('select[name="customerId"]', 'cust-123');
    await page.fill('input[name="items.0.quantity"]', '5');
    await page.click('button:has-text("Tạo")');

    // Assert
    await page.waitForURL(/\/don-hang\/\d+/);
    const orderNumber = await page.locator('[data-testid="order-number"]').textContent();
    expect(orderNumber).toMatch(/^ORD-\d{6}$/);
  });
});
```

## Common Patterns

**Async Testing:**

```typescript
// Promise-based assertion
it('should create order successfully', async () => {
  jest.spyOn(prismaService.order, 'create').mockResolvedValue({ id: 'ord-123' } as any);

  const result = await service.createOrder(dto);

  expect(result.id).toBe('ord-123');
});

// Error handling for async functions
it('should throw NotFoundException for invalid customer', async () => {
  jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(null);

  await expect(service.createOrder(dto)).rejects.toThrow(NotFoundException);
});
```

**Error Testing:**

```typescript
describe('error handling', () => {
  it('should throw BadRequestException for invalid input', () => {
    expect(() => fsm.assertTransition(from, to)).toThrow(BadRequestException);
  });

  it('should include helpful error message', () => {
    try {
      fsm.assertTransition(from, to);
      fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('Invalid status transition');
    }
  });
});
```

**Parameterized Testing (it.each):**

```typescript
// Test multiple scenarios with same logic
it.each([
  [OrderStatus.CONSULTING, OrderStatus.QUOTATION],
  [OrderStatus.QUOTATION, OrderStatus.PENDING_DEPOSIT],
  [OrderStatus.PENDING_DEPOSIT, OrderStatus.SOURCING],
])(
  'should allow forward transition from %s to %s',
  (from, to) => {
    expect(fsm.validateTransition(from, to)).toBe(true);
  },
);
```

## Test Setup

**Backend global setup:** `test/setup.ts`

```typescript
/**
 * Global test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/test_db';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock console.error to reduce noise in test output
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
```

**Frontend global setup:** `jest.setup.js`

```javascript
// Configure environment for jsdom
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api';

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

## Recent Test Additions

**Comprehensive FSM Test Suite (Commit d528d1a):**
- 9 state machines fully tested: Order, SupplierOrder, Container, Quotation, Complaint, Voucher, WarehouseCN, WarehouseVN, CustomsDeclaration
- Each FSM has 50-100+ test cases covering:
  - Happy path lifecycle transitions
  - Domain-specific gates (e.g., MHH deposit requirement)
  - Error conditions and rollback scenarios
  - Edge cases (concurrent transitions, state conflicts)

**Frontend Playwright E2E Suite (Commit d528d1a):**
- 10+ E2E test files covering critical user flows:
  - Authentication (login, 2FA, logout)
  - Order creation and lifecycle
  - Container management
  - Finance operations
  - Dashboard views
- Uses Page Object Model architecture for maintainability
- Tests both happy paths and error scenarios

---

*Testing analysis: 2026-03-18*
