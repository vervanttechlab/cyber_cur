// Lab Notebook export: a Word-compatible .doc (HTML) the trainee submits, plus a printable view (Save as PDF).
import type { LabState } from './store';
import type { Mission, Worksheet } from '../missions/types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function worksheetHtml(ws: Worksheet, vals: Record<string, string>, grades: Record<string, { ok: boolean }>): string {
  const mark = (k: string) => (grades[k] ? (grades[k].ok ? ' <span class="ok">✓</span>' : ' <span class="no">✗</span>') : '');
  const h0 = `<h3>${esc(ws.title)}</h3>`;
  let h = '';
  for (const t of ws.tables ?? []) {
    if (t.title) h += `<p class="tt">${esc(t.title)}</p>`;
    h += '<table><tr>' + (t.rows.some((r) => r.label) ? '<th></th>' : '') + t.columns.map((c) => `<th>${esc(c.label)}</th>`).join('') + '</tr>';
    for (const r of t.rows) {
      h += '<tr>' + (t.rows.some((x) => x.label) ? `<th>${esc(r.label ?? '')}</th>` : '') + t.columns.map((c) => { const k = `${t.id}.${r.id}.${c.id}`; return `<td>${esc(vals[k] ?? '')}${mark(k)}</td>`; }).join('') + '</tr>';
    }
    h += '</table>';
  }
  let f2 = '';
  for (const f of ws.fields ?? []) f2 += `<p class="q">${esc(f.label)}</p><p class="a">${esc(vals[f.id] ?? '').replace(/\n/g, '<br>') || '<em>(blank)</em>'}${mark(f.id)}</p>`;
  return h0 + (ws.fieldsFirst ? f2 + h : h + f2);
}

/** Is a logged host name the step's kind of terminal (Windows hosts are WKS-…, Linux hosts ubuntu-…)? */
const sameOs = (hostId: string | undefined, hostname: string) => !hostId || (hostId.endsWith('-win') === /^WKS/i.test(hostname));

/** One mission's steps, each with the first command that completed it (re-found in the day's command log). */
function stepsHtml(m: Mission, doneIds: string[], log: LabState['log']): string {
  const mine = log.filter((l) => l.mission === m.title);
  const rows = m.steps.map((s, i) => {
    const done = doneIds.includes(s.id);
    const hit = s.manual ? undefined : mine.find((l) => sameOs(s.host, l.host) && s.match.some((r) => r.test(l.line)));
    const cmd = hit ? `<code>${esc(hit.line)}</code><br><span class="when">${esc(hit.time)} · ${esc(hit.host)}</span>`
      : s.manual ? (done ? '<em>Marked as done</em>' : '') : done ? '<em>(command not in the saved log)</em>' : '';
    return `<tr><td>${i + 1}</td><td>${esc(s.text).replace(/`([^`]+)`/g, '<code>$1</code>')}</td><td class="${done ? 'ok' : 'no'}">${done ? '✓' : '–'}</td><td>${cmd}</td></tr>`;
  }).join('');
  return `<h3>${esc(m.title)}</h3><table class="steps"><tr><th>#</th><th>Step</th><th>Done</th><th>Command used</th></tr>${rows}</table>`;
}

export function notebookHtml(st: LabState, day: number, missions: Mission[], gradeFor: (m: Mission) => Record<string, { ok: boolean }>): string {
  const ofDay = (d?: number) => (d ?? 2) === day;
  const done = (m: Mission) => (st.done[m.id] ?? []).length;
  const rows = missions.map((m) => `<tr><td>${esc(m.title)}</td><td>${done(m)} / ${m.steps.length}</td></tr>`).join('');
  const ws = missions.filter((m) => m.worksheet).map((m) => worksheetHtml(m.worksheet!, st.ws[m.worksheet!.id] ?? {}, gradeFor(m))).join('');
  const ev = st.evidence.filter((e) => ofDay(e.day)).map((e, i) => `<h4>E${i + 1} · ${esc(e.host)} · ${esc(e.time)}</h4><p class="q">${esc(e.mission)} · <code>${esc(e.cmd)}</code></p><pre>${esc(e.text)}</pre>${e.note ? `<p class="a">${esc(e.note)}</p>` : ''}`).join('') || '<p><em>No evidence pinned.</em></p>';
  // Terminal work: every command of the day with what the terminal showed, grouped by mission (activities first)
  const dayLog = st.log.filter((l) => ofDay(l.day));
  const worked = [...missions.filter((m) => m.kind === 'activity'), ...missions.filter((m) => m.kind !== 'activity')]
    .filter((m) => m.steps.length && (done(m) || dayLog.some((l) => l.mission === m.title)));
  const steps = worked.map((m) => stepsHtml(m, st.done[m.id] ?? [], dayLog)).join('') || '<p><em>No steps done for this day yet.</em></p>';
  const order = [...missions.filter((m) => m.kind === 'activity'), ...missions.filter((m) => m.kind !== 'activity')].map((m) => m.title);
  const titles = [...order.filter((t) => dayLog.some((l) => l.mission === t)), ...[...new Set(dayLog.map((l) => l.mission))].filter((t) => !order.includes(t))];
  const log = titles.map((t) => `<h3>${esc(t)}</h3>` + dayLog.filter((l) => l.mission === t).map((l) =>
    `<p class="cmd"><span class="when">${esc(l.time)} · ${esc(l.host)}</span><br><code>${esc(l.line)}</code></p>` +
    (l.out === undefined ? '<p class="muted"><em>(output not recorded: this command was run before the lab saved outputs)</em></p>'
      : l.out ? `<pre>${esc(l.out)}</pre>` : '<p class="muted"><em>(no output)</em></p>')).join('')).join('') || '<p><em>No commands run for this day yet.</em></p>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Lab Notebook · ${esc(st.name)}</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1B2A41;margin:24px}
h1{color:#1F3864;font-size:20pt;margin:0} h2{color:#1F3864;border-bottom:1px solid #D5E0EE;padding-bottom:3px;margin-top:22px} h3{color:#2E75B6;margin-top:16px} h4{margin:12px 0 2px;color:#1F3864}
table{border-collapse:collapse;width:100%;margin:6px 0} th,td{border:1px solid #D5E0EE;padding:4px 6px;text-align:left;vertical-align:top} th{background:#EEF3F9}
pre{font-family:Consolas,monospace;font-size:9pt;background:#F6F8FB;border:1px solid #D5E0EE;padding:6px;white-space:pre-wrap}
.cmd{margin:10px 0 2px}.cmd code{font-family:Consolas,monospace;font-size:10pt;font-weight:bold;color:#1F3864}.when{color:#5B6B82;font-size:9pt}.muted{color:#5B6B82;margin:0 0 6px}
.ok{color:#548235;font-weight:bold}.no{color:#C0392B;font-weight:bold}.q{font-weight:bold;margin:8px 0 2px}.a{margin:0 0 6px}.tt{font-weight:bold;margin:8px 0 2px}.meta td{border:none;padding:1px 8px 1px 0}
.steps td:nth-child(1),.steps td:nth-child(3){width:1%;white-space:nowrap;text-align:center}.steps code{font-family:Consolas,monospace;font-size:9.5pt;color:#1F3864;word-break:break-all}
tr,pre{page-break-inside:avoid}
</style></head><body>
<p style="color:#2E75B6;font-weight:bold;margin:0">CYBER THREAT MONITORING LEVEL I · CTM VIRTUAL LAB</p>
<h1>Lab Notebook · Day ${day}</h1>
<table class="meta"><tr><td><b>Trainee</b></td><td>${esc(st.name)}</td></tr><tr><td><b>Seat</b></td><td>${String(st.seat).padStart(2, '0')}</td></tr><tr><td><b>Exported</b></td><td>${esc(new Date().toLocaleString('en-PH'))}</td></tr></table>
<h2>Progress</h2><table><tr><th>Mission</th><th>Steps done</th></tr>${rows}</table>
<h2>Steps and commands used</h2>${steps}
<h2>Worksheets</h2>${ws}
<h2>Evidence</h2>${ev}
<h2>Notes</h2><p>${esc(st.notes).replace(/\n/g, '<br>') || '<em>(none)</em>'}</p>
<h2>Terminal work (commands and output)</h2>${log}
<p style="color:#5B6B82;font-size:9pt">✓ / ✗ marks are the lab's automatic checks, a guide for practice. Your trainer makes the final competency judgement.</p>
</body></html>`;
}

export function download(name: string, html: string, type = 'application/msword') {
  const blob = new Blob(['﻿', html], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function printHtml(html: string) {
  const w = window.open('', '_blank');
  if (!w) { download('Lab_Notebook.html', html, 'text/html'); return; }
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}
