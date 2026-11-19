// The lab network: what ping / nslookup / dig / traceroute can reach. No real network access ever happens.
import type { Host } from './types';

export const LAB_DNS: Record<string, string> = {
  'dc-01.lab.local': '10.10.1.10',
  'file-01.lab.local': '10.10.1.20',
  'siem-01.lab.local': '10.10.1.50',
  'web-01.lab.local': '172.16.10.5',
  'example.com': '93.184.215.14',
  'www.example.com': '93.184.215.14',
};

export function labReachable(h: Host, ip: string): boolean {
  const same = (a: string) => a.split('.').slice(0, 3).join('.') === h.ip.split('.').slice(0, 3).join('.');
  return ip === h.gateway || ip === h.dns || ip === '127.0.0.1' || ip === h.ip || ip.startsWith('10.10.') || same(ip) || ip.startsWith('172.16.10.');
}

export function resolveName(name: string, h: Host): string | null {
  const n = name.toLowerCase().replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(n)) return n;
  if (n === h.hostname.toLowerCase()) return h.ip;
  return LAB_DNS[n] ?? LAB_DNS[n + '.lab.local'] ?? null;
}

/** Deterministic pseudo round-trip time so output looks alive but is reproducible. */
export function rtt(ip: string, i: number): number {
  let x = 7; for (const c of ip) x = (x * 31 + c.charCodeAt(0)) % 997;
  const base = ip.startsWith('10.10.20.') ? 0.4 : ip.startsWith('10.') || ip.startsWith('172.16') ? 1.2 : 18;
  return Math.round((base + ((x + i * 13) % 9) / 10) * 1000) / 1000;
}
