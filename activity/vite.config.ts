import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BOT_WEB_SERVER = `http://localhost:${process.env.WEB_PORT ?? 3001}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: { outDir: 'dist', assetsDir: 'activity-assets', chunkSizeWarningLimit: 2500 },
  server: {
    port: 5173,
    allowedHosts: ['activity-dev.theridge.fr', '.trycloudflare.com'],
    proxy: { '/api': { target: BOT_WEB_SERVER, ws: true } },
  },
});
