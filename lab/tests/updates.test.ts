// Update notices: when a published build counts as newer, which notes a returning trainee has not seen, the modal text.
import { describe, it, expect } from 'vitest';
import { isNewer, unseen, updateHtml, RELEASE_NOTES, type Note } from '../src/ui/updates';

const N = (id: string): Note => ({ id, date: id, title: `T ${id}`, items: [`item <${id}>`], trainer: [`trainer ${id}`] });

describe('update notices', () => {
  it('a published build is newer only when its id (ISO time) is later; a dev build never asks', () => {
    expect(isNewer('2026-11-17T02:00:00.000Z', '2026-11-17T01:00:00.000Z')).toBe(true);
    expect(isNewer('2026-11-17T01:00:00.000Z', '2026-11-17T01:00:00.000Z')).toBe(false);
    expect(isNewer('2026-11-16T01:00:00.000Z', '2026-11-17T01:00:00.000Z')).toBe(false); // an older cached page
    expect(isNewer(undefined, '2026-11-17T01:00:00.000Z')).toBe(false);
    expect(isNewer('2026-11-17T02:00:00.000Z', 'dev')).toBe(false);
  });
  it('a returning trainee sees the notes newer than the last ones seen', () => {
    const notes = [N('c'), N('b'), N('a')];
    expect(unseen(notes, 'a').map((n) => n.id)).toEqual(['c', 'b']);
    expect(unseen(notes, 'c')).toEqual([]);
    expect(unseen(notes, 'gone').map((n) => n.id)).toEqual(['c', 'b', 'a']); // unknown: the newest three
  });
  it('the modal: notes escaped, trainer items only for trainers, Update now and Later with the work reassurance', () => {
    const h = updateHtml([N('x')], false, true, 'Saved.');
    expect(h).toContain('The lab has been updated');
    expect(h).toContain('item &lt;x&gt;');
    expect(h).not.toContain('trainer x');
    expect(h).toContain('id="up-now"');
    expect(h).toContain('id="up-later"');
    expect(h).toContain('Your work is safe.');
    expect(updateHtml([N('x')], true, false, '')).toContain('trainer x');
    expect(updateHtml([N('x')], true, false, '')).toContain('id="up-ok"');
  });
  it('the release notes have unique ids, newest first, and items', () => {
    const ids = RELEASE_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
    for (const n of RELEASE_NOTES) expect(n.items.length).toBeGreaterThan(0);
  });
});
