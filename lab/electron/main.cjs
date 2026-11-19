// CTM Virtual Lab desktop wrapper.
// Updates without a new .exe: on start the app loads the lab from the trainer's website (electron/web.json),
// so every published update reaches every trainee. If the website cannot be reached (no internet), it loads the
// copy built into the .exe (dist/). The page has no Node access, and navigation is limited to those two places,
// so the lab stays a sealed, simulated environment.
const { app, BrowserWindow, Menu, shell, net, session } = require('electron');
const path = require('node:path');

const LOCAL = path.join(__dirname, '..', 'dist', 'index.html');
let REMOTE = '';
try { REMOTE = String(require('./web.json').url || '').trim(); } catch { /* no web.json: built-in copy only */ }
if (process.env.CTM_WEB_URL !== undefined) REMOTE = process.env.CTM_WEB_URL.trim(); // testing override
const REMOTE_ORIGIN = REMOTE ? new URL(REMOTE).origin : null;

/** Is the website reachable right now? (short timeout, so an offline start is not slow) */
async function reachable(url) {
  if (!url) return false;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
  try { const r = await net.fetch(url, { method: 'GET', cache: 'no-store', signal: ctl.signal }); return r.ok; }
  catch { return false; } finally { clearTimeout(t); }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    title: 'CTM Virtual Lab', backgroundColor: '#EEF3F9', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const allowed = (url) => url.startsWith('file://') || (REMOTE_ORIGIN && url.startsWith(REMOTE_ORIGIN + '/'));
  win.webContents.on('will-navigate', (e, url) => { if (!allowed(url)) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' }; // printable notebook view
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  const useLocal = (why) => {
    win.on('page-title-updated', (e) => e.preventDefault()); // keep the "(offline copy)" title
    win.setTitle('CTM Virtual Lab (offline copy)');
    win.loadFile(LOCAL);
    console.log('loaded built-in copy:', why);
  };
  if (await reachable(REMOTE)) {
    await session.defaultSession.clearCache().catch(() => {}); // always the newest published version
    win.webContents.once('did-fail-load', (_e, code, desc, url, isMain) => { if (isMain) useLocal(`${desc} (${url})`); });
    win.loadURL(REMOTE);
    console.log('loaded website:', REMOTE);
  } else useLocal(REMOTE ? 'website not reachable' : 'no website configured');
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Lab', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'quit' }] },
  { label: 'View', submenu: [{ role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }] },
]));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
