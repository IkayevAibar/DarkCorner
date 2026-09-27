/** Tests run against their own database so they never touch the one you play on. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://dark:dark@localhost:5433/dark_corner_test?schema=public';
