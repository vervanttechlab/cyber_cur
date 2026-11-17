import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Every build gets an id (its time). The lab compares it with the published version.json to tell trainees about an update.
const BUILD = new Date().toISOString();
const versionJson = (): Plugin => ({
  name: 'ctm-version-json',
  apply: 'build',
  generateBundle() {
    const notes = JSON.parse(readFileSync(resolve(import.meta.dirname, 'src/whatsnew.json'), 'utf-8'));
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD, notes: notes.slice(0, 3) }, null, 1) });
  },
});

// Lab files are imported with ?raw straight from the curriculum day folders (one source of truth).
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [versionJson()],
  resolve: { alias: { '@curriculum': resolve(import.meta.dirname, '..') } },
  server: { fs: { allow: [resolve(import.meta.dirname, '..')] } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
