// Day 8 (Manual Checking and Verification) end to end; also produces the screenshots on the Day 8 video end cards (e2e/shots/28-31).
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

test('Day 8: verify detection, check action, update, scan', async ({ page, request }) => {
  test.setTimeout(150000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'rosa.day8@example.com' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'rosa.day8@example.com', name: 'Rosa Bautista', seat: 9 } });
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill('Rosa Bautista');
  await page.getByLabel('Email').fill('rosa.day8@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get(`${SYNC}/__code?email=rosa.day8@example.com`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await openDay(page, 8);

  await openMission(page, 'd8-act8.1');
  await tab(page, 'Ubuntu');
  await type(page, 'sha256sum ~/day8/samples/*');
  await expect.poll(() => flat(page)).toContain('V-05_sync.exe.sample');
  await page.locator('[data-k="v.V-03.m"]').selectOption('No');
  await page.locator('[data-k="v.V-03.v"]').selectOption('Hash mismatch');
  await page.locator('[data-k="v.V-02.v"]').selectOption('False positive');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/28-day8-activity81.png' });

  await openMission(page, 'd8-act8.2');
  await tab(page, 'PowerShell');
  await type(page, String.raw`Import-Csv day8\remediation_events.csv | Format-Table event_id, host, action, detail`);
  await expect.poll(() => flat(page)).toContain('DEV-PC-02');
  await page.locator('[data-k="a.IT-PC-01.v"]').selectOption('Not verified');
  await page.locator('[data-k="a.IT-PC-01.n"]').selectOption('Escalate to Tier 2');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/29-day8-activity82.png' });

  await openMission(page, 'd8-act8.3');
  await tab(page, 'PowerShell');
  await type(page, 'Update-MpSignature');
  await expect.poll(() => flat(page)).toContain('1.421.130.0');
  await page.locator('[data-k="before"]').fill('1.421.112.0');
  await page.locator('[data-k="after"]').fill('1.421.130.0');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/30-day8-activity83.png' });

  await openMission(page, 'd8-act8.4');
  await type(page, 'Start-MpScan -ScanType FullScan');
  await expect.poll(() => flat(page)).toContain('1 threat detected');
  await type(page, 'Get-MpThreatDetection | Format-List Resources, ActionSuccess, ThreatStatusID');
  await page.locator('[data-k="type"]').selectOption('Full scan');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(1);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/31-day8-activity84.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day08_Lab_Notebook_Rosa_Bautista_Seat09.doc');
});
