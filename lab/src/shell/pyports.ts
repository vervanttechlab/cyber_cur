// Faithful JavaScript ports of the lab's Python scripts, so `python3 <script> <file>` gives the
// same output the real script gives on the same file (verified in tests against real Python).

export interface PyScript { name: string; usage: string; run: (text: string) => string }

/** Python Counter.most_common(): sort by count desc, ties keep first-insertion order. */
function mostCommon(m: Map<string, number>): [string, number][] {
  return [...m.entries()].map((e, i) => [e, i] as const).sort((a, b) => b[0][1] - a[0][1] || a[1] - b[1]).map((x) => x[0]);
}

const pyLines = (t: string) => t.split(/(?<=\n)/).filter((l) => l !== '');

export const LOG_COUNTER: PyScript = {
  name: 'log_counter.py',
  usage: 'Usage: python3 log_counter.py <access_log_file>',
  run(text) {
    const req = new Map<string, number>();
    const st = new Map<string, Map<string, number>>();
    for (const line of pyLines(text)) {
      const parts = line.split('"');
      if (parts.length < 3) continue;
      const ip = line.trim().split(/\s+/)[0];
      const status = parts[2].trim().split(/\s+/)[0];
      req.set(ip, (req.get(ip) ?? 0) + 1);
      if (!st.has(ip)) st.set(ip, new Map());
      const m = st.get(ip)!; m.set(status, (m.get(status) ?? 0) + 1);
    }
    const out = [`${'IP ADDRESS'.padEnd(18)}${'REQUESTS'.padStart(9)}   STATUS CODES`];
    for (const [ip, count] of mostCommon(req)) {
      const codes = [...st.get(ip)!.entries()].map(([c, n]) => `${c} x${n}`).join(', ');
      out.push(`${ip.padEnd(18)}${String(count).padStart(9)}   ${codes}`);
    }
    return out.join('\n') + '\n';
  },
};

export const FAILED_LOGIN_COUNTER: PyScript = {
  name: 'failed_login_counter.py',
  usage: 'Usage: python3 failed_login_counter.py <auth_log_file>',
  run(text) {
    const failed = new Map<string, number>();
    for (const line of pyLines(text)) {
      if (!line.includes('Failed password')) continue;
      const ip = line.split(' from ')[1].trim().split(/\s+/)[0];
      failed.set(ip, (failed.get(ip) ?? 0) + 1);
    }
    const out = [`${'SOURCE IP'.padEnd(18)}FAILED LOGINS`];
    for (const [ip, n] of mostCommon(failed)) out.push(`${ip.padEnd(18)}${n}`);
    return out.join('\n') + '\n';
  },
};

export const SCRIPTS: PyScript[] = [LOG_COUNTER, FAILED_LOGIN_COUNTER];
