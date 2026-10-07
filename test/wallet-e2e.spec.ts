import { PrismaModule } from '../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MoneyModule } from '../src/money/money.module';
import { WalletService } from '../src/money/wallet.service';
import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';

let app: INestApplication; let w: WalletService;
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, MoneyModule] }).compile();
  app = mod.createNestApplication(); await app.init();
  w = mod.get(WalletService);
});
beforeEach(async () => { await resetDb(); await seedAccounts(); await seedMapping('wallet_nap', '111', '131', true); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });

test('GET available', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  const res = await request(app.getHttpServer()).get('/wallets/TBS1/available').expect(200);
  expect(res.body).toEqual({ balance: '1000000', available: '1000000' });
});
