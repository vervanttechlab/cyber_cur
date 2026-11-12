// Who is online + team chat (side panel). Data comes from the sync server (sync/Code.gs):
//   status  -> online list (trainers: everyone; trainees: their team and the trainers) + each channel's version
//   chatGet / chatSend / chatHide -> one channel's messages
// Teams are set by the trainer in the Roster tab (column E). Every message is kept in the Sheet's Chat tab.

export interface OnlinePerson { name: string; seat: number; team: string; trainer: boolean; mission: string; me: boolean; ago: number }
export interface ChatVer { ver: number; last: number }
export interface StatusReply { openDays: number[]; trainer: boolean; team?: string; online?: OnlinePerson[]; chat?: Record<string, ChatVer> }
export interface ChatMsg { id: number; t: number; name: string; text: string; trainer: boolean; mine: boolean }
interface ChatReply { same?: boolean; ver: number; canPost?: boolean; messages?: ChatMsg[] }

type Api = <T>(action: string, body?: Record<string, unknown>) => Promise<T>;
export const ANNOUNCE = 'Announcements';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

/** Channels with a message newer than the last one this person has seen (their own messages count as seen). */
export function unreadChannels(chat: Record<string, ChatVer> | undefined, seen: Record<string, number>): string[] {
  return Object.entries(chat ?? {}).filter(([ch, v]) => v.last > (seen[ch] ?? 0)).map(([ch]) => ch);
}

export class Social {
  private status: StatusReply | null = null;
  private tab: 'online' | 'chat' = 'online';
  private channel = '';
  private chat: ChatReply | null = null;
  private timer: number | undefined;
  private announced = 0;
  private sending = false;
  private oldServer = false; // the Sheet still runs a Code.gs from before the chat update

  constructor(private api: Api, private token: () => string | undefined, private email: () => string,
    private toast: (html: string) => void, private refreshStatus: () => void) {
    document.getElementById('btn-social')!.onclick = () => (this.isOpen() ? this.close() : this.open());
  }

  private el() { return document.getElementById('social')!; }
  isOpen() { return !this.el().hidden; }
  private trainer() { return !!this.status?.trainer; }

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
    b.hidden = !on;
    if (!on) this.close();
  }

  /** A new status reply (every minute, every 20 s while the panel is open). */
  update(r: StatusReply) {
    if (!r.online) { this.oldServer = true; if (this.isOpen()) this.render(); return; } // older Code.gs: no online list
    this.oldServer = false;
    this.status = r;
    const chans = Object.keys(r.chat ?? {});
    if (!chans.includes(this.channel)) this.channel = chans.find((c) => c !== ANNOUNCE) ?? chans[0] ?? '';
    const ann = r.chat?.[ANNOUNCE]?.last ?? 0;
    const seenAnn = this.seen()[ANNOUNCE] ?? 0;
    if (!r.trainer && ann > seenAnn && ann > this.announced && !(this.isOpen() && this.tab === 'chat' && this.channel === ANNOUNCE)) {
      this.announced = ann;
      this.toast('📣 New announcement from your trainer. Open <b>Team</b> &gt; <b>Chat</b> &gt; Announcements.');
    }
    this.badge();
    if (this.isOpen()) this.render();
  }

  private badge() {
    const b = document.getElementById('btn-social')!;
    const n = unreadChannels(this.status?.chat, this.seen()).filter((c) => !(this.isOpen() && this.tab === 'chat' && c === this.channel)).length;
    b.innerHTML = `${this.trainer() ? '👥 Teams' : '👥 Team'}${n ? ` <span class="soc-badge" title="New chat messages">${n}</span>` : ''}`;
    b.title = this.trainer() ? 'Who is online, and chat with every team' : 'Who in your team is online, and your team chat';
  }

  open(tab?: 'online' | 'chat') {
    if (tab) this.tab = tab;
    this.el().hidden = false;
    this.render();
    this.refreshStatus();
    this.poll();
  }
  close() {
    this.el().hidden = true;
    clearTimeout(this.timer);
    this.badge();
  }

  /** While the panel is open: chat every 5 s, the online list every 20 s. */
  private poll() {
    clearTimeout(this.timer);
    if (!this.isOpen()) return;
    let n = 0;
    const tick = async () => {
      if (!this.isOpen()) return;
      if (this.tab === 'chat') await this.loadChat();
      if (++n % 4 === 0) this.refreshStatus();
      this.timer = window.setTimeout(tick, 5000);
    };
    void tick();
  }

  private async loadChat(force = false) {
    if (!this.channel || !this.token()) return;
    const ch = this.channel;
    try {
      const r = await this.api<ChatReply>('chatGet', { token: this.token(), channel: ch, ver: force || !this.chat ? undefined : this.chat.ver });
      if (ch !== this.channel) return;
      if (!r.same) { this.chat = r; this.renderMessages(); }
      const last = this.chat?.messages?.length ? this.chat.messages[this.chat.messages.length - 1].id : 0;
      if (last) this.markSeen(ch, last);
      this.badge();
    } catch (e) {
      const box = document.getElementById('soc-msgs');
      if (box) box.innerHTML = `<p class="soc-err">${esc((e as Error).message)}</p>`;
    }
  }

  private render() {
    const s = this.status;
    const el = this.el();
    if (!s) { el.innerHTML = `<div class="soc-head"><b>Team</b><button class="soc-x" id="soc-x" title="Close">×</button></div><p class="soc-note" style="padding:12px">${this.oldServer
      ? 'Online list and chat are not switched on yet. Trainer: paste the new Code.gs, run setup, and deploy a new version (lab/sync/README_Sync_Setup.txt).' : 'Connecting…'}</p>`; document.getElementById('soc-x')!.onclick = () => this.close(); return; }
    const online = s.online ?? [];
    const unread = unreadChannels(s.chat, this.seen());
    el.innerHTML = `<div class="soc-head"><b>${s.trainer ? 'All teams' : s.team ? esc(s.team) : 'Team'}</b><button class="soc-x" id="soc-x" title="Close">×</button></div>
      <div class="soc-tabs"><button data-tab="online" class="${this.tab === 'online' ? 'on' : ''}">Online (${online.length})</button>
      <button data-tab="chat" class="${this.tab === 'chat' ? 'on' : ''}">Chat${unread.length ? ' <span class="soc-dot"></span>' : ''}</button></div>
      <div class="soc-body" id="soc-body"></div>`;
    document.getElementById('soc-x')!.onclick = () => this.close();
    el.querySelectorAll<HTMLButtonElement>('.soc-tabs button').forEach((b) => b.onclick = () => { this.tab = b.dataset.tab as 'online' | 'chat'; this.render(); this.poll(); });
    if (this.tab === 'online') this.renderOnline(); else this.renderChat();
  }

  private renderOnline() {
    const s = this.status!;
    const body = document.getElementById('soc-body')!;
    const people = s.online ?? [];
    const note = !s.trainer && !s.team ? '<p class="soc-note">You are not in a team yet. Your trainer adds your team in the Roster.</p>' : '';
    const groups = new Map<string, OnlinePerson[]>();
    for (const p of people) { const k = p.trainer ? 'Trainers' : p.team || 'No team yet'; groups.set(k, [...(groups.get(k) ?? []), p]); }
    body.innerHTML = note + (people.length ? [...groups].map(([k, list]) => `<h4>${esc(k)} <span class="muted">(${list.length})</span></h4><ul class="soc-people">${list.map((p) =>
      `<li><span class="soc-on" title="Online"></span><div><b>${esc(p.name)}</b>${p.me ? ' <span class="muted">(you)</span>' : ''}${p.seat && !p.trainer ? ` <span class="muted">· Seat ${String(p.seat).padStart(2, '0')}</span>` : ''}
        ${p.mission ? `<div class="muted soc-mission">${esc(p.mission)}</div>` : ''}</div></li>`).join('')}</ul>`).join('')
      : '<p class="soc-note">Nobody else is online right now.</p>') + '<p class="soc-note">Online = used the lab in the last 2–3 minutes.</p>';
  }

  private renderChat() {
    const s = this.status!;
    const body = document.getElementById('soc-body')!;
    // trainees: their team first, then Announcements; trainers: Announcements, then every team
    const chans = Object.keys(s.chat ?? {}).sort((x, y) => (s.trainer ? 0 : Number(x === ANNOUNCE) - Number(y === ANNOUNCE)));
    const unread = unreadChannels(s.chat, this.seen());
    const label = (c: string) => (c === ANNOUNCE ? '📣 Announcements' : s.trainer ? `💬 ${c}` : `💬 ${c} (your team)`);
    body.innerHTML = `${chans.length > 1 ? `<select id="soc-ch">${chans.map((c) => `<option value="${esc(c)}"${c === this.channel ? ' selected' : ''}>${esc(label(c))}${unread.includes(c) && c !== this.channel ? ' •' : ''}</option>`).join('')}</select>` : ''}
      ${!s.trainer && !s.team ? '<p class="soc-note">You are not in a team yet, so only Announcements are shown.</p>' : ''}
      <div class="soc-msgs" id="soc-msgs"><p class="soc-note">Loading…</p></div>
      <form class="soc-send" id="soc-send"><textarea id="soc-text" rows="2" maxlength="500" placeholder="Message ${esc(this.channel === ANNOUNCE ? 'everyone' : this.channel)}  (Enter = send, Shift+Enter = new line)"></textarea><button class="btn small" type="submit">Send</button></form>
      <p class="soc-note">Be kind and stay on the lab work. Your trainer can read every message.</p>`;
    const sel = document.getElementById('soc-ch') as HTMLSelectElement | null;
    if (sel) sel.onchange = () => { this.channel = sel.value; this.chat = null; this.renderChat(); void this.loadChat(true); };
    const form = document.getElementById('soc-send') as HTMLFormElement;
    const ta = document.getElementById('soc-text') as HTMLTextAreaElement;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text || this.sending) return;
      this.sending = true;
      try {
        await this.api('chatSend', { token: this.token(), channel: this.channel, text });
        ta.value = '';
        await this.loadChat(true);
      } catch (err) { this.toast(esc((err as Error).message)); }
      finally { this.sending = false; ta.focus(); }
    };
    if (this.chat) this.renderMessages(); else void this.loadChat(true);
  }

  private renderMessages() {
    const box = document.getElementById('soc-msgs');
    if (!box || !this.chat?.messages) return;
    const form = document.getElementById('soc-send') as HTMLFormElement | null;
    if (form) form.hidden = this.chat.canPost === false;
    const ro = this.chat.canPost === false ? '<p class="soc-note">Only your trainer posts here.</p>' : '';
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = (this.chat.messages.length ? this.chat.messages.map((m) => `<div class="soc-msg${m.mine ? ' mine' : ''}${m.trainer ? ' trainer' : ''}">
        <div class="soc-meta"><b>${esc(m.name)}</b>${m.trainer ? ' <span class="trainer-tag">TRAINER</span>' : ''} <span class="muted">${hhmm(m.t)}</span>
        ${this.trainer() ? `<button class="link soc-hide" data-id="${m.id}" title="Hide this message for everyone (it stays in the Chat tab)">Hide</button>` : ''}</div>
        <div class="soc-text">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`).join('') : '<p class="soc-note">No messages yet. Say hello to your team!</p>') + ro;
    if (atBottom || box.dataset.first !== '1') { box.scrollTop = box.scrollHeight; box.dataset.first = '1'; }
    box.querySelectorAll<HTMLButtonElement>('.soc-hide').forEach((b) => b.onclick = async () => {
      try { await this.api('chatHide', { token: this.token(), id: Number(b.dataset.id) }); await this.loadChat(true); } catch (err) { this.toast(esc((err as Error).message)); }
    });
  }
}
