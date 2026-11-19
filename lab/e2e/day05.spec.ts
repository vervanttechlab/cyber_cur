// Day 5 (Checking for Alerts) end to end: practice, the four activities, export. Also produces the lab
// screenshots used on the "your turn" cards of the Day 5 demo videos (e2e/shots/16-19).
import { test, expect, type Page } from '@playwright/test';
import { openDay, openMission, statusBar, missionTitle, menu } from './lab';

const SYNC = 'http://localhost:4180';
async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const screen = (page: Page) => page.locator('.term.show .xterm-rows').innerText();
const tab = (page: Page, name: string) => page.locator('#host-tabs button', { hasText: name }).click();

test('Day 5: receive alerts, intake reports, red flags, my workstation', async ({ page, request }) => {
  test.setTimeout(150000); // four 5-second waits so the toasts are gone before each screenshot
  // a trainer account (sees every day) on seat 9, which is a ransomware seat for Activity 5.4
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'rosa.day5@example.com' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'rosa.day5@example.com', name: 'Rosa Bautista', seat: 9 } });
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill('Rosa Bautista');
  await page.getByLabel('Email').fill('rosa.day5@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get(`${SYNC}/__code?email=rosa.day5@example.com`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#who')).toContainText('Seat 09');

  await openDay(page, 5);
  await openMission(page, 'd5-demo1');
  await expect(missionTitle(page)).toContainText('Practice: Demo 1');
  await type(page, String.raw`Import-Csv demo5\demo_alert_queue.csv | Where-Object status -eq New | Format-Table alert_id, received, severity, rule_name`);
  await expect.poll(() => screen(page)).toContain('D5-04');
  await expect(statusBar(page)).toContainText('1/4 steps');

  // 5.1: the queue on Windows, then the worksheet
  await openMission(page, 'd5-act5.1');
  await type(page, String.raw`Import-Csv day5\alert_queue.csv | Where-Object status -eq New | Format-Table alert_id, received, severity, host, rule_name`);
  await expect.poll(() => screen(page)).toContain('Q-5011');
  await page.locator('[data-k="newCount"]').fill('8');
  await page.locator('[data-k="late"]').fill('Q-5005');
  await page.locator('[data-k="q.Q-5006.min"]').fill('56');
  await page.locator('[data-k="q.Q-5006.sla"]').selectOption('No - breach');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(4);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/16-day5-activity51.png' });

  // 5.2: reports on Linux
  await openMission(page, 'd5-act5.2');
  await type(page, 'grep -E "^(=== REPORT|CHANNEL)" ~/day5/incident_reports.txt');
  await expect.poll(() => screen(page)).toContain('Video conference');
  await page.locator('[data-k="r.IR-04.ch"]').selectOption('SMS');
  await page.locator('[data-k="r.IR-04.type"]').selectOption('Social engineering attempt');
  await page.locator('[data-k="r.IR-04.next"]').selectOption('Do not comply; verify by callback and report');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/17-day5-activity52.png' });

  // 5.3: EDR events on Linux
  await openMission(page, 'd5-act5.3');
  await type(page, 'cut -d, -f2,5 ~/day5/edr_file_events.csv | sort | uniq -c');
  await expect.poll(() => screen(page)).toContain('24 FIN-PC-03,Rename');
  await page.locator('[data-k="h.FIN-PC-03.v"]').selectOption('Ransomware red flag');
  await page.locator('[data-k="h.FS-02.v"]').selectOption('No red flag (approved software)');
  await page.locator('[data-k="renamed"]').fill('24');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(3);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/18-day5-activity53.png' });

  // 5.4: my own workstation (seat 9 = ransomware)
  await openMission(page, 'd5-act5.4');
  await tab(page, 'PowerShell');
  await type(page, 'Get-ChildItem Documents');
  await expect.poll(() => screen(page)).toMatch(/README_RESTORE_FILES|HOW_TO_DECRYPT|RECOVER_YOUR_DATA/);
  await page.locator('[data-k="verdict"]').selectOption('Ransomware red flag');
  await page.locator('[data-k="action"]').selectOption('Escalate immediately to the Shift Lead (local 4401)');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/19-day5-activity54.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day05_Lab_Notebook_Rosa_Bautista_Seat09.doc');
});
