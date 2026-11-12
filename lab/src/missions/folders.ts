// The lab folders a mission's files live in, taken from its steps' hint commands
// (e.g. ~/demo3, ~/day9 on Ubuntu; demo9\, day6\ on Windows), so the mission header can say where to look.
import type { Mission } from './types';

export function missionFolders(m: Mission): { linux: string[]; win: string[] } {
  const linux = new Set<string>(), win = new Set<string>();
  for (const s of m.steps) {
    if (!s.try) continue;
    if (s.host?.endsWith('linux')) for (const x of s.try.matchAll(/~\/((?:demo|day)\d+)\b/g)) linux.add(`~/${x[1]}`);
    if (s.host?.endsWith('win')) for (const x of s.try.matchAll(/(?:^|[\s"'])((?:demo|day)\d+)\\/gi)) win.add(`${x[1]}\\`);
  }
  // practice missions use the demo folders first; activities their own day folders first
  const first = m.kind === 'practice' ? /demo/i : /day/i;
  const order = (a: string, b: string) => Number(!first.test(a)) - Number(!first.test(b)) || a.localeCompare(b, 'en', { numeric: true });
  return { linux: [...linux].sort(order), win: [...win].sort(order) };
}

/** One plain sentence for the mission header, or '' when the mission names no lab folder. */
export function foldersLine(m: Mission): string {
  const { linux, win } = missionFolders(m);
  const parts = [...(linux.length ? [`Ubuntu ${linux.map((d) => '`' + d + '`').join(', ')}`] : []), ...(win.length ? [`Windows ${win.map((d) => '`' + d + '`').join(', ')}`] : [])];
  if (!parts.length) return '';
  const ex = linux[0] ? `cat ${linux[0]}/<file>` : `Get-Content ${win[0]}<file>`;
  return `Files for this mission: ${parts.join(' · ')}. Type the folder with the file name, e.g. \`${ex}\`.`;
}
