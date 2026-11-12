import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Lab files are imported with ?raw straight from the curriculum day folders (one source of truth).
export default defineConfig({
  base: './',
  resolve: { alias: { '@curriculum': resolve(import.meta.dirname, '..') } },
  server: { fs: { allow: [resolve(import.meta.dirname, '..')] } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
