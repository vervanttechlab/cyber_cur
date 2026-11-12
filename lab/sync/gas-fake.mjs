// In-memory fake of the Google Apps Script services used by sync/Code.gs, so the real Code.gs can be
// unit-tested and run as a local development server (tools/sync-dev-server.mjs). Not used in production.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = this.sheet.rows[this.r - 1 + i] ?? []; out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] ?? '')); }
    return out;
  }
  getFormulas() {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sheet.formulas.get(`${this.r + i},${this.c + j}`) ?? ''));
  }
  setValues(v) {
    // Like Google Sheets: a leading apostrophe forces plain text and is dropped; text that starts with = + or -
    // (and is not a number) becomes a formula, which shows an error for anything that is not a real formula.
    v.forEach((row, i) => { const t = (this.sheet.rows[this.r - 1 + i] ??= []); row.forEach((x, j) => {
      const key = `${this.r + i},${this.c + j}`;
      this.sheet.formulas.delete(key);
      if (typeof x === 'string' && x.startsWith("'")) x = x.slice(1);
      else if (typeof x === 'string' && /^[=+-]/.test(x) && x.length > 1 && isNaN(Number(x))) { this.sheet.formulas.set(key, x.startsWith('=') ? x : '=' + x); x = '#ERROR!'; }
      t[this.c - 1 + j] = x;
    }); });
    for (let i = 0; i < this.sheet.rows.length; i++) this.sheet.rows[i] ??= [];
    return this;
  }
  setNumberFormat() { return this; } setFontWeight() { return this; } setFontColor() { return this; } setBackground() { return this; } setWrap() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.formulas = new Map(); this.hidden = false; }
  getName() { return this.name; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getLastRow() { for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] ?? []).some((x) => x !== '' && x !== undefined)) return i + 1; return 0; }
  getLastColumn() { return Math.max(0, ...this.rows.map((r) => (r ?? []).length)); }
  appendRow(row) { this.rows.splice(this.getLastRow(), 0, [...row]); return this; }
  deleteRow(n) { this.rows.splice(n - 1, 1); }
  setFrozenRows() {} hideSheet() { this.hidden = true; }
}
class Spreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(n) { return this.sheets.get(n) ?? null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.set(n, s); return s; }
  getId() { return 'FAKE_SHEET_ID'; } getUrl() { return 'https://docs.google.com/spreadsheets/d/FAKE_SHEET_ID'; }
}

/** Load Code.gs into a fresh sandbox. Returns the script globals plus handles to the fake world. */
export function loadGas(codePath, { owner = 'trainer@example.com' } = {}) {
  const ss = new Spreadsheet();
  const props = new Map(); const cache = new Map(); const outbox = [];
  const ctx = {
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    MailApp: { sendEmail: (o) => outbox.push(o) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => !ctx.__busy, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }) },
    Utilities: { getUuid: () => randomUUID() },
    Session: { getActiveUser: () => ({ getEmail: () => owner }), getEffectiveUser: () => ({ getEmail: () => owner }) },
    Logger: { log: () => {} },
    Date, JSON, Math, Number, String, Object, Array,
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(codePath, 'utf-8'), ctx, { filename: 'Code.gs' });
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).content);
  const lastCode = (email) => { const m = [...outbox].reverse().find((o) => o.to === String(email).toLowerCase()); return m ? m.subject.match(/(\d{6})/)[1] : null; };
  return { ctx, ss, outbox, post, lastCode, setSetting(name, value) { const sh = ss.getSheetByName('Settings'); const i = sh.rows.findIndex((r) => r[0] === name); sh.rows[i][1] = value; } };
}
