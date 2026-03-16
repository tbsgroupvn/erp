import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@core/database/prisma.service';
import { AppModule } from '@/app.module';
import { Branch } from '@prisma/client';

// Mock isomorphic-dompurify to avoid ESM syntax errors in its deep dependencies (css-color)
jest.mock('isomorphic-dompurify', () => ({
  sanitize: (html: string) => html,
}));

// Mock file-type which is a pure ESM package causing issues in commonjs jest
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

describe('Customer Quick Add & Auth (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let adminAuthToken: string;
    let noSaleAuthToken: string;
    let testUserId: string;
    let noSaleUserId: string;

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

        // Bật versioning /api/v1
        app.setGlobalPrefix('api/v1');

        await app.init();

        prisma = app.get<PrismaService>(PrismaService);

        await setupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        await app.close();
    });

    async function setupTestData() {
        // 1. Tạo User CÓ Quyền Sale (Sale Code)
        const adminUser = await prisma.user.create({
            data: {
                email: 'sale_test@example.com',
                passwordHash: '$2b$12$N9/o9f7m0D0eX7y82w0sIeT/N9/o9f7m0D0eX7y82w0sIeT/N9/o9', // Fake hash
                fullName: 'Test Sale User',
                role: 'SALE',
                branch: Branch.HN,
                saleCode: 'TEST-SALE-001',
                isActive: true,
            },
        });
        testUserId = adminUser.id;

        // 2. Tạo User KHÔNG CÓ Quyền Sale (Kế Toán - ACCOUNTANT)
        const noSaleUser = await prisma.user.create({
            data: {
                email: 'acc_test@example.com',
                passwordHash: '$2b$12$N9/o9f7m0D0eX7y82w0sIeT/N9/o9f7m0D0eX7y82w0sIeT/N9/o9',
                fullName: 'Test Accountant',
                role: 'ACCOUNTANT',
                branch: Branch.HN,
                isActive: true, // No saleCode
            },
        });
        noSaleUserId = noSaleUser.id;

        // Lấy Token cho SALE
        const jwtService = app.get('JwtService'); // From AuthModule
        adminAuthToken = 'Bearer ' + jwtService.sign({
            sub: testUserId,
            email: adminUser.email,
            role: adminUser.role,
            branch: adminUser.branch,
            hasSaleCode: true,
            sessionId: 'test-session-1'
        });

        // Lấy Token cho ACCOUNTANT
        noSaleAuthToken = 'Bearer ' + jwtService.sign({
            sub: noSaleUserId,
            email: noSaleUser.email,
            role: noSaleUser.role,
            branch: noSaleUser.branch,
            hasSaleCode: false,
            sessionId: 'test-session-2'
        });
    }

    async function cleanupTestData() {
        // Xoá KH test
        await prisma.customer.deleteMany({
            where: { phone: '0999888777' }
        });
        // Xoá Users
        if (testUserId) await prisma.user.delete({ where: { id: testUserId } });
        if (noSaleUserId) await prisma.user.delete({ where: { id: noSaleUserId } });
    }

    describe('JWT Payload Verification', () => {
        it('Token cho user Sale phải có hasSaleCode = true', () => {
            const jwtService = app.get('JwtService');
            const payload = jwtService.decode(adminAuthToken.replace('Bearer ', ''));
            expect(payload).toHaveProperty('hasSaleCode', true);
        });

        it('Token cho user Kế toán không có SaleCode phải là false', () => {
            const jwtService = app.get('JwtService');
            const payload = jwtService.decode(noSaleAuthToken.replace('Bearer ', ''));
            expect(payload).toHaveProperty('hasSaleCode', false);
        });
    });

    describe('POST /api/v1/customers/quick', () => {
        it('User Kế Toán không có quyền tạo khách', async () => {
            const createDto = {
                fullName: 'Khách hàng Kế Toán',
                phone: '0999888777',
            };

            const res = await request(app.getHttpServer())
                .post('/api/v1/customers/quick')
                .set('Authorization', noSaleAuthToken)
                .send(createDto)
                .expect(403);
        });

        it('User Sale tạo khách hàng nhanh thành công', async () => {
            const createDto = {
                fullName: 'Khách hàng Nhanh Chóng',
                phone: '0999888777',
            };

            const res = await request(app.getHttpServer())
                .post('/api/v1/customers/quick')
                .set('Authorization', adminAuthToken)
                .send(createDto)
                .expect(201); // Created

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.tier).toBe('NEW');
            expect(res.body.data.phone).toBe('0999888777');
            expect(res.body.data.saleId).toBe(testUserId);
            expect(res.body.data.source).toBe('QUICK_ADD');
        });

        it('Không cho tạo trùng Số Điện Thoại', async () => {
            const createDto = {
                fullName: 'Khách hàng Trùng',
                phone: '0999888777', // Giống số ĐT bên trên
            };

            const res = await request(app.getHttpServer())
                .post('/api/v1/customers/quick')
                .set('Authorization', adminAuthToken)
                .send(createDto)
                .expect(400); // Bad Request

            expect(res.body.message).toContain('đã tồn tại trong hệ thống');
        });
    });
});
