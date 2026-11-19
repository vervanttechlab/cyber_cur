// Update notices. Every build has an id (__BUILD__, set by vite.config.ts), and the build writes version.json with that id and
// the newest release notes (src/whatsnew.json). The open lab checks version.json every minute and when the tab is used
// again; when a newer build is published it shows a modal with what is new:
//   Update now = save the work online, then reload (answers, steps, evidence and notes are kept; terminals start fresh)
//   Later      = keep working; a "🆕 Update ready" button stays in the title bar, and the modal comes back after 30 minutes
// A trainee who was not online when an update came out sees "What's new" once, the next time the lab starts.
import NOTES from '../whatsnew.json';

declare const __BUILD__: string;
export interface Note { id: string; date: string; title: string; items: string[]; trainer?: string[] }
export interface VersionInfo { version: string; notes?: Note[] }

export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
export const RELEASE_NOTES: Note[] = NOTES as Note[];
const CHECK_MS = 60000, LATER_MS = 30 * 60000, SEEN = 'ctm-notes-seen', JUST = 'ctm-just-updated';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const get = (k: string, store: Storage = localStorage) => { try { return store.getItem(k); } catch { return null; } };
const set = (k: string, v: string, store: Storage = localStorage) => { try { store.setItem(k, v); } catch { /* storage blocked */ } };

/** A published build newer than the one running (ISO times compare as text). */
export const isNewer = (remote: string | undefined, local: string) => !!remote && local !== 'dev' && remote > local;

/** Notes the trainee has not seen yet (newest first), or [] when the last seen id is the newest. */
export function unseen(notes: Note[], seenId: string | null): Note[] {
  const i = notes.findIndex((n) => n.id === seenId);
  return i < 0 ? notes.slice(0, 3) : notes.slice(0, i);
}

export function notesHtml(notes: Note[], trainer: boolean): string {
  return notes.map((n) => `<section class="up-note"><div class="kicker">${esc(n.date)}</div><h3>${esc(n.title)}</h3>
    <ul>${n.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${trainer && n.trainer?.length ? `<div class="label">For trainers</div><ul>${n.trainer.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`).join('');
}

/** The "lab has been updated" modal (or "What's new" when update = false). */
export function updateHtml(notes: Note[], trainer: boolean, update: boolean, saved: string): string {
  return `<div class="dhead"><div><div class="kicker">${update ? 'CTM Virtual Lab · new version' : 'CTM Virtual Lab'}</div>
      <h2>${update ? '🆕 The lab has been updated' : '🆕 What\'s new in the lab'}</h2></div></div>
    <div class="dbody up-body">
      ${notes.length ? notesHtml(notes, trainer) : '<p>Fixes and improvements.</p>'}
      ${update ? `<p class="note info"><b>Your work is safe.</b> ${esc(saved)} Updating reloads the lab: your answers, steps, evidence and notes stay; the terminal screens start fresh.
        Finish the command you are typing first, or press <b>Later</b> and update when you are ready.</p>
      <div class="btnrow"><button class="btn primary" id="up-now">Update now</button><button class="btn quiet" id="up-later">Later</button></div>`
      : '<div class="btnrow"><button class="btn primary" id="up-ok">OK</button></div>'}
    </div>`;
}

export class Updates {
  private remote: VersionInfo | null = null;
  private laterUntil = 0;
  private timer: number | undefined;

  constructor(private hooks: { busy: () => boolean; trainer: () => boolean; flush: () => Promise<boolean>; savedText: () => string; toast: (html: string) => void; returning: () => boolean }) {}

  start() {
    // after "Update now": say it worked
    if (get(JUST, sessionStorage) === BUILD) { try { sessionStorage.removeItem(JUST); } catch { /* */ } setTimeout(() => this.hooks.toast('✓ The lab is updated. Your work is all here.'), 800); }
    window.setInterval(() => void this.check(), CHECK_MS);
    window.addEventListener('focus', () => void this.check());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void this.check(); });
    document.getElementById('btn-update')!.onclick = () => this.show(true);
    void this.check();
    this.whatsNewOnStart();
  }

  /** Ask the site for the published version. */
  async check() {
    if (document.visibilityState === 'hidden') return;
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as VersionInfo;
      if (!isNewer(j.version, BUILD)) return;
      this.remote = j;
      document.getElementById('btn-update')!.hidden = false;
      this.show(false);
    } catch { /* offline, or a copy without version.json */ }
  }

  /** The update modal: now (the button) or when nothing else is open and "Later" has run out. */
  show(asked: boolean) {
    if (!this.remote) return;
    const dlg = document.getElementById('update-dlg') as HTMLDialogElement;
    if (dlg.open) return;
    if (!asked && (Date.now() < this.laterUntil || this.hooks.busy())) {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.show(false), Math.max(5000, this.laterUntil - Date.now())); // try again when free
      return;
    }
    dlg.innerHTML = updateHtml(this.remote.notes ?? [], this.hooks.trainer(), true, this.hooks.savedText());
    dlg.showModal();
    (document.getElementById('up-later') as HTMLButtonElement).onclick = () => { this.laterUntil = Date.now() + LATER_MS; dlg.close(); };
    dlg.addEventListener('cancel', () => { this.laterUntil = Date.now() + LATER_MS; }, { once: true }); // Esc = Later
    (document.getElementById('up-now') as HTMLButtonElement).onclick = async () => {
      const b = document.getElementById('up-now') as HTMLButtonElement;
      b.disabled = true; b.textContent = 'Saving your work…';
      const ok = await this.hooks.flush().catch(() => false);
      if (!ok) b.textContent = 'Saved on this computer · updating…'; // the online copy catches up after the reload
      const top = this.remote?.notes?.[0]?.id;
      if (top) set(SEEN, top);
      set(JUST, this.remote!.version, sessionStorage);
      location.reload();
    };
  }

  /** A returning trainee who missed an update sees the notes once; a new trainee does not (everything is new to them). */
  private whatsNewOnStart() {
    const top = RELEASE_NOTES[0]?.id;
    if (!top) return;
    const seen = get(SEEN);
    if (seen === top) return;
    if (!seen && !this.hooks.returning()) { set(SEEN, top); return; }
    const notes = unseen(RELEASE_NOTES, seen);
    const tryShow = () => {
      if (this.hooks.busy() || (document.getElementById('update-dlg') as HTMLDialogElement).open) return void window.setTimeout(tryShow, 3000);
      set(SEEN, top);
      this.whatsNew(notes);
    };
    window.setTimeout(tryShow, 1500);
  }

  /** "What's new" (the menu, or once after an update). */
  whatsNew(notes: Note[] = RELEASE_NOTES.slice(0, 5)) {
    const dlg = document.getElementById('update-dlg') as HTMLDialogElement;
    dlg.innerHTML = updateHtml(notes, this.hooks.trainer(), false, '');
    if (!dlg.open) dlg.showModal();
    (document.getElementById('up-ok') as HTMLButtonElement).onclick = () => dlg.close();
  }
}
