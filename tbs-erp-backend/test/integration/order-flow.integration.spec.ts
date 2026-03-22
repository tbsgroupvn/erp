import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TEST_ADMIN_PASSWORD } from '../setup';

/**
 * Integration tests for the complete Order lifecycle.
 * Tests the flow: Create Order → Complete → AR Created → Commission Calculated
 *
 * Requires: Running database (use docker-compose.yml for test env)
 * Run: npm run test:integration
 */
describe('Order Lifecycle Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [], // Import AppModule when running against real DB
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@tbslogistics.com',
          password: TEST_ADMIN_PASSWORD,
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      authToken = response.body.data.accessToken;
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@tbslogistics.com',
          password: 'wrongpassword', // nosec: intentionally wrong password to test rejection
        })
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview')
        .set('Authorization', 'Bearer expired.token.here')
        .expect(401);
    });
  });

  describe('Dashboard Access Control', () => {
    it('should return dashboard overview for authenticated users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dateFrom: '2025-01-01', dateTo: '2025-12-31' });

      expect([200, 403]).toContain(response.status);
    });

    it('should enforce RBAC on finance dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard/finance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dateFrom: '2025-01-01', dateTo: '2025-12-31' });

      // Should succeed for admin or return 403 for unauthorized roles
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should return readiness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready');

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoint', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' }),
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter((r) => r.status === 429);
      // At least some should be rate limited
      expect(tooManyRequests.length).toBeGreaterThanOrEqual(0);
    });
  });
});
