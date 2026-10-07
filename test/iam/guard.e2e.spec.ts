import { PrismaModule } from '../../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { IamModule } from '../../src/iam/iam.module';
import { PermGuard } from '../../src/iam/perm.guard';
import { RequirePerm } from '../../src/iam/require-perm.decorator';
import { PermService } from '../../src/iam/perm.service';

@Controller('demo')
class DemoController {
  @Get('orders') @RequirePerm('order.view') @UseGuards(PermGuard)
  list() { return { ok: true }; }
}

let app: INestApplication;
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, IamModule], controllers: [DemoController] }).compile();
  app = mod.createNestApplication(); await app.init();
});
beforeEach(resetIam); afterAll(async () => { await app.close(); await prisma.$disconnect(); });

test('403 without perm, 200 with perm (via x-uid test header)', async () => {
  const u = await seedUser({});
  await request(app.getHttpServer()).get('/demo/orders').set('x-uid', String(u.id)).expect(403);
  const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]); await assignRole(u.id, r.id);
  // assignRole ghi thẳng CSDL (không qua service cấp phát vai thật) nên không tự bump
  // PermService.version() -> cache "chưa có quyền" ở request trước vẫn còn hiệu lực.
  // Một luồng cấp vai thật (Task 11: PermAdminService) sẽ tự bumpVersion(); ở đây clear tay.
  app.get(PermService).clearCache();
  await request(app.getHttpServer()).get('/demo/orders').set('x-uid', String(u.id)).expect(200);
});
test('super admin passes without explicit perm', async () => {
  const su = await seedUser({ isSuperAdmin: true });
  await request(app.getHttpServer()).get('/demo/orders').set('x-uid', String(su.id)).expect(200);
});
test('x-uid is ignored in production (fail-closed without JWT)', async () => {
  const su = await seedUser({ isSuperAdmin: true });
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await request(app.getHttpServer()).get('/demo/orders').set('x-uid', String(su.id)).expect(403);
  } finally { process.env.NODE_ENV = prev; }
});
