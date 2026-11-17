// The team room (side panel, "👥 Team"): one place per team for its members (online or not, and what they are working on),
// the team chat, the answers the team shares, and the trainer's announcements pinned at the top. Data comes from the sync
// server (sync/Code.gs):
//   room   -> the room; asked every 2 s while the panel is open (an unchanged room answers { same: true } with only the
//             members and who is typing), every 10 s while it is closed (badge and a toast for new messages)
//   typing -> "Ana is typing…" for the others · chatSend / chatHide -> post, or (trainer) hide a message
//   status -> every minute: chat versions (badge), the shares of my team and the days the trainer opened for sharing
// The trainer puts trainees in teams on the Teams page (#/teams) or in the Roster tab (column E).
import type { Share } from './share';

export interface OnlinePerson { name: string; seat: number; team: string; trainer: boolean; mission: string; me: boolean; ago: number }
export interface ChatVer { ver: number; last: number }
export interface StatusReply { openDays: number[]; trainer: boolean; team?: string; online?: OnlinePerson[]; chat?: Record<string, ChatVer>; shareDays?: number[]; shares?: Share[] }
export interface ChatMsg { id: number; t: number; name: string; text: string; trainer: boolean; mine: boolean }
export interface Member { name: string; seat: number; online: boolean; mission: string; me: boolean }
export interface RoomReply {
  same?: boolean; ver: string; team: string; trainer: boolean; teams?: string[]; members: Member[]; trainersOnline: number; typing: string[]; shareDays: number[];
  messages?: ChatMsg[]; pinned?: ChatMsg[]; shares?: Share[];
}
/** What the rest of the lab needs to know about my team (the worksheet's share bar). */
export interface TeamInfo { team: string; shareDays: number[]; shares: Share[] }
export interface RoomHooks { actTitle: (id: string) => string; openShare: (s: Share) => void; onShares: () => void }

type Api = <T>(action: string, body?: Record<string, unknown>) => Promise<T>;
type Tab = 'chat' | 'members' | 'shared';
export const ANNOUNCE = 'Announcements';
const OPEN_MS = 2000, CLOSED_MS = 10000, TYPING_EVERY = 3000;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const seat = (n: number) => (n ? `Seat ${String(n).padStart(2, '0')}` : '');
const first = (name: string) => name.split(' ')[0];

/** Channels with a message newer than the last one this person has seen (their own messages count as seen). */
export function unreadChannels(chat: Record<string, ChatVer> | undefined, seen: Record<string, number>): string[] {
  return Object.entries(chat ?? {}).filter(([ch, v]) => v.last > (seen[ch] ?? 0)).map(([ch]) => ch);
}
/** "Ana is typing…", "Ana and Ben are typing…", "3 people are typing…". */
export function typingText(names: string[]): string {
  if (!names.length) return '';
  if (names.length > 2) return `${names.length} people are typing…`;
  return `${names.map(first).join(' and ')} ${names.length === 1 ? 'is' : 'are'} typing…`;
}

export class Social {
  private status: StatusReply | null = null;
  private room: RoomReply | null = null;
  private tab: Tab = 'chat';
  private pick = '';               // trainer: the team whose room is open
  private announce = false;        // trainer: the next message goes to every team, pinned
  private timer: number | undefined;
  private busy = false;
  private sending = false;
  private lastTyping = 0;
  private toasted = 0;             // newest team message already shown in a toast
  private oldServer = false;       // the Sheet still runs a Code.gs from before the team room

  constructor(private api: Api, private token: () => string | undefined, private email: () => string,
    private toast: (html: string) => void, private refreshStatus: () => void, private hooks: RoomHooks) {
    document.getElementById('btn-social')!.onclick = () => (this.isOpen() ? this.close() : this.open());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule(0); });
  }

  private el() { return document.getElementById('social')!; }
  isOpen() { return !this.el().hidden; }
  private trainer() { return !!(this.room?.trainer ?? this.status?.trainer); }
  private myTeam() { return this.room?.team ?? this.status?.team ?? ''; }

  /** My team, the days open for sharing and the shares of my team (trainees). */
  info(): TeamInfo | null {
    if (!this.status || this.status.trainer || this.oldServer) return null;
    const live = this.room && !this.room.trainer ? this.room : null; // the room is newer than the minute-by-minute status
    return { team: live ? live.team : this.status.team ?? '', shareDays: live?.shareDays ?? this.status.shareDays ?? [], shares: live?.shares ?? this.status.shares ?? [] };
  }
  /** After a share or stop-sharing: the server's new list for my team. */
  setShares(list: Share[]) {
    if (this.status) this.status.shares = list;
    if (this.room && !this.room.trainer) this.room.shares = list;
    this.paint();
    this.hooks.onShares();
  }
  /** Tell the worksheet when my team, the sharing days or the shares changed. */
  private notify(before: string) {
    if (JSON.stringify(this.info()) !== before) this.hooks.onShares();
  }

  // last message id seen per channel, kept per account on this computer
  private seenKey() { return `ctm-chat-seen:${this.email()}`; }
  private seen(): Record<string, number> { try { return JSON.parse(localStorage.getItem(this.seenKey()) || '{}'); } catch { return {}; } }
  private markSeen(ch: string, id: number) {
    const s = this.seen(); if ((s[ch] ?? 0) >= id) return;
    s[ch] = id; try { localStorage.setItem(this.seenKey(), JSON.stringify(s)); } catch { /* storage blocked */ }
  }

  /** Show or hide the top-bar button (signed in online only). */
  setVisible(on: boolean) {
    const b = document.getElementById('btn-social')!;
    const was = !b.hidden;
    b.hidden = !on;
    if (!on) { this.close(); clearTimeout(this.timer); } else if (!was) this.schedule(0);
  }

  /** A status reply (every minute): team, shares, chat versions for the badge. */
  update(r: StatusReply) {
    if (!r.online) { this.oldServer = true; if (this.isOpen()) this.paintShell(); return; } // older Code.gs: no online list
    const before = JSON.stringify(this.info());
    this.status = r;
    if (!this.room || (!r.trainer && this.room.team !== (r.team ?? ''))) this.schedule(0); // first time, or moved to another team
    this.badge();
    this.notify(before);
  }

  open(tab?: Tab) {
    if (tab) this.tab = tab;
    this.el().hidden = false;
    this.paintShell();
    this.refreshStatus();
    this.schedule(0);
  }
  close() {
    this.el().hidden = true;
    this.badge();
  }

  // ------------------------------------------------------------------ polling
  /** Next room check: soon while the panel is open, slower while closed, none while the tab is hidden or signed out. */
  private schedule(ms: number) {
    clearTimeout(this.timer);
    if (!this.token() || document.getElementById('btn-social')!.hidden) return;
    this.timer = window.setTimeout(() => void this.poll(), ms);
  }
  private async poll(force = false) {
    if (this.busy && !force) return;
    if (document.visibilityState === 'hidden' || this.oldServer) return this.schedule(CLOSED_MS);
    const open = this.isOpen();
    if (!open && !this.trainer() && this.status && !this.status.team && this.room) return this.schedule(CLOSED_MS * 3); // no team: only announcements
    this.busy = true;
    try {
      const r = await this.api<RoomReply>('room', { token: this.token(), team: this.pick || undefined, ver: force || !this.room ? undefined : this.room.ver });
      this.merge(r);
    } catch (e) {
      const msg = (e as Error).message;
      if (/Unknown action/.test(msg)) { this.oldServer = true; this.paintShell(); }
      else if (open) { const box = document.getElementById('soc-msgs'); if (box && !this.room) box.innerHTML = `<p class="soc-err">${esc(msg)}</p>`; }
    } finally {
      this.busy = false;
      this.schedule(this.isOpen() ? OPEN_MS : CLOSED_MS);
    }
  }

  private merge(r: RoomReply) {
    const prev = this.room;
    const teamChanged = !prev || prev.team !== r.team;
    const before = JSON.stringify(this.info());
    this.room = r.same && prev && !teamChanged ? { ...prev, ...r, messages: prev.messages, pinned: prev.pinned, shares: prev.shares } : r;
    if (r.trainer && !this.pick) this.pick = r.team;
    const room = this.room;
    // a toast for a new team message or announcement while the chat is not on screen
    const chatOnScreen = this.isOpen() && this.tab === 'chat';
    const newest = (room.messages ?? []).filter((m) => !m.mine).pop();
    if (newest && !teamChanged && newest.id > this.toasted && newest.id > (this.seen()[room.team] ?? 0) && !chatOnScreen && prev?.messages)
      this.toast(`💬 <b>${esc(first(newest.name))}</b> in ${esc(room.team)}: ${esc(newest.text.length > 90 ? newest.text.slice(0, 90) + '…' : newest.text)}`);
    if (newest) this.toasted = Math.max(this.toasted, newest.id);
    const ann = (room.pinned ?? []).filter((m) => !m.mine).pop();
    if (ann && !room.trainer && ann.id > (this.seen()[ANNOUNCE] ?? 0) && ann.id > this.toasted) {
      this.toast(`📣 <b>Your trainer:</b> ${esc(ann.text.length > 120 ? ann.text.slice(0, 120) + '…' : ann.text)}`);
      this.toasted = Math.max(this.toasted, ann.id);
      this.markSeen(ANNOUNCE, ann.id);
    }
    if (chatOnScreen) { const last = room.messages?.[room.messages.length - 1]; if (last) this.markSeen(room.team, last.id); }
    if (this.isOpen()) { if (teamChanged) this.paintShell(); else this.paint(); }
    this.badge();
    this.notify(before);
  }

  private unread(): number {
    const r = this.room;
    if (!r) return unreadChannels(this.status?.chat, this.seen()).filter((c) => c !== ANNOUNCE).length;
    const seen = this.seen()[r.team] ?? 0;
    return (r.messages ?? []).filter((m) => !m.mine && m.id > seen).length;
  }
  private badge() {
    const b = document.getElementById('btn-social')!;
    const n = this.isOpen() && this.tab === 'chat' ? 0 : this.unread();
    b.innerHTML = `${this.trainer() ? '👥 Teams' : '👥 Team'}${n ? ` <span class="soc-badge" title="New team messages">${n > 9 ? '9+' : n}</span>` : ''}`;
    b.title = this.trainer() ? 'Team rooms: every team\'s members, chat and shared answers' : 'Your team: members, team chat and shared answers';
  }

  // ------------------------------------------------------------------ drawing
  /** The frame (head, pinned, tabs, body). Drawn when the panel opens, the tab or the team changes; the parts update in paint(). */
  private paintShell() {
    const el = this.el();
    if (!el || el.hidden) return;
    const r = this.room;
    const close = '<button class="soc-x" id="soc-x" title="Close" aria-label="Close">×</button>';
    if (this.oldServer || !r) {
      el.innerHTML = `<div class="soc-head"><b>👥 Team</b>${close}</div><p class="soc-note" style="padding:12px">${this.oldServer
        ? 'The team room is not switched on yet. Trainer: paste the new Code.gs, run setup, and deploy a new version (lab/sync/README_Sync_Setup.txt).' : 'Connecting…'}</p>`;
      document.getElementById('soc-x')!.onclick = () => this.close();
      return;
    }
    const teams = r.teams ?? [];
    const head = r.trainer
      ? `<select id="soc-team" aria-label="Team room">${teams.map((t) => `<option ${t === r.team ? 'selected' : ''}>${esc(t)}</option>`).join('')}${teams.length ? '' : '<option>No teams yet</option>'}</select>`
      : `<b>👥 ${r.team ? esc(r.team) : 'Team'}</b>`;
    el.innerHTML = `<div class="soc-head">${head}<span class="soc-count" id="soc-count"></span>${close}</div>
      <div class="soc-pin" id="soc-pin"></div>
      <div class="soc-tabs" role="tablist">${(['chat', 'members', 'shared'] as Tab[]).map((t) => `<button role="tab" data-tab="${t}" class="${this.tab === t ? 'on' : ''}" aria-selected="${this.tab === t}" id="soc-tab-${t}"></button>`).join('')}</div>
      <div class="soc-body" id="soc-body"></div>`;
    document.getElementById('soc-x')!.onclick = () => this.close();
    const sel = document.getElementById('soc-team') as HTMLSelectElement | null;
    if (sel) sel.onchange = () => { this.pick = sel.value; this.room = null; this.paintShell(); void this.poll(true); };
    el.querySelectorAll<HTMLButtonElement>('.soc-tabs button').forEach((b) => b.onclick = () => { this.tab = b.dataset.tab as Tab; this.paintShell(); });
    const body = document.getElementById('soc-body')!;
    if (this.tab === 'chat') this.chatShell(body);
    else body.innerHTML = '<div id="soc-list"></div>';
    this.paint();
  }

  /** Update the parts that change with every poll, without touching what the trainee is typing. */
  private paint() {
    const r = this.room;
    if (!r || !this.isOpen() || !document.getElementById('soc-body')) return;
    const online = r.members.filter((m) => m.online).length;
    document.getElementById('soc-count')!.textContent = r.team ? `${online} of ${r.members.length} online` : '';
    const pins = r.pinned ?? [];
    const pin = document.getElementById('soc-pin')!;
    pin.hidden = !pins.length;
    if (pins.length) {
      const last = pins[pins.length - 1];
      pin.innerHTML = `<div class="soc-pin-msg"><span class="soc-pin-i" aria-hidden="true">📣</span><div><div class="soc-meta"><b>Announcement</b> <span class="muted">${esc(last.name)} · ${hhmm(last.t)}</span>
        ${r.trainer ? `<button class="link soc-hide" data-id="${last.id}" title="Remove this announcement for everyone (it stays in the Chat tab)">Hide</button>` : ''}</div>
        <div class="soc-text">${esc(last.text).replace(/\n/g, '<br>')}</div>
        ${pins.length > 1 ? `<details><summary class="muted">${pins.length - 1} earlier</summary>${pins.slice(0, -1).reverse().map((p) => `<div class="soc-text small"><span class="muted">${hhmm(p.t)}</span> ${esc(p.text)}</div>`).join('')}</details>` : ''}</div></div>`;
      this.bindHide(pin);
    }
    const shares = (r.shares ?? []).filter((s) => !s.mine).length;
    const unread = this.unread();
    const label: Record<Tab, string> = {
      chat: `💬 Chat${unread && this.tab !== 'chat' ? ' <span class="soc-dot"></span>' : ''}`,
      members: `Members <span class="muted">${online}/${r.members.length}</span>`,
      shared: `🤝 Shared${shares ? ` <span class="muted">${shares}</span>` : ''}`,
    };
    for (const t of Object.keys(label) as Tab[]) document.getElementById(`soc-tab-${t}`)!.innerHTML = label[t];
    if (this.tab === 'chat') this.paintChat();
    else if (this.tab === 'members') this.paintMembers();
    else this.paintShared();
  }

  private noTeam(): string {
    return this.trainer() ? '<p class="soc-note">No teams yet. Make teams on the <a href="#/teams">Teams</a> page.</p>'
      : '<p class="soc-note">You are not in a team yet. Your trainer puts you in a team; it shows here within a minute.</p>';
  }

  private chatShell(body: HTMLElement) {
    const r = this.room!;
    const canPost = !!r.team || r.trainer;
    body.innerHTML = `<div class="soc-msgs" id="soc-msgs" aria-live="polite"></div>
      <div class="soc-typing" id="soc-typing" aria-live="polite"></div>
      ${canPost ? `<form class="soc-send" id="soc-send">
        ${r.trainer ? `<label class="soc-ann"><input type="checkbox" id="soc-ann" ${this.announce ? 'checked' : ''}> 📣 Announce to every team (pinned at the top)</label>` : ''}
        <div class="soc-row"><textarea id="soc-text" rows="2" maxlength="500" aria-label="Message"></textarea><button class="btn small" type="submit">Send</button></div></form>
      <p class="soc-note">Help each other, be kind, stay on the lab work. Your trainer can read every message.</p>` : ''}`;
    const form = document.getElementById('soc-send') as HTMLFormElement | null;
    if (!form) return;
    const ta = document.getElementById('soc-text') as HTMLTextAreaElement;
    const ann = document.getElementById('soc-ann') as HTMLInputElement | null;
    const ph = () => { ta.placeholder = this.announce ? 'Announcement to every team' : `Message ${r.team || 'the team'}  (Enter = send, Shift+Enter = new line)`; };
    ph();
    if (ann) ann.onchange = () => { this.announce = ann.checked; ph(); };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    ta.oninput = () => {
      if (this.announce || !ta.value.trim() || Date.now() - this.lastTyping < TYPING_EVERY) return;
      this.lastTyping = Date.now();
      void this.api('typing', { token: this.token(), team: this.pick || undefined }).catch(() => { /* only a hint */ });
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text || this.sending) return;
      this.sending = true;
      try {
        await this.api('chatSend', { token: this.token(), channel: this.announce ? ANNOUNCE : this.room!.team, text });
        ta.value = ''; this.lastTyping = 0;
        await this.poll(true);
      } catch (err) { this.toast(esc((err as Error).message)); }
      finally { this.sending = false; ta.focus(); }
    };
  }

  private paintChat() {
    const r = this.room!;
    const box = document.getElementById('soc-msgs');
    if (!box) return;
    document.getElementById('soc-typing')!.textContent = typingText(r.typing);
    if (!r.team) { box.innerHTML = this.noTeam(); return; }
    if (!r.messages) return;
    const key = `${r.team}|${r.messages.map((m) => m.id).join(',')}`;
    if (box.dataset.key === key) return; // nothing new: keep the scroll position and any selection
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = r.messages.length ? r.messages.map((m) => `<div class="soc-msg${m.mine ? ' mine' : ''}${m.trainer ? ' trainer' : ''}">
        <div class="soc-meta"><b>${esc(m.name)}</b>${m.trainer ? ' <span class="trainer-tag">TRAINER</span>' : ''} <span class="muted">${hhmm(m.t)}</span>
        ${r.trainer ? `<button class="link soc-hide" data-id="${m.id}" title="Hide this message for everyone (it stays in the Chat tab)">Hide</button>` : ''}</div>
        <div class="soc-text">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`).join('')
      : `<p class="soc-note">No messages yet. Say hello to ${esc(r.team)}! Ask for help when you are stuck, and help a teammate who is.</p>`;
    if (atBottom || !box.dataset.key) box.scrollTop = box.scrollHeight;
    box.dataset.key = key;
    this.bindHide(box);
    const last = r.messages[r.messages.length - 1];
    if (last) this.markSeen(r.team, last.id);
    this.badge();
  }

  private bindHide(root: HTMLElement) {
    root.querySelectorAll<HTMLButtonElement>('.soc-hide').forEach((b) => b.onclick = async () => {
      try { await this.api('chatHide', { token: this.token(), id: Number(b.dataset.id) }); await this.poll(true); } catch (err) { this.toast(esc((err as Error).message)); }
    });
  }

  private paintMembers() {
    const r = this.room!;
    const list = document.getElementById('soc-list')!;
    if (!r.team) { list.innerHTML = this.noTeam(); return; }
    list.innerHTML = `<ul class="soc-people">${r.members.map((p) => `<li><span class="soc-on ${p.online ? '' : 'off'}" title="${p.online ? 'Online' : 'Offline'}"></span><div><b>${esc(p.name)}</b>${p.me ? ' <span class="muted">(you)</span>' : ''} <span class="muted">· ${seat(p.seat)}</span>
        <div class="muted soc-mission">${p.online ? esc(p.mission || 'In the lab') : 'Offline'}</div></div></li>`).join('')}</ul>
      <p class="soc-note">${r.trainersOnline ? `🟢 ${r.trainersOnline === 1 ? 'A trainer is' : `${r.trainersOnline} trainers are`} online.` : 'No trainer online right now.'} Online = used the lab in the last 2–3 minutes.</p>`;
  }

  private paintShared() {
    const r = this.room!;
    const list = document.getElementById('soc-list')!;
    if (!r.team) { list.innerHTML = this.noTeam(); return; }
    const shares = (r.shares ?? []).slice().sort((a, b) => a.act.localeCompare(b.act, undefined, { numeric: true }) || Number(a.mine) - Number(b.mine) || a.seat - b.seat);
    const days = r.shareDays.length ? `Answer sharing is on for Day ${r.shareDays.length === 15 ? 'all days' : r.shareDays.join(', ')}.` : 'Answer sharing is off right now. Your trainer turns it on for a day.';
    const byAct = new Map<string, Share[]>();
    for (const s of shares) byAct.set(s.act, [...(byAct.get(s.act) ?? []), s]);
    list.innerHTML = `<p class="soc-note">${days}${r.trainer ? '' : ' To share yours: open the activity, then <b>🤝 Share my answers</b> above its worksheet.'}</p>` +
      (byAct.size ? [...byAct].map(([act, l]) => `<h4>${esc(this.hooks.actTitle(act))}</h4><ul class="soc-shares">${l.map((s) => `<li>
          <div><b>${esc(s.name)}</b>${s.mine ? ' <span class="muted">(you)</span>' : ''} <span class="muted">· ${seat(s.seat)}</span></div>
          <button class="btn small" data-share="${s.id}">${s.mine ? 'Preview' : 'View answers'}</button></li>`).join('')}</ul>`).join('')
        : `<p class="soc-note">${r.shareDays.length ? 'Nobody in the team shares answers yet.' : ''}</p>`);
    list.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((b) => b.onclick = () => {
      const s = shares.find((x) => x.id === Number(b.dataset.share));
      if (s) this.hooks.openShare(s);
    });
  }
}
