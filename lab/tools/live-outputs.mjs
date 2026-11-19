// Replay the live-demo commands in the lab engine (Workspace demo hosts) and record the exact output,
// so the printed Live Demo Script shows what the trainer's screen will really show.
// Usage: node tools/live-outputs.mjs <in.json> <out.json>
//   in.json: { "demos": [ [ { "host": "win"|"linux", "cmd": "..." }, ... ], ... ] }
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [, , inFile, outFile] = process.argv;
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { newSession, run } = await server.ssrLoadModule('/src/shell/shell.ts');
const { demoWindows, demoLinux } = await server.ssrLoadModule('/src/hosts/hosts.ts');
await server.close();

const input = JSON.parse(readFileSync(inFile, 'utf-8'));
const out = input.demos.map((steps) => {
  const sessions = { win: newSession(demoWindows()), linux: newSession(demoLinux()) };
  return steps.map(({ host, cmd }) => { const r = run(sessions[host], cmd); return (r.stderr + r.stdout).replace(/\x1b\[[0-9;]*m/g, ''); });
});
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('live outputs ->', outFile);
