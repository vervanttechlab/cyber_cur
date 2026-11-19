// Workspace: a free practice area that is NOT linked to any activity. Fresh copies of the demo hosts
// and of the trainee's own hosts; nothing typed here is logged, graded or exported.
import type { HostId, Mission, ScenarioPack } from './types';
import { DAY2 } from './day02';
import { DAY4 } from './day04';
import { PRACTICE34 } from './practice34';

const WS_OF: Record<string, HostId> = { 'demo-win': 'ws-win', 'demo-linux': 'ws-linux', 'seat-win': 'ws-seat-win', 'seat-linux': 'ws-seat-linux' };
const first = (t?: string) => (t ?? '').split('   then   ')[0];

const fromMission = (id: string, group: string, host?: HostId) => {
  const m = [...DAY2.missions, ...PRACTICE34, ...DAY4.missions].find((x) => x.id === id)!;
  const byHost = new Map<HostId, string[]>();
  for (const s of m.steps) if (s.host && s.try) { const h = host ?? WS_OF[s.host]; if (!byHost.has(h)) byHost.set(h, []); byHost.get(h)!.push(first(s.try)); }
  return [...byHost.entries()].map(([h, cmds]) => ({ group: `${group} · ${h.includes('win') ? 'Windows' : 'Ubuntu'}`, host: h, cmds }));
};

const workspace: Mission = {
  id: 'workspace', day: 0, kind: 'workspace', title: 'Workspace', subtitle: 'Free practice · not linked to any activity',
  hosts: ['ws-win', 'ws-linux', 'ws-seat-win', 'ws-seat-linux'],
  intro: 'Try any command here. These are separate copies of the demo hosts and of your own hosts: nothing you do here changes your activities, and nothing is logged, checked or exported. Use Reset to start over.',
  steps: [],
  cheats: [
    ...fromMission('d2-demo1', 'Demo 1'),
    ...fromMission('d2-demo2', 'Demo 2'),
    ...fromMission('d2-demo3', 'Demo 3'),
    { group: 'Useful anywhere · Ubuntu', host: 'ws-linux', cmds: ['help', 'ls -l ~/assets ~/day3 ~/day4', 'history', 'ping -c 4 10.10.20.1', 'nslookup dc-01.lab.local'] },
    { group: 'Useful anywhere · Windows', host: 'ws-win', cmds: ['help', 'dir', 'Get-NetTCPConnection -State Listen', 'ping 10.10.20.1', 'Get-Process | Where-Object CPU -gt 50'] },
    ...fromMission('d3-demo1', 'Day 3 Demo 1'),
    ...fromMission('d3-demo2', 'Day 3 Demo 2'),
    ...fromMission('d3-demo3', 'Day 3 Demo 3'),
    ...fromMission('d4-demo1', 'Day 4 Demo 1'),
    ...fromMission('d4-demo2', 'Day 4 Demo 2'),
    ...fromMission('d4-demo3', 'Day 4 Demo 3'),
  ],
};

export const WORKSPACE: ScenarioPack = { day: 0, title: 'Workspace · free practice (not graded)', missions: [workspace] };
