// Build the lab's Lesson pages from each day's Student Handout (.docx), and copy the day's student PDFs for the Files tab.
// Source of truth stays the .docx / .pdf in the Day folders; this runs before every dev/build (package.json pre-scripts).
//   src/lessons/dayNN.json  { day, title, unit, parts: [{ h, html, videos }], files: [{ name, href, size }] }
//   public/days/DayNN_Student_Handout.pdf, DayNN_Student_Activities.pdf
// Only student documents are read or copied (never trainer files).
import JSZip from 'jszip';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const outDir = resolve(import.meta.dirname, '../src/lessons');
const pdfDir = resolve(import.meta.dirname, '../public/days');
mkdirSync(outDir, { recursive: true });
mkdirSync(pdfDir, { recursive: true });

// Which handout part each demo video belongs to (heading starts with the given text). Demo files: DayNN_DemoK_*.mp4
const VIDEO_PART = {
  2: { 1: '2. Operating Systems', 2: '4. Web Server', 3: '5. Scripting' },
  3: { 1: '1. Malicious Software', 2: '3. The Cyber Kill Chain', 3: '5. Indicators' },
  4: { 1: '4. Severity', 2: '2. Log and Detection', 3: '3. Security Solution Management', 4: '1. Layers of Defense' },
  5: { 1: '2. Receiving Detection Alerts', 2: '3. Receiving Incident Reports', 3: '4. Red Flag' },
  6: { 1: '2. The Pre-identified Criteria', 2: '3. Asset Tiers', 3: '4. Issuing the Ticket' },
  7: { 1: '2. Is It Installed', 2: '3. Is It Operational', 3: '4. Can It Clean' },
  8: { 1: '2. Check the Detection', 2: '3. Check the Action', 3: '4. Check and Patch' },
  9: { 1: '2. Verify the Results', 2: '3. Check the Scan Logs', 3: '4. Escalate' },
};

const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (frag) => unesc((frag.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
/** A paragraph's runs as HTML (bold and italic kept). */
function runs(p) {
  let h = '';
  for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const t = (r.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? []).map((x) => (x === '<w:tab/>' ? ' ' : x === '<w:br/>' ? '<br>' : esc(unesc(x.replace(/<[^>]+>/g, ''))))).join('');
    if (!t) continue;
    const b = /<w:b\/>|<w:b w:val="(1|true)"\/>/.test(r), i = /<w:i\/>|<w:i w:val="(1|true)"\/>/.test(r);
    h += b && i ? `<b><i>${t}</i></b>` : b ? `<b>${t}</b>` : i ? `<i>${t}</i>` : t;
  }
  return h.replace(/<\/b><b>/g, '').replace(/<\/i><i>/g, '');
}
const style = (p) => (p.match(/<w:pStyle w:val="([^"]+)"/) ?? [])[1] ?? '';

async function lesson(dayDir, day) {
  const files = readdirSync(join(root, dayDir));
  const handout = files.find((f) => /^Day\d\d_Student_Handout\.docx$/.test(f));
  if (!handout) return null;
  const zip = await JSZip.loadAsync(readFileSync(join(root, dayDir, handout)));
  const xml = await zip.file('word/document.xml').async('string');
  const numbering = (await zip.file('word/numbering.xml')?.async('string')) ?? '';
  // numId -> 'ul' | 'ol' (format of list level 0)
  const absFmt = {};
  for (const a of numbering.match(/<w:abstractNum [\s\S]*?<\/w:abstractNum>/g) ?? []) {
    const id = (a.match(/w:abstractNumId="(\d+)"/) ?? [])[1];
    const fmt = (a.match(/<w:lvl w:ilvl="0"[\s\S]*?<w:numFmt w:val="([^"]+)"/) ?? [])[1];
    absFmt[id] = fmt === 'bullet' ? 'ul' : 'ol';
  }
  const listOf = {};
  for (const n of numbering.match(/<w:num w:numId="\d+"[\s\S]*?<\/w:num>/g) ?? []) listOf[(n.match(/w:numId="(\d+)"/) ?? [])[1]] = absFmt[(n.match(/w:abstractNumId w:val="(\d+)"/) ?? [])[1]] ?? 'ul';

  const body = xml.slice(xml.indexOf('<w:body>'));
  const blocks = [...body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  const first = blocks.findIndex((b) => b.startsWith('<w:p') && /^Heading1$/.test(style(b)));
  const header = blocks.slice(0, first).map((b) => (b.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(plain).filter(Boolean).join(' | ')).join(' | ');
  const unit = (header.match(/Unit of Competency \| ([^|]+)/) ?? header.match(/(CS-ICT\d+ [^|]+)/) ?? [])[1]?.trim() ?? '';
  const title = (header.match(/STUDENT HANDOUT \| ([^|]+)/) ?? [])[1]?.trim() ?? '';
  const parts = [];
  let cur = null, list = null;
  const close = () => { if (list) { cur.html += `</${list}>`; list = null; } };
  for (const b of blocks.slice(first)) {
    if (b.startsWith('<w:tbl>')) {
      if (!cur) continue;
      close();
      const rows = (b.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((r) => (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runs).filter(Boolean).join('<br>')));
      if (rows.length === 1 && rows[0].length === 1) { cur.html += `<div class="box">${rows[0][0]}</div>`; continue; } // a one-cell callout box
      cur.html += '<table>' + rows.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('') + '</table>';
      continue;
    }
    const s = style(b), html = runs(b);
    if (s === 'Heading1') { if (cur) close(); cur = { h: plain(b).trim(), html: '', videos: [] }; parts.push(cur); continue; }
    if (!cur || !html.trim()) continue;
    const num = (b.match(/<w:numId w:val="(\d+)"/) ?? [])[1];
    if (num && num !== '0') {
      const kind = listOf[num] ?? 'ul';
      if (list !== kind) { close(); cur.html += `<${kind}>`; list = kind; }
      cur.html += `<li>${html}</li>`;
      continue;
    }
    close();
    cur.html += /^Heading[2-9]$/.test(s) ? `<h3>${html}</h3>` : `<p>${html}</p>`;
  }
  if (cur) close();
  // demo videos on their parts
  const dd = String(day).padStart(2, '0');
  for (const [k, head] of Object.entries(VIDEO_PART[day] ?? {})) {
    const demoDir = join(root, dayDir, 'demo');
    const file = existsSync(demoDir) ? readdirSync(demoDir).find((f) => f.startsWith(`Day${dd}_Demo${k}_`) && f.endsWith('.mp4')) : null;
    const part = parts.find((p) => p.h.startsWith(head));
    if (!file) throw new Error(`Day ${day}: no demo video ${k}`);
    if (!part) throw new Error(`Day ${day}: no handout part starting "${head}" for Demo ${k}`);
    part.videos.push(file);
  }
  // the student PDFs for the Files tab
  const pdfs = [];
  for (const [f, name] of [[`Day${dd}_Student_Handout.pdf`, 'Student Handout'], [`Day${dd}_Student_Activities.pdf`, 'Student Activities']]) {
    const src = join(root, dayDir, f);
    if (!existsSync(src)) continue;
    const dst = join(pdfDir, f);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) copyFileSync(src, dst);
    pdfs.push({ name: `Day ${day} ${name}`, href: `days/${f}`, size: `${Math.max(1, Math.round(statSync(src).size / 1024))} KB` });
  }
  return { day, title, unit, parts, files: pdfs };
}

const done = [];
for (const d of readdirSync(root).filter((x) => /^Day_\d\d_/.test(x)).sort()) {
  const day = Number(d.slice(4, 6));
  if (day < 2) continue;
  const L = await lesson(d, day);
  if (!L) continue;
  writeFileSync(join(outDir, `day${String(day).padStart(2, '0')}.json`), JSON.stringify(L, null, 1) + '\n');
  done.push(`Day ${day}: ${L.parts.length} parts`);
}
console.log('lessons ->', outDir, done.join(', '));
