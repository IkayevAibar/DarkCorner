import { defineConfig } from 'tsup';

// One ESM file for production. The workspace packages ship TypeScript source,
// so they are bundled in; everything from npm stays external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@dark\//],
});
