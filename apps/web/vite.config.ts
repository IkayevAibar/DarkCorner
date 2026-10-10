import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Runs in Node, but the web tsconfig only ships browser types.
declare const process: { env: Record<string, string | undefined> };

// In production nginx proxies /api and /auth to the API container; in
// development this proxy plays that role, so cookies stay first-party.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4100';

// `--mode solo` builds the offline game: no server, every API call answered on
// the device by @dark/solo (docs/plan-solo-offline.md). Its dev server runs on
// its own port, so both can run side by side.
export default defineConfig(({ mode }) => {
  const solo = mode === 'solo';
  return {
    plugins: [react(), tailwindcss()],
    define: { __SOLO__: JSON.stringify(solo) },
    server: {
      port: solo ? 5181 : 5180,
      strictPort: true,
      proxy: solo
        ? undefined
        : {
          '/api': { target: apiTarget, changeOrigin: true },
          '/auth': { target: apiTarget, changeOrigin: true },
        },
    },
    build: { outDir: solo ? 'dist-solo' : 'dist', sourcemap: false },
  };
});
