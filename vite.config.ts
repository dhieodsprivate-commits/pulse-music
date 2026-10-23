import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { musicApi } from './server/plugin.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), musicApi()],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
