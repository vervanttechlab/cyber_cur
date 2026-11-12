// Trainer monitoring (after the DAL3 lab): the trainer sees who is online and what each trainee is doing before they
// submit, opens a trainee's live work and dated activity log, and downloads the class activity log with dates and times.
// Against the real Code.gs on the local fake server. Screenshots e2e/shots/64-*, 65-*.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openMission, signInOnline } from './lab';

const SYNC = 'http://localhost:4180';
async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const DATE = /\d{4}-\d\d-\d\d/;

test('the trainer watches a trainee work live and downloads the class activity log with dates and times', async ({ browser, request }) => {
  test.setTimeout(120000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'coach.mon@example.com' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'lea.mon@example.com', name: 'Lea Santos', seat: 16, team: 'Red Team' } });

  // the trainee works on Activity 2.1 (not submitted)
  const lea = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(lea, request, 'lea.mon@example.com', 'Lea Santos');
  await expect(lea.locator('#who')).toContainText('Seat 16');
  await openMission(lea, 'd2-act2.1');
  await type(lea, 'ipconfig');
  await lea.locator('[data-k="t.ip.wc"]').fill('ipconfig');
  await lea.getByRole('button', { name: 'Check my answers' }).click();
  await expect(lea.locator('#sync')).toHaveText(/Saved online \d/, { timeout: 15000 }); // after the real save (sign-in shows "Saved online" without a time)
  await lea.evaluate(() => window.dispatchEvent(new Event('focus'))); // check in: the trainer sees the mission

  // the board: online, on Activity 2.1, live progress in the cell
  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(coach, request, 'coach.mon@example.com', 'Coach Rosa');
  await expect(coach.locator('#bd-day')).toHaveValue('2');
  const row = coach.locator('.btable tr', { has: coach.locator('a.tname', { hasText: 'Lea Santos' }) });
  await expect(row.locator('.tstate')).toContainText('Online · Activity 2.1');
  const cell = row.locator('.bcell.live[data-act="d2-act2.1"]');
  await expect(cell).toContainText(/1\/\d+ steps · 1 ans/);
  await expect(cell.locator('.dot.on')).toBeVisible();
  await coach.screenshot({ path: 'e2e/shots/64-board-live.png' });

  // the trainee page: live work re-checked on seat 16, and the dated log
  await cell.click();
  await coach.waitForFunction(() => document.body.dataset.route === '#/trainee/lea.mon%40example.com/d2-act2.1');
  const v = coach.locator('#view');
  await expect(v.locator('h2')).toHaveText('Lea Santos');
  await expect(v.locator('.mstatus')).toContainText('Online now');
  await expect(v).toContainText('WORKING ON IT NOW');
  await expect(v.locator('.dsum')).toContainText('re-checked on seat 16');
  await expect(v.locator('.dcols .ptable')).toContainText('ipconfig');
  await expect(v.locator('.mlog')).toContainText('Checked answers');
  await expect(v.locator('.mlog')).toContainText('Signed in');
  await expect(v.locator('.mlog .lday').first()).toContainText(/\w+day, \w+ \d+, \d{4}/);
  await expect(v.locator('.dcols')).toContainText(/\d+ more answers not filled in yet/);
  await coach.screenshot({ path: 'e2e/shots/65-trainee-page.png' });
  await v.locator('.chip[data-f="work"]').click();
  await expect(v.locator('.mlog')).not.toContainText('Signed in');
  await expect(v.locator('.mlog')).toContainText('ipconfig');
  await v.locator('.mlog').scrollIntoViewIfNeeded();
  await coach.screenshot({ path: 'e2e/shots/66-trainee-log.png' });
  let dl = coach.waitForEvent('download');
  await v.locator('#mn-csv').click();
  let file = await dl;
  expect(file.suggestedFilename()).toMatch(/^CTM_Activity_Log_Seat16_Lea_Santos_\d{4}-\d\d-\d\d\.csv$/);
  let text = readFileSync((await file.path())!, 'utf8').replace(/^\ufeff/, '');
  expect(text.split('\r\n')[0]).toBe('Date,Time,Seat,Full Name,Email,Team,Day,Activity / Mission,Event,Details,Host');
  expect(text).toMatch(new RegExp(`${DATE.source},\\d{1,2}:\\d\\d:\\d\\d [AP]M,16,Lea Santos,lea.mon@example.com,Red Team,2,Activity 2.1[^,]*,Command,ipconfig,`));

  // the class exports from the board: accomplishments summary and full log, with dates and times
  await coach.locator('a[href="#/board"]').first().click();
  await coach.locator('#bd-log').click();
  const dlg = coach.locator('#board-dlg');
  await expect(dlg).toContainText('Download the class activity log');
  dl = coach.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Download (CSV)' }).click();
  file = await dl;
  expect(file.suggestedFilename()).toMatch(/^CTM_Accomplishments_Day2_\d{4}-\d\d-\d\d\.csv$/);
  text = readFileSync((await file.path())!, 'utf8');
  const lines = text.replace(/^\ufeff/, '').trim().split('\r\n');
  const head = lines[0].split(','), lea21 = lines.find((l) => l.includes('lea.mon@example.com') && l.includes('Activity 2.1'))!.split(',');
  expect(lea21[head.indexOf('Started (date & time)')]).toMatch(new RegExp(`^${DATE.source} \\d{1,2}:\\d\\d [AP]M$`));
  expect(lea21[head.indexOf('Last Check (date & time)')]).toMatch(DATE);
  expect(lea21[head.indexOf('Status')]).toBe('In progress');
  await coach.locator('#bd-log').click();
  await dlg.locator('input[name="lx-day"][value="0"]').check();
  await dlg.locator('input[name="lx-what"][value="all"]').check();
  dl = coach.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Download (CSV)' }).click();
  file = await dl;
  expect(file.suggestedFilename()).toMatch(/^CTM_Activity_Log_All_Days_\d{4}-\d\d-\d\d\.csv$/);
  text = readFileSync((await file.path())!, 'utf8');
  expect(text).toMatch(/,lea\.mon@example\.com,Red Team,,,Signed in,/);
  expect(text).toContain(',Command,ipconfig,');
});
