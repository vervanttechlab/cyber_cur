// Smoke test of the desktop app's update path: loads the website when reachable, else the built-in copy.
// Usage: node e2e/electron.web.mjs   (needs dist/ built; starts its own static server for the "website")
import { _electron as electron } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4199;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--outDir', 'dist'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const results = [];
async function run(label, webUrl, expectRemote) {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, CTM_WEB_URL: webUrl } });
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1500);
  const url = win.url(), title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
  const ok = expectRemote ? url.startsWith(`http://localhost:${PORT}/`) : url.startsWith('file://') && /offline copy/.test(title);
  // the lab started: either the sign-in screen, or (when this PC already has a saved session) the lab itself
  const signIn = await win.getByRole('heading', { name: 'Welcome to the CTM Virtual Lab' }).isVisible().catch(() => false) || await win.locator('#terms').isVisible().catch(() => false);
  results.push({ label, ok: ok && signIn, url: url.slice(0, 60), title });
  await app.close();
}
try {
  await run('website reachable -> website', `http://localhost:${PORT}/`, true);
  await run('website down -> built-in copy', 'http://localhost:1/', false);
  await run('no website configured -> built-in copy', '', false);
} finally { server.kill(); }
console.table(results);
process.exit(results.every((r) => r.ok) ? 0 : 1);
