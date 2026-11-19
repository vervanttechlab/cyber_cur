// Copy the Day 2 demo videos into public/videos and convert their .srt captions to WebVTT for the player.
import { readdirSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const srcs = readdirSync(root).filter((d) => /^Day_\d\d_/.test(d) && existsSync(join(root, d, 'demo'))).map((d) => join(root, d, 'demo'));
const out = resolve(import.meta.dirname, '../public/videos');
mkdirSync(out, { recursive: true });
for (const src of srcs) for (const f of readdirSync(src)) {
  if (f.endsWith('.mp4')) {
    const dst = join(out, f);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(join(src, f)).mtimeMs) copyFileSync(join(src, f), dst);
  }
  if (f.endsWith('.srt')) {
    const vtt = 'WEBVTT\n\n' + readFileSync(join(src, f), 'utf-8').replace(/\r\n/g, '\n').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
    writeFileSync(join(out, f.replace(/\.srt$/, '.vtt')), vtt);
  }
}
console.log('videos ->', out, readdirSync(out).join(', '));
