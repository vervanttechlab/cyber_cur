// Publish the lab website (dist/) to GitHub Pages, so every installed .exe picks up the update on its next start.
// Usage: npm run publish:web     (builds first; pushes dist/ to the repo in electron/web.json, branch main)
// Only the web build is published: no trainer answer key, no curriculum documents, no source code.
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const { repo, url } = JSON.parse(readFileSync(join(root, 'electron', 'web.json'), 'utf-8'));
const dist = join(root, 'dist');
if (!repo) throw new Error('No "repo" in electron/web.json');
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ is missing: run npm run build first');
if (existsSync(join(dist, 'trainer'))) throw new Error('dist/ must not contain trainer files');

// Upload only what changed: the site holds ~100 MB of demo videos, and re-sending them on every publish
// times out on a slow connection (HTTP 408). A partial clone (--filter=blob:none, depth 1) downloads only the
// file list of the published build; unchanged files have the same hash, so git sends only new or edited files.
const dir = mkdtempSync(join(tmpdir(), 'ctm-web-'));
const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'inherit' });
const commit = (msg) => git('-c', 'user.name=CTM Virtual Lab publisher', '-c', 'user.email=noreply@users.noreply.github.com', 'commit', '-q', '-m', msg);
try {
  // A network failure must stop the publish, never fall through to a force-pushed "first publish" (that wipes
  // the Pages history). ls-remote throws when GitHub is unreachable; it prints nothing only for an empty repo.
  const incremental = execFileSync('git', ['ls-remote', '--heads', repo, 'main'], { encoding: 'utf-8' }).trim() !== '';
  if (incremental) execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', 'main', repo, dir], { stdio: 'inherit' });
  else rmSync(dir, { recursive: true, force: true }); // first publish (empty repo)
  if (incremental) git('read-tree', 'HEAD'); // index = published file list (no file contents downloaded)
  else { mkdirSync(dir, { recursive: true }); git('init', '-q', '-b', 'main'); }
  git('config', 'core.autocrlf', 'false'); // publish the files byte for byte (LF), no line-ending conversion
  // the new site = exactly dist/ + version.json + .nojekyll (files no longer in dist/ are removed)
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true });
  cpSync(dist, dir, { recursive: true });
  const version = new Date().toISOString();
  writeFileSync(join(dir, 'version.json'), JSON.stringify({ version }, null, 1));
  writeFileSync(join(dir, '.nojekyll'), ''); // serve files as they are
  git('add', '-A');
  const changed = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: dir, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  console.log(`changed files: ${changed.length}\n  ${changed.slice(0, 20).join('\n  ')}${changed.length > 20 ? '\n  …' : ''}`);
  commit(`CTM Virtual Lab web build ${version}`);
  // --no-thin: never use published files as delta bases (their contents were not downloaded)
  git('push', '-q', '--no-thin', ...(incremental ? [] : ['--force']), repo, 'HEAD:main');
  console.log(`published ${version}\n  -> ${url}`);
} finally { rmSync(dir, { recursive: true, force: true }); }
