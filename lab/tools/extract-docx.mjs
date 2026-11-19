// Turn the Day 3 incident narrative (.docx) into a plain-text lab file, so trainees can read it in the terminal.
// Source of truth stays the .docx in the Day folder; this runs before every dev/build.
import JSZip from 'jszip';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const src = resolve(import.meta.dirname, '../../Day_03_Threat_Landscape_and_Attack_Frameworks/assets/Incident_Narrative_Kill_Chain.docx');
const out = resolve(import.meta.dirname, '../src/hosts/generated/Incident_Narrative_Kill_Chain.txt');
const xml = await (await JSZip.loadAsync(readFileSync(src))).file('word/document.xml').async('string');
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const text = (frag) => unesc((frag.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
const body = xml.slice(xml.indexOf('<w:body>'));
const lines = [];
// walk top-level paragraphs and tables in order
const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g;
for (const m of body.matchAll(re)) {
  const block = m[0];
  if (block.startsWith('<w:tbl>')) {
    for (const row of block.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
      const cells = (row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(text).filter(Boolean).join(' ').trim());
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) continue;
      if (cells.length === 3) lines.push(`${cells[0].padEnd(4)}${cells[1].padEnd(22)}${cells[2]}`);
      else lines.push(nonEmpty.join('  '));
    }
    lines.push('');
  } else {
    const t = text(block).trim();
    if (t) lines.push(t);
  }
}
// wrap long lines at 96 columns with a hanging indent for event rows
const wrapped = lines.flatMap((l) => {
  if (l.length <= 96) return [l];
  const indent = /^\d+\s/.test(l) || /^No\./.test(l) ? ' '.repeat(26) : '';
  const words = l.split(' '); const res = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 96) { res.push(cur); cur = indent + w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) res.push(cur);
  return res;
});
mkdirSync(resolve(out, '..'), { recursive: true });
writeFileSync(out, wrapped.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
console.log('narrative ->', out);
