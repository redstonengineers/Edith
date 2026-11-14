import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_DATA_MODE === 'api';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        // En modo API las mutaciones se ejecutan en el servidor (generado por scripts-gen-remote.mjs).
        ...(api ? [{ find: /^@\/services\/mutations$/, replacement: fileURLToPath(new URL('./src/services/mutations.remote.ts', import.meta.url)) }] : []),
        ...(api ? [{ find: /^@\/data\/seed$/, replacement: fileURLToPath(new URL('./src/data/seed.stub.ts', import.meta.url)) }] : []),
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    server: { proxy: { '/api': { target: env.API_PROXY ?? 'http://127.0.0.1:4000', changeOrigin: false } } },
  };
});
