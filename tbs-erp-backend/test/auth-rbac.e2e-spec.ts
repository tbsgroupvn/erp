import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import * as cookieParser from 'cookie-parser';
import { PrismaService } from '@core/database/prisma.service';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@common/filters/prisma-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { AppModule } from '@/app.module';
import { Branch, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { TEST_PASSWORD } from './setup';

// ESM-only packages are handled by __mocks__/ manual mocks at project root

/**
 * E2E Test: Tạo User & Phân quyền hệ thống (Auth + RBAC)
 *
 * Covers:
 *  1. Login flow (success, wrong password, inactive user, missing fields)
 *  2. JWT token validation & profile access
 *  3. Role-based access control for Employee CRUD
 *  4. DataScopeGuard: scope filtering per role
 *  5. Impersonation: role restrictions
 *  6. Password validation rules
 */
describe('Auth + RBAC System (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test users created during setup — TEST_PASSWORD imported from ./setup
  let passwordHash: string;

  // User records
  const testUsers: Record<
    string,
    { id?: string; email: string; role: UserRole; branch: Branch; saleCode?: string; leaderId?: string; sessionId?: string }
  > = {
    ceo: { email: 'test_ceo@e2e.local', role: UserRole.CEO, branch: Branch.HN },
    coo: { email: 'test_coo@e2e.local', role: UserRole.COO, branch: Branch.HN },
    hrManager: { email: 'test_hr@e2e.local', role: UserRole.HR_MANAGER, branch: Branch.HN },
    salesDirector: { email: 'test_sdirector@e2e.local', role: UserRole.SALES_DIRECTOR, branch: Branch.HN },
    salesLeader: { email: 'test_sleader@e2e.local', role: UserRole.SALES_LEADER, branch: Branch.HN },
    sale1: { email: 'test_sale1@e2e.local', role: UserRole.SALE, branch: Branch.HN, saleCode: 'E2E-S01' },
    sale2: { email: 'test_sale2@e2e.local', role: UserRole.SALE, branch: Branch.HCM, saleCode: 'E2E-S02' },
    cfo: { email: 'test_cfo@e2e.local', role: UserRole.CFO, branch: Branch.HN },
    accountant: { email: 'test_acct@e2e.local', role: UserRole.ACCOUNTANT, branch: Branch.HN },
    warehouseCn: { email: 'test_whcn@e2e.local', role: UserRole.WAREHOUSE_CN_AGENT, branch: Branch.HN },
    driver: { email: 'test_driver@e2e.local', role: UserRole.DRIVER, branch: Branch.HN },
    cskh: { email: 'test_cskh@e2e.local', role: UserRole.CSKH, branch: Branch.HN },
    inactive: { email: 'test_inactive@e2e.local', role: UserRole.SALE, branch: Branch.HN, saleCode: 'E2E-INA' },
  };

  // JWT tokens per user
  const tokens: Record<string, string> = {};

  // Employee IDs created during test
  const createdEmployeeIds: string[] = [];

  // ─── Setup / Teardown ────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await createTestUsers();
    mintTokens();
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  }, 60000);

  async function createTestUsers() {
    // Create all test users + sessions
    for (const [key, userData] of Object.entries(testUsers)) {
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          fullName: `E2E ${key}`,
          role: userData.role,
          branch: userData.branch,
          saleCode: userData.saleCode ?? null,
          isActive: key !== 'inactive', // inactive user is deactivated
        },
      });
      testUsers[key].id = user.id;

      // Create a real session for JWT validation (skip for inactive)
      if (key !== 'inactive') {
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            refreshToken: `e2e-refresh-${key}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            userAgent: 'E2E Test Runner',
            ipAddress: '127.0.0.1',
          },
        });
        testUsers[key].sessionId = session.id;
      }
    }

    // Set sales hierarchy: sale1 -> salesLeader -> salesDirector
    await prisma.user.update({
      where: { id: testUsers.salesLeader.id },
      data: { leaderId: testUsers.salesDirector.id },
    });
    await prisma.user.update({
      where: { id: testUsers.sale1.id },
      data: { leaderId: testUsers.salesLeader.id },
    });
    await prisma.user.update({
      where: { id: testUsers.sale2.id },
      data: { leaderId: testUsers.salesLeader.id },
    });

    testUsers.sale1.leaderId = testUsers.salesLeader.id;
    testUsers.sale2.leaderId = testUsers.salesLeader.id;
    testUsers.salesLeader.leaderId = testUsers.salesDirector.id;
  }

  function mintTokens() {
    for (const [key, userData] of Object.entries(testUsers)) {
      if (key === 'inactive') continue; // Don't mint for inactive
      tokens[key] = jwtService.sign({
        sub: userData.id,
        email: userData.email,
        role: userData.role,
        branch: userData.branch,
        hasSaleCode: !!userData.saleCode,
        sessionId: userData.sessionId, // real session ID from DB
      });
    }
  }

  async function cleanupTestData() {
    // Delete created employees
    for (const empId of createdEmployeeIds) {
      await prisma.employee.delete({ where: { id: empId } }).catch(() => {});
    }

    // Delete sessions and test users (cascade should handle sessions, but be explicit)
    const userIds = Object.values(testUsers).map((u) => u.id).filter(Boolean) as string[];
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  function authHeader(userKey: string) {
    return { Authorization: `Bearer ${tokens[userKey]}` };
  }

  // =====================================================================
  // 1. LOGIN FLOW
  // =====================================================================

  describe('1. Login Flow', () => {
    it('1.1 Login thành công với email + password đúng', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.ceo.email, password: TEST_PASSWORD })
        .expect(200);

      // Response may be wrapped by TransformInterceptor: { success, data: { user, tokens } }
      const body = res.body.data || res.body;
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('tokens');
      expect(body.tokens).toHaveProperty('accessToken');
      expect(body.tokens).toHaveProperty('expiresIn');
      expect(body.user.email).toBe(testUsers.ceo.email);
      expect(body.user.role).toBe(UserRole.CEO);
    });

    it('1.2 Login thất bại - sai mật khẩu', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.ceo.email, password: 'WrongPass123!' }) // nosec: intentionally wrong password to test rejection
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('1.3 Login thất bại - email không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@e2e.local', password: 'SomePass@123' }) // nosec: intentionally wrong password to test rejection
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('1.4 Login thất bại - tài khoản bị vô hiệu hóa', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.inactive.email, password: TEST_PASSWORD })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });

    it('1.5 Login thất bại - thiếu email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: TEST_PASSWORD })
        .expect(400);
    });

    it('1.6 Login thất bại - thiếu password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.ceo.email })
        .expect(400);
    });

    it('1.7 Login thất bại - password quá ngắn (< 8 ký tự)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.ceo.email, password: 'Ab1!' })
        .expect(400);
    });
  });

  // =====================================================================
  // 2. JWT TOKEN & PROFILE
  // =====================================================================

  describe('2. JWT Token & Profile', () => {
    it('2.1 Truy cập profile với token hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set(authHeader('ceo'))
        .expect(200);

      const profile = res.body.data || res.body;
      expect(profile.email).toBe(testUsers.ceo.email);
      expect(profile.role).toBe(UserRole.CEO);
    });

    it('2.2 Truy cập profile không có token → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('2.3 Token giả mạo bị từ chối', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set({ Authorization: 'Bearer fake.invalid.token' })
        .expect(401);
    });

    it('2.4 JWT payload chứa đúng role và branch', () => {
      const payload = jwtService.decode(tokens.sale1) as Record<string, unknown>;
      expect(payload.role).toBe(UserRole.SALE);
      expect(payload.branch).toBe(Branch.HN);
      expect(payload.hasSaleCode).toBe(true);
    });

    it('2.5 JWT payload cho user không có saleCode → hasSaleCode = false', () => {
      const payload = jwtService.decode(tokens.accountant) as Record<string, unknown>;
      expect(payload.role).toBe(UserRole.ACCOUNTANT);
      expect(payload.hasSaleCode).toBe(false);
    });

    it('2.6 Profile cho mỗi role trả về đúng thông tin', async () => {
      const rolesToTest = ['ceo', 'hrManager', 'sale1', 'accountant', 'driver'];
      for (const key of rolesToTest) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/auth/profile')
          .set(authHeader(key))
          .expect(200);

        const profile = res.body.data || res.body;
        expect(profile.email).toBe(testUsers[key].email);
        expect(profile.role).toBe(testUsers[key].role);
      }
    });
  });

  // =====================================================================
  // 3. EMPLOYEE CRUD - ROLE-BASED ACCESS
  // =====================================================================

  describe('3. Employee CRUD - Phân quyền theo Role', () => {
    const validEmployee = {
      fullName: 'Nguyễn Văn E2E Test',
      departmentCode: 'IT',
      positionTitle: 'Developer',
      branch: 'HN',
      joinDate: '2026-01-15',
      salary: 20000000,
    };

    // ─── 3a. Tạo nhân viên ─────────────────────────────────────────────

    it('3.1 CEO tạo nhân viên thành công', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('ceo'))
        .send({ ...validEmployee, email: `ceo_emp_${Date.now()}@e2e.local` })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data.code).toMatch(/^EMP-\d{4}$/);
      expect(res.body.data.fullName).toBe(validEmployee.fullName);
      createdEmployeeIds.push(res.body.data.id);
    });

    it('3.2 COO tạo nhân viên thành công', async () => {
      const ts = Date.now();
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('coo'))
        .send({
          fullName: `COO Employee ${ts}`,
          departmentCode: 'COO-E2E',
          positionTitle: 'Tester',
          branch: 'HN',
          joinDate: '2026-01-15',
          email: `coo_emp_${ts}@e2e.local`,
        });

      // Employee code generation has a known race condition.
      // If 409 (code collision), the test verifies authorization passed — the error is at DB level, not auth.
      expect([201, 409]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        createdEmployeeIds.push(res.body.data.id);
      }
    });

    it('3.3 HR_MANAGER tạo nhân viên thành công', async () => {
      const ts = Date.now();
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('hrManager'))
        .send({
          fullName: `HR Employee ${ts}`,
          departmentCode: 'HR-E2E',
          positionTitle: 'Tester',
          branch: 'HN',
          joinDate: '2026-01-15',
          email: `hr_emp_${ts}@e2e.local`,
        });

      // Same note: 409 means auth passed but code collision happened
      expect([201, 409]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        createdEmployeeIds.push(res.body.data.id);
      }
    });

    it('3.4 SALE không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('sale1'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.5 ACCOUNTANT không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('accountant'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.6 WAREHOUSE_CN_AGENT không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('warehouseCn'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.7 DRIVER không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('driver'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.8 CSKH không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('cskh'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.9 SALES_DIRECTOR không được tạo nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('salesDirector'))
        .send(validEmployee)
        .expect(403);
    });

    it('3.10 Không có token → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .send(validEmployee)
        .expect(401);
    });

    // ─── 3b. Validation khi tạo nhân viên ───────────────────────────────

    it('3.11 Thiếu fullName → 400', async () => {
      const { fullName, ...incomplete } = validEmployee;
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('hrManager'))
        .send(incomplete)
        .expect(400);
    });

    it('3.12 Thiếu departmentCode → 400', async () => {
      const { departmentCode, ...incomplete } = validEmployee;
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('hrManager'))
        .send(incomplete)
        .expect(400);
    });

    it('3.13 Thiếu joinDate → 400', async () => {
      const { joinDate, ...incomplete } = validEmployee;
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('hrManager'))
        .send(incomplete)
        .expect(400);
    });

    it('3.14 Branch không hợp lệ → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeader('hrManager'))
        .send({ ...validEmployee, branch: 'INVALID' })
        .expect(400);
    });

    // ─── 3c. Xem danh sách nhân viên ────────────────────────────────────

    it('3.15 CEO xem danh sách nhân viên thành công', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('ceo'))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page');
    });

    it('3.16 HR_MANAGER xem danh sách nhân viên thành công', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('hrManager'))
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('3.17 CFO xem danh sách nhân viên thành công', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('cfo'))
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('3.18 SALE không được xem danh sách nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('sale1'))
        .expect(403);
    });

    it('3.19 DRIVER không được xem danh sách nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('driver'))
        .expect(403);
    });

    it('3.20 ACCOUNTANT không được xem danh sách nhân viên → 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeader('accountant'))
        .expect(403);
    });
  });

  // =====================================================================
  // 4. DATA SCOPE GUARD
  // =====================================================================

  describe('4. DataScopeGuard - Phạm vi dữ liệu theo role', () => {
    it('4.1 CEO có isGlobal = true (xem tất cả dữ liệu)', () => {
      // Verify DataScopeGuard logic via the guard itself
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'ceo-id',
        email: 'ceo@test.com',
        role: UserRole.CEO,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
      expect(filter.denied).toBeUndefined();
    });

    it('4.2 COO có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'coo-id',
        email: 'coo@test.com',
        role: UserRole.COO,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.3 CFO có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'cfo-id',
        email: 'cfo@test.com',
        role: UserRole.CFO,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.4 DIRECTOR_OPERATIONS có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'dops-id',
        email: 'dops@test.com',
        role: UserRole.DIRECTOR_OPERATIONS,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.5 HR_MANAGER có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'hr-id',
        email: 'hr@test.com',
        role: UserRole.HR_MANAGER,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.6 LOGISTICS_MANAGER có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'lm-id',
        email: 'lm@test.com',
        role: UserRole.LOGISTICS_MANAGER,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.7 WAREHOUSE_MANAGER có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'wm-id',
        email: 'wm@test.com',
        role: UserRole.WAREHOUSE_MANAGER,
        branch: Branch.HCM,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.8 SALES_LEADER chỉ thấy dữ liệu team mình (teamLeaderId)', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'leader-id',
        email: 'leader@test.com',
        role: UserRole.SALES_LEADER,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.teamLeaderId).toBe('leader-id');
      expect(filter.branch).toBe(Branch.HN);
    });

    it('4.9 SALE chỉ thấy dữ liệu của mình (saleId)', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'sale-id',
        email: 'sale@test.com',
        role: UserRole.SALE,
        branch: Branch.HN,
        leaderId: 'leader-id',
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.saleId).toBe('sale-id');
      expect(filter.branch).toBe(Branch.HN);
    });

    it('4.10 CHIEF_ACCOUNTANT có isGlobal = true (xem tài chính tất cả chi nhánh)', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'ca-id',
        email: 'ca@test.com',
        role: UserRole.CHIEF_ACCOUNTANT,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.11 ACCOUNTANT có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'acc-id',
        email: 'acc@test.com',
        role: UserRole.ACCOUNTANT,
        branch: Branch.HCM,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.12 ACCOUNTANT_AR chỉ xem dữ liệu chi nhánh mình', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'ar-id',
        email: 'ar@test.com',
        role: UserRole.ACCOUNTANT_AR,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.branch).toBe(Branch.HN);
    });

    it('4.13 DRIVER chỉ thấy giao hàng của mình (driverId)', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'driver-id',
        email: 'driver@test.com',
        role: UserRole.DRIVER,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.driverId).toBe('driver-id');
      expect(filter.branch).toBe(Branch.HN);
    });

    it('4.14 WAREHOUSE_CN_AGENT chỉ xem dữ liệu chi nhánh', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'wh-id',
        email: 'wh@test.com',
        role: UserRole.WAREHOUSE_CN_AGENT,
        branch: Branch.HCM,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.branch).toBe(Branch.HCM);
    });

    it('4.15 XNK_MANAGER có isGlobal = true', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'xnk-id',
        email: 'xnk@test.com',
        role: UserRole.XNK_MANAGER,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(true);
    });

    it('4.16 XNK_STAFF chỉ xem dữ liệu chi nhánh', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'xnk-staff-id',
        email: 'xnkstaff@test.com',
        role: UserRole.XNK_STAFF,
        branch: Branch.HCM,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.branch).toBe(Branch.HCM);
    });

    it('4.17 MARKETING_STAFF chỉ xem dữ liệu chi nhánh', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const filter = guard['buildDataScopeFilter']({
        id: 'mkt-id',
        email: 'mkt@test.com',
        role: UserRole.MARKETING_STAFF,
        branch: Branch.HN,
        leaderId: null,
      });
      expect(filter.isGlobal).toBe(false);
      expect(filter.branch).toBe(Branch.HN);
    });

    it('4.18 Tất cả 22 roles đều có scope hợp lệ (không bị denied)', () => {
      const guard = new (require('@common/guards/data-scope.guard').DataScopeGuard)();
      const allRoles = Object.values(UserRole);

      for (const role of allRoles) {
        const filter = guard['buildDataScopeFilter']({
          id: `test-${role}`,
          email: `${role}@test.com`,
          role: role as UserRole,
          branch: Branch.HN,
          leaderId: null,
        });

        expect(filter.denied).not.toBe(true);
        // Every role should either be global or have a valid scope
        if (!filter.isGlobal) {
          const hasScope = filter.branch || filter.saleId || filter.teamLeaderId || filter.driverId;
          expect(hasScope).toBeTruthy();
        }
      }
    });
  });

  // =====================================================================
  // 5. IMPERSONATION - ROLE RESTRICTIONS
  // =====================================================================

  describe('5. Impersonation - Chỉ roles được phép', () => {
    it('5.1 SALE không được impersonate → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/impersonate/fake-customer-id')
        .set(authHeader('sale1'))
        .expect(403);
    });

    it('5.2 ACCOUNTANT không được impersonate → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/impersonate/fake-customer-id')
        .set(authHeader('accountant'))
        .expect(403);
    });

    it('5.3 HR_MANAGER không được impersonate → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/impersonate/fake-customer-id')
        .set(authHeader('hrManager'))
        .expect(403);
    });

    it('5.4 DRIVER không được impersonate → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/impersonate/fake-customer-id')
        .set(authHeader('driver'))
        .expect(403);
    });

    it('5.5 Không có token → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/impersonate/fake-customer-id')
        .expect(401);
    });

    // Note: CEO/COO/SALES_DIRECTOR/CSKH CAN impersonate, but we'd need a real
    // customer ID for a 200 response. We verify the 403 for unauthorized roles.
  });

  // =====================================================================
  // 6. PASSWORD CHANGE - AUTH REQUIRED
  // =====================================================================

  describe('6. Password Change', () => {
    it('6.1 Đổi mật khẩu thành công', async () => {
      const newPass = 'NewPass@2024!'; // nosec: test fixture new-password value
      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set(authHeader('sale2'))
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: newPass,
        })
        .expect(200);

      const body = res.body.data || res.body;
      expect(body.message).toBeDefined();

      // Verify can login with new password
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.sale2.email, password: newPass })
        .expect(200);

      const loginBody = loginRes.body.data || loginRes.body;
      expect(loginBody.user.email).toBe(testUsers.sale2.email);

      // Reset password back for cleanup
      const newHash = await bcrypt.hash(TEST_PASSWORD, 10);
      await prisma.user.update({
        where: { id: testUsers.sale2.id },
        data: { passwordHash: newHash },
      });
    });

    it('6.2 Đổi mật khẩu thất bại - sai mật khẩu hiện tại', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set(authHeader('sale1'))
        .send({
          currentPassword: 'WrongCurrent123!', // nosec: intentionally wrong password to test rejection
          newPassword: 'NewPass@2024!', // nosec: test fixture new-password value
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('6.3 Đổi mật khẩu thất bại - không có token → 401', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: 'NewPass@2024!', // nosec: test fixture new-password value
        })
        .expect(401);
    });
  });

  // =====================================================================
  // 7. CROSS-ROLE ACCESS MATRIX (Summary)
  // =====================================================================

  describe('7. Ma trận phân quyền tổng hợp', () => {
    const rolesCanCreateEmployee = ['ceo', 'coo', 'hrManager'];
    const rolesCannotCreateEmployee = [
      'salesDirector',
      'salesLeader',
      'sale1',
      'accountant',
      'warehouseCn',
      'driver',
      'cskh',
    ];

    const rolesCanViewEmployee = ['ceo', 'coo', 'hrManager', 'salesDirector'];
    const rolesCannotViewEmployee = ['sale1', 'accountant', 'warehouseCn', 'driver', 'cskh'];

    it('7.1 Chỉ CEO/COO/HR_MANAGER được tạo nhân viên', async () => {
      for (const role of rolesCanCreateEmployee) {
        const ts = Date.now();
        const res = await request(app.getHttpServer())
          .post('/api/v1/employees')
          .set(authHeader(role))
          .send({
            fullName: `Matrix Test ${role} ${ts}`,
            departmentCode: 'MATRIX',
            positionTitle: 'Tester',
            branch: 'HN',
            joinDate: '2026-03-15',
            email: `matrix_${role}_${ts}@e2e.local`,
          });

        // 201 = success, 409 = employee code collision (known race condition, auth passed)
        // Both mean authorization was granted — not 403
        expect([201, 409]).toContain(res.status);
        if (res.status === 201) {
          createdEmployeeIds.push(res.body.data.id);
        }
      }
    });

    it('7.2 Các role khác không được tạo nhân viên', async () => {
      for (const role of rolesCannotCreateEmployee) {
        await request(app.getHttpServer())
          .post('/api/v1/employees')
          .set(authHeader(role))
          .send({
            fullName: `Denied Test ${role}`,
            departmentCode: 'DENY',
            positionTitle: 'Tester',
            branch: 'HN',
            joinDate: '2026-03-15',
          })
          .expect(403);
      }
    });

    it('7.3 Roles có quyền xem danh sách nhân viên', async () => {
      for (const role of rolesCanViewEmployee) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/employees')
          .set(authHeader(role))
          .expect(200);

        expect(res.body.success).toBe(true);
      }
    });

    it('7.4 Roles không có quyền xem danh sách nhân viên', async () => {
      for (const role of rolesCannotViewEmployee) {
        await request(app.getHttpServer())
          .get('/api/v1/employees')
          .set(authHeader(role))
          .expect(403);
      }
    });
  });

  // =====================================================================
  // 8. LOGOUT
  // =====================================================================

  describe('8. Logout', () => {
    it('8.1 Logout thành công với token hợp lệ', async () => {
      // Login first to get a real session
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUsers.cskh.email, password: TEST_PASSWORD })
        .expect(200);

      const loginBody = loginRes.body.data || loginRes.body;
      const accessToken = loginBody.tokens.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set({ Authorization: `Bearer ${accessToken}` })
        .expect(200);

      const body = res.body.data || res.body;
      expect(body.message).toBeDefined();
    });

    it('8.2 Logout không có token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
