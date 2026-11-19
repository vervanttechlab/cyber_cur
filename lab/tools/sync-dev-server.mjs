// Local stand-in for the Apps Script web app: runs the real sync/Code.gs on in-memory fake Google services.
// Usage: node tools/sync-dev-server.mjs [port]      then open the lab with ?sync=http://localhost:4180/exec
// GET /__code?email=...  returns the last emailed code (testing only; the real app emails it).
// POST /__roster {email,name,seat,team?} adds a Roster row; POST /__setting {name,value} changes a setting.
import http from 'node:http';
import { resolve } from 'node:path';
import { loadGas } from '../sync/gas-fake.mjs';

const port = Number(process.argv[2] || 4180);
const g = loadGas(resolve(import.meta.dirname, '../sync/Code.gs'));
g.ctx.setup();
const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/__code') { res.writeHead(200, cors); return res.end(JSON.stringify({ code: g.lastCode(url.searchParams.get('email') || '') })); }
  if (req.method === 'GET' && url.pathname === '/__progress') { res.writeHead(200, cors); return res.end(JSON.stringify(g.ss.getSheetByName('Progress').rows)); }
  if (req.method === 'POST' && url.pathname === '/__setting') { let b = ''; req.on('data', (c) => (b += c)); return req.on('end', () => { const { name, value } = JSON.parse(b); g.setSetting(name, value); res.writeHead(200, cors); res.end('{}'); }); }
  if (req.method === 'POST' && url.pathname === '/__roster') { let b = ''; req.on('data', (c) => (b += c)); return req.on('end', () => { const { email, name, seat, team } = JSON.parse(b); g.ss.getSheetByName('Roster').appendRow([email, name, seat, 'YES', team ?? '']); res.writeHead(200, cors); res.end('{}'); }); }
  if (req.method === 'GET') { res.writeHead(200, cors); return res.end(g.ctx.doGet().content); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { res.writeHead(200, cors); res.end(JSON.stringify(g.post(JSON.parse(body || '{}')))); });
}).listen(port, () => console.log(`CTM sync dev server on http://localhost:${port}/exec`));
