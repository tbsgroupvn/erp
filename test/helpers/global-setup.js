const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  // Apply pending Prisma migrations to the test DB (DATABASE_URL must already
  // point at it — set via `npx dotenv -e .env.test -- jest ...`).
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
};
