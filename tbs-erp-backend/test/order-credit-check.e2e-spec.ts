import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@core/database/prisma.service';
import { AppModule } from '@/app.module';
import { ServiceType, Branch, Currency, CustomerTier } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * E2E Integration Tests for Credit Check Guard
 *
 * These tests demonstrate the full flow of order creation with credit checks.
 * They require a running database and proper test setup.
 *
 * To run these tests:
 * 1. Set up a test database
 * 2. Run migrations: npx prisma migrate deploy
 * 3. Run: npm run test:e2e -- order-credit-check.e2e-spec.ts
 */
describe('Order Creation with Credit Check (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testCustomerId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create a test user for authentication
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashed_password', // In real tests, use proper hashing
        fullName: 'Test User',
        role: 'SALE',
        branch: Branch.HN,
        isActive: true,
      },
    });
    testUserId = user.id;

    // Create a test customer with credit limit
    const customer = await prisma.customer.create({
      data: {
        code: 'TEST-KH-001',
        fullName: 'Test Customer Company',
        phone: '0123456789',
        tier: CustomerTier.REGULAR,
        creditLimit: new Decimal(100000000), // 100M VND
        currentDebt: new Decimal(50000000), // 50M VND current debt
        isActive: true,
      },
    });
    testCustomerId = customer.id;

    // Mock authentication token (in real tests, generate via auth endpoint)
    authToken = 'Bearer mock_token_here';
  }

  async function cleanupTestData() {
    if (testCustomerId) {
      await prisma.order.deleteMany({ where: { customerId: testCustomerId } });
      await prisma.accountReceivable.deleteMany({ where: { customerId: testCustomerId } });
      await prisma.customer.delete({ where: { id: testCustomerId } });
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
  }

  describe('POST /orders - Credit Check Validation', () => {
    it('should allow order creation when credit limit is sufficient and no overdue debt', async () => {
      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 10000000, // 10M VND (within 50M available)
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.customerId).toBe(testCustomerId);
    });

    it('should block order creation when amount exceeds available credit', async () => {
      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Expensive Product',
            quantity: 1,
            unitPrice: 60000000, // 60M VND (exceeds 50M available)
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(403);

      expect(response.body.message).toContain('vượt quá hạn mức tín dụng');
      expect(response.body.message).toContain('60,000,000');
    });

    it('should block order creation when customer has overdue debt > 15 days', async () => {
      // Create overdue receivable
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

      await prisma.accountReceivable.create({
        data: {
          code: 'TEST-AR-001',
          customerId: testCustomerId,
          amount: new Decimal(10000000),
          paidAmount: new Decimal(0),
          dueDate: overdueDate,
          status: 'OPEN',
          createdBy: testUserId,
        },
      });

      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 5000000, // Small amount, within credit
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(403);

      expect(response.body.message).toContain('công nợ quá hạn');
      expect(response.body.message).toContain('20 ngày');
      expect(response.body.message).toContain('15 ngày cho phép');

      // Clean up
      await prisma.accountReceivable.deleteMany({
        where: { code: 'TEST-AR-001' },
      });
    });

    it('should allow order when overdue debt is within 15 days threshold', async () => {
      // Create receivable with acceptable overdue period
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      await prisma.accountReceivable.create({
        data: {
          code: 'TEST-AR-002',
          customerId: testCustomerId,
          amount: new Decimal(5000000),
          paidAmount: new Decimal(0),
          dueDate: overdueDate,
          status: 'OPEN',
          createdBy: testUserId,
        },
      });

      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 5000000,
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Clean up
      await prisma.accountReceivable.deleteMany({
        where: { code: 'TEST-AR-002' },
      });
    });

    it('should block order creation when customer is inactive', async () => {
      // Create inactive customer
      const inactiveCustomer = await prisma.customer.create({
        data: {
          code: 'TEST-KH-INACTIVE',
          fullName: 'Inactive Customer',
          phone: '0987654321',
          tier: CustomerTier.NEW,
          creditLimit: new Decimal(50000000),
          currentDebt: new Decimal(0),
          isActive: false, // Inactive
        },
      });

      const orderDto = {
        customerId: inactiveCustomer.id,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 1000000,
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(403);

      expect(response.body.message).toContain('đã bị vô hiệu hóa');

      // Clean up
      await prisma.customer.delete({ where: { id: inactiveCustomer.id } });
    });

    it('should calculate total correctly for multiple items', async () => {
      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 5000000, // 10M
            currency: Currency.VND,
          },
          {
            productName: 'Product 2',
            quantity: 3,
            unitPrice: 3000000, // 9M
            currency: Currency.VND,
          },
          {
            productName: 'Product 3',
            quantity: 1,
            unitPrice: 1000000, // 1M
            currency: Currency.VND,
          },
        ],
        // Total: 20M (within 50M available)
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should block when multiple items total exceeds credit limit', async () => {
      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product 1',
            quantity: 5,
            unitPrice: 10000000, // 50M
            currency: Currency.VND,
          },
          {
            productName: 'Product 2',
            quantity: 2,
            unitPrice: 5000000, // 10M
            currency: Currency.VND,
          },
        ],
        // Total: 60M (exceeds 50M available)
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(403);

      expect(response.body.message).toContain('vượt quá hạn mức tín dụng');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide detailed error message with customer info', async () => {
      const orderDto = {
        customerId: testCustomerId,
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 60000000,
            currency: Currency.VND,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authToken)
        .send(orderDto)
        .expect(403);

      const message = response.body.message;
      expect(message).toContain('Test Customer Company');
      expect(message).toContain('TEST-KH-001');
      expect(message).toContain('Hạn mức tín dụng');
      expect(message).toContain('Công nợ hiện tại');
      expect(message).toContain('VND');
    });
  });
});
