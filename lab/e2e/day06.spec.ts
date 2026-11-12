// Day 6 (Alert Triage and Ticketing) end to end; also produces the screenshots on the Day 6 video end cards (e2e/shots/20-23).
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

test('Day 6: assess, borderline, ticket, my own alerts', async ({ page, request }) => {
  test.setTimeout(150000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'rosa.day6@example.com' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'rosa.day6@example.com', name: 'Rosa Bautista', seat: 9 } });
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill('Rosa Bautista');
  await page.getByLabel('Email').fill('rosa.day6@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get(`${SYNC}/__code?email=rosa.day6@example.com`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await openDay(page, 6);
  await openMission(page, 'd6-demo1');
  await expect(missionTitle(page)).toContainText('Practice: Demo 1');

  await openMission(page, 'd6-act6.1');
  await tab(page, 'PowerShell');
  await type(page, String.raw`Import-Csv day6\alert_details.csv | Format-Table alert_id, affected_asset, result`);
  await expect.poll(() => flat(page)).toContain('Q-5013');
  await page.locator('[data-k="a.Q-5005.disp"]').selectOption('Confirmed');
  await page.locator('[data-k="a.Q-5005.prio"]').selectOption('P1');
  await page.locator('[data-k="a.Q-5012.disp"]').selectOption('Routine');
  await page.locator('[data-k="count"]').fill('4');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(4);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/20-day6-activity61.png' });

  await openMission(page, 'd6-act6.2');
  await tab(page, 'Ubuntu');
  await type(page, 'cat ~/day6/change_calendar.txt');
  await expect.poll(() => flat(page)).toContain('CHG-2209');
  await page.locator('[data-k="b.B-01.v"]').selectOption('Routine');
  await page.locator('[data-k="b.B-03.v"]').selectOption('False positive');
  await page.locator('[data-k="b.B-04.v"]').selectOption('Confirmed');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/21-day6-activity62.png' });

  await openMission(page, 'd6-act6.3');
  await tab(page, 'Ubuntu');
  await type(page, 'grep FIN-PC-03 ~/day6/alert_details.csv');
  await expect.poll(() => flat(page)).toContain('svcupd.exe');
  await page.locator('[data-k="title"]').fill('Ransomware activity on FIN-PC-03');
  await page.locator('[data-k="linked"]').fill('Q-5005, Q-5011, IR-01');
  await page.locator('[data-k="prio"]').selectOption('P1');
  await page.locator('[data-k="assign"]').selectOption('Shift Lead');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(4);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/22-day6-activity63.png' });

  await openMission(page, 'd6-act6.4');
  await type(page, String.raw`Import-Csv day6\my_alerts.csv | Format-List alert_id, time, rule_name, details`);
  await expect.poll(() => flat(page)).toContain('W-09-5');
  await page.locator('[data-k="count"]').fill('1');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(1);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/23-day6-activity64.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day06_Lab_Notebook_Rosa_Bautista_Seat09.doc');
});
