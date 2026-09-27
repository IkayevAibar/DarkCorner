import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Runs in Node, but the web tsconfig only ships browser types.
declare const process: { env: Record<string, string | undefined> };

// In production nginx proxies /api and /auth to the API container; in
// development this proxy plays that role, so cookies stay first-party.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4100';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/auth': { target: apiTarget, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
