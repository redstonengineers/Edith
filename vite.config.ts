import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_DATA_MODE === 'api';
  return {
    plugins: [react(), tailwindcss(), {
      // Lista de archivos compilados que el service worker guarda para abrir la app sin conexión.
      name: 'precache-list', apply: 'build',
      generateBundle(_o, bundle) { this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(Object.keys(bundle).filter((f) => /\.(js|css|woff2?)$/.test(f)).map((f) => `/${f}`)) }); },
    }],
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
