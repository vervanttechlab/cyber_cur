// xterm.js terminal bound to a simulated host session: line editing, history, Tab completion, paste.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { Session } from '../shell/types';
import { run, prompt, type RunOutput } from '../shell/shell';
import { linux } from '../shell/linux';
import { windows, WIN_ALIASES } from '../shell/windows';
import { windowsExtra } from '../shell/windows2';
import { listDir, resolvePath } from '../shell/vfs';

export interface CommandEvent { line: string; out: RunOutput; session: Session }

const THEMES = {
  windows: { background: '#0C0C0C', foreground: '#CCCCCC', cursor: '#FFFFFF', selectionBackground: '#264F78', red: '#E06666', green: '#93C47D', yellow: '#F2C14E', blue: '#6FA8DC' },
  linux: { background: '#2B0A24', foreground: '#EEEEEC', cursor: '#EEEEEC', selectionBackground: '#6B4A64', red: '#EF2929', green: '#8AE234', yellow: '#FCE94F', blue: '#729FCF' },
};

export class TermView {
  readonly term: Terminal;
  private fit = new FitAddon();
  private buf = '';
  private cur = 0;
  private hIdx = -1;
  private draft = '';
  lastOutput = '';
  lastLine = '';

  constructor(readonly el: HTMLElement, readonly session: Session, private onCommand: (e: CommandEvent) => void, banner: string) {
    const win = session.host.os === 'windows';
    this.term = new Terminal({
      fontFamily: win ? 'Consolas, "Cascadia Mono", monospace' : '"Ubuntu Mono", "DejaVu Sans Mono", Consolas, monospace',
      fontSize: 14, lineHeight: 1.12, cursorBlink: true, scrollback: 5000, convertEol: true, allowProposedApi: false,
      theme: win ? THEMES.windows : THEMES.linux,
    });
    this.term.loadAddon(this.fit);
    this.term.open(el);
    this.term.onData((d) => this.onData(d));
    this.term.attachCustomKeyEventHandler((e) => {
      // Ctrl+Shift+C copies the selection; Ctrl+V pastes (handled by browser -> onData)
      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') { navigator.clipboard?.writeText(this.term.getSelection()).catch(() => {}); return false; }
      return true;
    });
    this.term.write(banner.replace(/\n/g, '\r\n'));
    this.writePrompt();
    new ResizeObserver(() => { try { this.fit.fit(); } catch { /* hidden */ } }).observe(el);
  }

  focus() { this.fit.fit(); this.term.focus(); }

  private promptText(): string {
    const p = prompt(this.session);
    if (this.session.host.os === 'windows') return p;
    const m = p.match(/^(.*?)(:)(.*?)(\$ )$/);
    return m ? `\x1b[1;32m${m[1]}\x1b[0m${m[2]}\x1b[1;34m${m[3]}\x1b[0m${m[4]}` : p;
  }
  private rowOffset = 0; // how many rows below the prompt's first row the cursor currently sits

  private writePrompt() { this.term.write(this.promptText()); this.rowOffset = 0; }

  /** Redraw prompt + input, correctly handling input that wraps over several terminal rows. */
  private redraw() {
    const cols = this.term.cols;
    const plen = prompt(this.session).length;
    let s = (this.rowOffset > 0 ? `\x1b[${this.rowOffset}A` : '') + '\r\x1b[J' + this.promptText() + this.buf;
    const end = plen + this.buf.length;
    if (end > 0 && end % cols === 0) s += ' \b'; // leave xterm's pending-wrap state at an exact row boundary
    const endRow = Math.floor(end / cols);
    const pos = plen + this.cur;
    const row = Math.floor(pos / cols), col = pos % cols;
    if (endRow > row) s += `\x1b[${endRow - row}A`;
    s += '\r' + (col > 0 ? `\x1b[${col}C` : '');
    this.term.write(s);
    this.rowOffset = row;
  }

  /** Type a command programmatically (used by "Try it" buttons): fills the line without running it. */
  typeLine(text: string) { this.buf = text; this.cur = text.length; this.redraw(); this.focus(); }

  private onData(d: string) {
    // Paste of several lines: run each line
    if (d.length > 1 && /[\r\n]/.test(d)) {
      const parts = d.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      parts.forEach((p, i) => { this.insert(p); if (i < parts.length - 1) this.enter(); });
      return;
    }
    switch (d) {
      case '\r': return this.enter();
      case '\x7f': case '\b': if (this.cur > 0) { this.buf = this.buf.slice(0, this.cur - 1) + this.buf.slice(this.cur); this.cur--; this.redraw(); } return;
      case '\x1b[3~': if (this.cur < this.buf.length) { this.buf = this.buf.slice(0, this.cur) + this.buf.slice(this.cur + 1); this.redraw(); } return;
      case '\x1b[D': if (this.cur > 0) { this.cur--; this.redraw(); } return;
      case '\x1b[C': if (this.cur < this.buf.length) { this.cur++; this.redraw(); } return;
      case '\x1b[H': case '\x01': this.cur = 0; this.redraw(); return;
      case '\x1b[F': case '\x05': this.cur = this.buf.length; this.redraw(); return;
      case '\x1b[A': return this.historyMove(-1);
      case '\x1b[B': return this.historyMove(1);
      case '\t': return this.complete();
      case '\x03': this.term.write('^C\r\n'); this.buf = ''; this.cur = 0; this.writePrompt(); return;
      case '\x0c': this.term.clear(); this.rowOffset = 0; this.redraw(); return;
      case '\x15': this.buf = this.buf.slice(this.cur); this.cur = 0; this.redraw(); return;
    }
    if (d.startsWith('\x1b')) return;
    this.insert(d.replace(/[\x00-\x1f]/g, ''));
  }

  private insert(t: string) { if (!t) return; this.buf = this.buf.slice(0, this.cur) + t + this.buf.slice(this.cur); this.cur += t.length; this.redraw(); }

  private historyMove(dir: number) {
    const h = this.session.history; if (!h.length) return;
    if (this.hIdx === -1) { if (dir > 0) return; this.draft = this.buf; this.hIdx = h.length; }
    this.hIdx = Math.min(h.length, Math.max(0, this.hIdx + dir));
    this.buf = this.hIdx === h.length ? this.draft : h[this.hIdx];
    if (this.hIdx === h.length) this.hIdx = -1;
    this.cur = this.buf.length; this.redraw();
  }

  private complete() {
    const before = this.buf.slice(0, this.cur);
    const m = before.match(/(\S*)$/)!; const word = m[1];
    const first = !before.slice(0, before.length - word.length).trim();
    let cands: string[];
    if (first && !word.includes('/') && !word.includes('\\')) {
      const names = this.session.host.os === 'windows' ? [...Object.keys(windows), ...Object.keys(windowsExtra), ...Object.keys(WIN_ALIASES)] : [...Object.keys(linux), 'sudo', 'help', 'history'];
      cands = names.filter((n) => n.toLowerCase().startsWith(word.toLowerCase()));
    } else {
      const win = this.session.host.os === 'windows';
      const sep = win ? '\\' : '/';
      const norm = win ? word.replace(/\//g, '\\') : word;
      const i = norm.lastIndexOf(sep);
      const dir = i >= 0 ? norm.slice(0, i + 1) : '';
      const base = i >= 0 ? norm.slice(i + 1) : norm;
      const ents = listDir(this.session, dir ? resolvePath(this.session, dir) : this.session.cwd) ?? [];
      cands = ents.filter((e) => (win ? e.name.toLowerCase().startsWith(base.toLowerCase()) : e.name.startsWith(base))).map((e) => dir + e.name + (e.dir ? sep : ''));
    }
    if (!cands.length) return;
    if (cands.length === 1) { const add = cands[0].slice(word.length) + (cands[0].endsWith('/') || cands[0].endsWith('\\') ? '' : ' '); this.insert(add); return; }
    let pre = cands[0]; for (const c of cands) while (!c.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1);
    if (pre.length > word.length) { this.insert(pre.slice(word.length)); return; }
    this.term.write('\r\n' + cands.map((c) => c.split(/[\\/]/).filter(Boolean).pop() + (/[\\/]$/.test(c) ? (this.session.host.os === 'windows' ? '\\' : '/') : '')).join('  ') + '\r\n');
    this.rowOffset = 0;
    this.redraw();
  }

  private enter() {
    if (this.cur !== this.buf.length) { this.cur = this.buf.length; this.redraw(); }
    const line = this.buf; this.buf = ''; this.cur = 0; this.hIdx = -1;
    this.term.write('\r\n');
    const out = run(this.session, line);
    if (out.clear) this.term.clear();
    if (out.stderr) this.term.write('\x1b[31m' + out.stderr.replace(/\n$/, '').replace(/\n/g, '\r\n') + '\x1b[0m\r\n');
    if (out.stdout) this.term.write(out.stdout.replace(/\n/g, '\r\n'));
    if (line.trim()) { this.lastLine = line.trim(); this.lastOutput = (out.stderr + out.stdout).replace(/\n+$/, ''); this.onCommand({ line: line.trim(), out, session: this.session }); }
    this.writePrompt();
  }

  dispose() { this.term.dispose(); }
}
