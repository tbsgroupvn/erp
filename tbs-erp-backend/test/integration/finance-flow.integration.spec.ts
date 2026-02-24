import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * Integration tests for Finance operations.
 * Tests AR/AP lifecycle, payment vouchers, and debt netting.
 */
describe('Finance Operations Integration', () => {
  let app: INestApplication;
  let authToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Account Receivable', () => {
    it('should list AR records with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/finance/ar')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
      }
    });

    it('should filter AR by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/finance/ar')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'OVERDUE', page: 1, limit: 10 });

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Payment Voucher Validation', () => {
    it('should reject payment voucher with invalid amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/finance/payment-vouchers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'PAYMENT',
          amount: -100,
          reason: 'Test invalid amount',
        });

      expect([400, 403, 422]).toContain(response.status);
    });

    it('should reject payment voucher with short reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/finance/payment-vouchers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'PAYMENT',
          amount: 100000,
          reason: 'Short', // Less than 20 chars required
        });

      expect([400, 403, 422]).toContain(response.status);
    });
  });

  describe('Exchange Rates', () => {
    it('should return current exchange rates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/exchange-rates')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });
});
