/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  globalSetup: '<rootDir>/test/helpers/global-setup.js',
  // Bật cờ đồng ý cho cổng danh tính test (`x-uid` của PermGuard). Từ F-5,
  // createApp() TỪ CHỐI boot khi NODE_ENV==='test' mà thiếu cờ này — xem
  // test/helpers/jest-setup-env.js và test/auth/test-bypass-boot.spec.ts.
  setupFiles: ['<rootDir>/test/helpers/jest-setup-env.js'],
  // Integration specs share ONE Postgres test DB; resetDb() TRUNCATEs shared
  // tables, so parallel Jest workers running different spec files race each
  // other. Serialize spec FILES (this does not affect within-test async
  // concurrency, e.g. Promise.all inside a single test).
  maxWorkers: 1,
};
