# TBS ERP v2

NestJS API source for the TBS ERP migration/workbench.

## Setup

```bash
npm ci
cp .env.example .env
npx prisma migrate deploy
npm run build
npm run start:prod
```

`npm ci` and `npm run build` both generate the Prisma Client automatically. Real `.env` and `.env.test` files are intentionally ignored and must not be committed.

## Required Environment

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: strong private signing secret. The app refuses to start without it.
- `JWT_TTL`: optional token lifetime, default convention is `8h`.
- `PORT`: optional HTTP port.

## Verification

```bash
npm run build
npm run lint
npm run verify
```

`npm run verify` needs a working `.env.test` database target. Use only local/test databases for verification.
