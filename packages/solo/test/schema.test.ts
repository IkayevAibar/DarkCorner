import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// The in-memory database reads its tables from src/db/schema.gen.ts, made from
// apps/api/prisma/schema.prisma: a schema change needs `npm run gen:schema -w @dark/solo`.
it('describes the tables the Prisma schema has', () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  expect(() => execFileSync(process.execPath, ['scripts/gen-schema.mjs', '--check'], { cwd, stdio: 'pipe' })).not.toThrow();
});
