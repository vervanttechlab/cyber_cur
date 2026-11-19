import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  use: { channel: 'msedge', baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 860 }, acceptDownloads: true },
  webServer: [
    // its own offline build (.env.e2e), so the trainer's real sync URL in sync.config.json is never used by tests
    { command: 'npx vite build --mode e2e --outDir dist-e2e && npx vite preview --port 4173 --strictPort --outDir dist-e2e', port: 4173, reuseExistingServer: false, timeout: 120000 },
    { command: 'node tools/sync-dev-server.mjs 4180', port: 4180, reuseExistingServer: false },
  ],
});
