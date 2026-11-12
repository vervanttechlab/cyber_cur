// Day 9 (Case Follow-up and Escalation) end to end; also produces the screenshots on the Day 9 video end cards (e2e/shots/32-35).
import { test, expect, type Page } from '@playwright/test';
import { openDay, openMission, statusBar, missionTitle, menu } from './lab';

const SYNC = 'http://localhost:4180';
async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const flat = async (page: Page) => (await page.locator('.term.show .xterm-rows').innerText()).replace(/\n/g, '');
const tab = (page: Page, name: string) => page.locator('#host-tabs button', { hasText: name }).click();

test('Day 9: stakeholder verification, failed actions, escalation, my workstation', async ({ page, request }) => {
  test.setTimeout(150000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'rosa.day9@example.com' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'rosa.day9@example.com', name: 'Rosa Bautista', seat: 9 } });
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill('Rosa Bautista');
  await page.getByLabel('Email').fill('rosa.day9@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get(`${SYNC}/__code?email=rosa.day9@example.com`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await openDay(page, 9);

  await openMission(page, 'd9-act9.1');
  await tab(page, 'Ubuntu');
  await type(page, 'grep -A3 "CASE C-02" ~/day9/stakeholder_replies.txt');
  await expect.poll(() => flat(page)).toContain('pop-up');
  await page.locator('[data-k="c.C-02.o"]').selectOption('Symptoms remain');
  await page.locator('[data-k="c.C-02.n"]').selectOption('Re-open and re-check the host');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/32-day9-activity91.png' });

  await openMission(page, 'd9-act9.2');
  await tab(page, 'Ubuntu');
  await type(page, 'grep -E ",(1118|1119|1002|1005|2001)," ~/day9/scan_logs.csv');
  await expect.poll(() => flat(page)).toContain('ENG-PC-11');
  await page.locator('[data-k="count"]').fill('6');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(1);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/33-day9-activity92.png' });

  await openMission(page, 'd9-act9.3');
  await tab(page, 'Ubuntu');
  await type(page, 'grep -A16 "^Check the rules" ~/day9/soc_followup_sop.txt');
  await expect.poll(() => flat(page)).toContain('IT Department Manager');
  await page.locator('[data-k="e.FIN-PC-03.r"]').selectOption('E1');
  await page.locator('[data-k="to"]').selectOption('Chief Information Security Officer (CISO)');
  await page.locator('[data-k="target"]').fill('15');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/34-day9-activity93.png' });

  await openMission(page, 'd9-act9.4');
  await type(page, String.raw`Import-Csv day9\my_scan_log.csv | Format-Table time, event_id, detail`);
  await expect.poll(() => flat(page)).toContain('Full scan finished');
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/35-day9-activity94.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day09_Lab_Notebook_Rosa_Bautista_Seat09.doc');
});
