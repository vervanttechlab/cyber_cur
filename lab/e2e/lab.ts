// Navigation helpers for the e2e specs (the lab uses hash routes: #/day/N, #/m/<missionId>, #/workspace).
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SYNC = 'http://localhost:4180';

async function goHash(page: Page, hash: string) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForFunction((h) => document.body.dataset.route === h, hash);
}

/** Open a day's Activities page. */
export async function openDay(page: Page, day: number) {
  await goHash(page, `#/day/${day}`);
  await expect(page.locator('#view .daytabs')).toBeVisible();
}

/** Open a mission's work page (e.g. 'd5-act5.1', 'd2-demo1', 'workspace'); skips the "Watch first" video of an activity. */
export async function openMission(page: Page, id: string, { skipVideo = true } = {}) {
  await goHash(page, id === 'workspace' ? '#/workspace' : `#/m/${id}`);
  await expect(page.locator('#work')).toBeVisible();
  if (skipVideo && await page.locator('#watch').isVisible()) await page.getByRole('button', { name: /Skip the video/ }).click();
}

/** Mark the Day 2 activities before `id` finished (steps from e2e/fixtures/day2-complete.json, worksheet checked),
 *  then reload: activities open in order, so Activity 2.3 needs 2.1 and 2.2 finished first. */
export async function finishBefore(page: Page, id: string) {
  const fx = JSON.parse(readFileSync('e2e/fixtures/day2-complete.json', 'utf-8')) as { done: Record<string, string[]>; checked: Record<string, boolean> };
  const n = Number(id.match(/^d2-act2\.(\d)$/)![1]);
  const ids = Array.from({ length: n - 1 }, (_, i) => `2.${i + 1}`);
  await page.waitForTimeout(600); // the app writes to storage 250 ms after a change
  await page.evaluate(({ ids, fx }) => {
    const k = 'ctm-virtual-lab:v1'; const s = JSON.parse(localStorage.getItem(k)!);
    for (const a of ids) { s.done[`d2-act${a}`] = fx.done[`d2-act${a}`]; (s.checked ??= {})[`ws-${a}`] = true; }
    localStorage.setItem(k, JSON.stringify(s));
  }, { ids, fx });
  await page.reload();
  await page.waitForFunction(() => !!document.body.dataset.route);
}

/** The status bar ("3/5 steps · 2/4 answers correct · …"). */
export const statusBar = (page: Page) => page.locator('#sb-left');
/** The open mission's title. */
export const missionTitle = (page: Page) => page.locator('#mission-head h1');

/** Open the account menu and press a button in it (Switch user needs two presses: the second confirms). */
export async function menu(page: Page, name: string | RegExp, presses = 1) {
  if (!(await page.locator('#menu-dlg').isVisible())) await page.locator('#btn-menu').click();
  for (let i = 0; i < presses; i++) await page.locator('#menu-dlg').getByRole('button', { name }).click();
}

/** Sign in with an emailed code against the local sync server (tools/sync-dev-server.mjs). */
export async function signInOnline(page: Page, request: APIRequestContext, email: string, name: string) {
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await expect(page.getByLabel(/Seat number/)).toHaveCount(0); // the trainer assigns seats
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  const { code } = await (await request.get(`${SYNC}/__code?email=${email}`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
