// Day 7 (Security Solution Status Check) end to end; also produces the screenshots on the Day 7 video end cards (e2e/shots/24-27).
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

test('Day 7: coverage, health, clean-up capability, my workstation', async ({ page, request }) => {
  test.setTimeout(150000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'rosa.day7@example.com' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'rosa.day7@example.com', name: 'Rosa Bautista', seat: 9 } });
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill('Rosa Bautista');
  await page.getByLabel('Email').fill('rosa.day7@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get(`${SYNC}/__code?email=rosa.day7@example.com`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await openDay(page, 7);

  await openMission(page, 'd7-act7.1');
  await tab(page, 'Ubuntu');
  await type(page, 'cat ~/day7/coverage_report.csv');
  await expect.poll(() => flat(page)).toContain('DEV-PC-02');
  await page.locator('[data-k="c.LOAN-PC-03.g"]').selectOption('Gap: not enrolled');
  await page.locator('[data-k="c.CORE-DB-01.g"]').selectOption('Gap: SIEM agent missing');
  await page.locator('[data-k="count"]').fill('4');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/24-day7-activity71.png' });

  await openMission(page, 'd7-act7.2');
  await tab(page, 'PowerShell');
  await type(page, String.raw`Import-Csv day7\agent_health.csv | Format-Table check_id, host, solution, version, service, realtime, last_checkin, content_date, tamper`);
  await expect.poll(() => flat(page)).toContain('H-14');
  await page.locator('[data-k="h.H-07.v"]').selectOption('Not operational');
  await page.locator('[data-k="h.H-07.f"]').selectOption('B3 Check-in');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/25-day7-activity72.png' });

  await openMission(page, 'd7-act7.3');
  await tab(page, 'PowerShell');
  await type(page, String.raw`Import-Csv day7\security_policies.csv | Format-Table`);
  await expect.poll(() => flat(page)).toContain('Detect only');
  await page.locator('[data-k="d.D7-02.c"]').selectOption('No');
  await page.locator('[data-k="d.D7-02.w"]').selectOption('C2 Exclusion');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/26-day7-activity73.png' });

  await openMission(page, 'd7-act7.4');
  await type(page, 'Get-MpPreference | Format-List HighThreatDefaultAction, SevereThreatDefaultAction, ExclusionPath');
  await expect.poll(() => flat(page)).toContain('HighThreatDefaultAction');
  await page.locator('[data-k="av"]').selectOption('Installed and operational');
  await page.locator('[data-k="report"]').selectOption('Yes');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/27-day7-activity74.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day07_Lab_Notebook_Rosa_Bautista_Seat09.doc');
});
