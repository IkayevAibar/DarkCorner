import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-db.js';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Every file truncates the same database, so files take turns.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: 'test-session-secret-0123456789',
      PUBLIC_WEB_URL: 'http://localhost:5180',
      ADMIN_DISCORD_IDS: '111111111111111111',
      SSO_SECRET: '',
    },
  },
});
