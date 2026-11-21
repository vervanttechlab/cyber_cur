// Day locking and Google-Sheet progress sync (against the real Code.gs running on the local fake server).
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { openDay, openMission, statusBar, missionTitle, menu, signInOnline } from './lab';
import { readFileSync } from 'node:fs';

const SYNC = 'http://localhost:4180';
const fixture = JSON.parse(readFileSync('e2e/fixtures/day2-complete.json', 'utf-8'));

async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}

test('Days 3 and 4 stay locked until the previous day is finished', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your full name').fill('Lock Test');
  await page.getByLabel(/Seat number/).fill('20');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await expect(page.locator('#sidenav a', { hasText: 'Threat Landscape' })).toHaveClass(/locked/);
  await expect(page.locator('#view .row', { hasText: 'Threat Landscape' })).toContainText('Finish Day 2 first');
  await expect(page.locator('#sidenav a', { hasText: 'Workspace' })).not.toHaveClass(/locked/); // Workspace is always open
  await openDay(page, 2);
  await expect(page.locator('#view .pagehead')).toContainText('0 of 4 activities finished');
  // activities go in order: only 2.1 opens until it is finished; a direct link to 2.3 goes back to the day
  await expect(page.locator('#view a.row[data-m="d2-act2.1"]')).toHaveCount(1);
  await expect(page.locator('#view .row[data-m="d2-act2.2"]')).toContainText('Finish Activity 2.1 first');
  await expect(page.locator('#view a.row[data-m="d2-act2.3"]')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/m/d2-act2.3'; });
  await expect(page.locator('#toast')).toContainText('Activity 2.1 is not finished yet');
  await expect(page.locator('#work')).toBeHidden();
  await page.screenshot({ path: 'e2e/shots/13-locked.png' });

  await page.waitForTimeout(600); // the app writes to storage 250 ms after a change
  // finish Day 2 (all steps done, every worksheet checked) -> Day 3 opens, Day 4 stays locked
  await page.evaluate((fx) => { const k = 'ctm-virtual-lab:v1'; const s = JSON.parse(localStorage.getItem(k)!); s.done = { ...s.done, ...fx.done }; s.checked = fx.checked; localStorage.setItem(k, JSON.stringify(s)); }, fixture);
  await page.reload();
  await expect(page.locator('#view .pagehead')).toContainText('4 of 4 activities finished');
  await expect(page.locator('#sidenav a', { hasText: 'Threat Landscape' })).not.toHaveClass(/locked/);
  await expect(page.locator('#sidenav a', { hasText: 'Security Solutions' })).toHaveClass(/locked/);
});

test('Switch user right after a change keeps the work: signing back in restores it', async ({ page, request }) => {
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'switch@example.com', name: 'Switch Test', seat: 21 } });
  await signInOnline(page, request, 'switch@example.com', 'Switch Test');
  await openMission(page, 'd2-act2.1');
  await page.locator('[data-k="t.ip.wr"]').fill('10.10.20.121');
  await page.locator('#notes').count(); // no wait: switch immediately, inside the 3-second save delay
  await menu(page, 'Switch user');
  await menu(page, /Click again/);
  await expect(page.getByLabel('Email')).toBeVisible(); // signed out
  await signInOnline(page, request, 'switch@example.com', 'Switch Test');
  await expect(page.locator('#who')).toContainText('Switch Test'); // signed in (the restored work is checked below; a chat notice can replace the toast)
  await openMission(page, 'd2-act2.1');
  await expect(page.locator('[data-k="t.ip.wr"]')).toHaveValue('10.10.20.121');
});

test('Activities open only on the days the trainer opens; Practice is always open', async ({ page, request }) => {
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '' } });
  await signInOnline(page, request, 'gate@example.com', 'Gate Test');
  await expect(page.locator('#who')).toContainText('Gate Test');
  await openDay(page, 2);
  const act = page.locator('#view .row[data-m="d2-act2.1"]');
  await expect(act).toHaveClass(/closed/);
  await expect(page.locator('.gate-note')).toContainText('Day 2 Activities are closed');
  await page.evaluate(() => { location.hash = '#/m/d2-act2.1'; }); // a link to it: the trainee is told why it is closed
  await expect(page.locator('#toast')).toContainText('closed');
  await page.waitForFunction(() => document.body.dataset.route === '#/day/2'); // back on the Day page
  await openMission(page, 'd2-demo1');
  await type(page, 'ipconfig /all'); // practice still records steps
  await expect(statusBar(page)).toContainText('1/13 steps');
  await page.screenshot({ path: 'e2e/shots/15-activities-closed.png' });

  // the trainer types 2 in Open Days: the lab picks it up on its next status check (focus triggers one)
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#sidenav .sn-live')).toHaveCount(1); // Day 2 is marked as open today
  await openDay(page, 2);
  await expect(act).not.toHaveClass(/closed/);
  await expect(page.locator('.gate-note')).toHaveCount(0);
  await act.click();
  await page.getByRole('button', { name: /Skip the video/ }).click();
  await expect(missionTitle(page)).toContainText('Activity 2.1');

  // closed again: the open Activity is left and its commands are not recorded
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '' } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => document.body.dataset.route === '#/day/2'); // the closed Activity is left
  await expect(act).toHaveClass(/closed/);
});

test('Offline practice without signing in: Practice works, Activities stay locked', async ({ page }) => {
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByRole('button', { name: /Practice offline/ }).click();
  await page.getByLabel('Your full name').fill('Offline Trainee');
  await page.getByLabel(/Seat number/).fill('30');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await openDay(page, 2);
  await expect(page.locator('#view .row[data-m="d2-act2.1"]')).toHaveClass(/closed/);
  await expect(page.locator('.gate-note')).toContainText('Sign in online');
  await openMission(page, 'workspace'); // the Workspace is open
  await expect(missionTitle(page)).toContainText('Workspace');
});

test('Progress syncs to the Google Sheet and follows the trainee to another computer', async ({ browser, request }) => {
  await request.post(`${SYNC}/__roster`, { data: { email: 'juan@example.com', name: 'Juan Dela Cruz', seat: 14 } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  const p1 = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(p1, request, 'juan@example.com', 'Juan Dela Cruz');
  await expect(p1.locator('#who')).toContainText('Juan Dela Cruz');
  await expect(p1.locator('#who')).toContainText('Seat 14'); // from the Roster
  await openMission(p1, 'd2-act2.1');
  await type(p1, 'ipconfig');
  await p1.locator('[data-k="t.ip.wc"]').fill('ipconfig');
  await p1.locator('[data-k="t.ip.wr"]').fill('10.10.20.114');
  await p1.getByRole('button', { name: 'Check my answers' }).click();
  await expect(p1.locator('#sync')).toContainText('Saved online', { timeout: 15000 });
  await p1.waitForTimeout(4500); // let the debounced save reach the server
  await p1.screenshot({ path: 'e2e/shots/14-synced.png' });

  // the trainer's Progress sheet got a row
  const rows = await (await request.get(`${SYNC}/__progress`)).json();
  const row = rows.find((r: (string | number)[]) => r[0] === 'juan@example.com');
  expect(row.slice(1, 3)).toEqual(['Juan Dela Cruz', 14]);
  expect(row[5]).toBe('0 / 4 (1/19 steps)');
  expect(row[12]).toBeGreaterThan(0);

  // a different computer (fresh browser profile): sign in -> same progress and worksheet answers
  const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(p2, request, 'juan@example.com', 'Juan Dela Cruz');
  await expect(p2.locator('#who')).toContainText('Juan Dela Cruz'); // the restored work is checked below
  await openMission(p2, 'd2-act2.1');
  await expect(p2.locator('[data-k="t.ip.wr"]')).toHaveValue('10.10.20.114');
  await expect(statusBar(p2)).toContainText('1/10 steps');

  // a trainee who is not on the Roster gets a free seat automatically, never Juan's
  const p3 = await (await browser.newContext()).newPage();
  await signInOnline(p3, request, 'other@example.com', 'Someone Else');
  await expect(p3.locator('#who')).toContainText(/Seat \d\d/);
  await expect(p3.locator('#who')).not.toContainText('Seat 14');
});

test('Class report: trainer sees who signed in, who follows the demos, who started the activities', async ({ browser, request }) => {
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'coach.report@example.com' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'lia.report@example.com', name: 'Lia Mendoza', seat: 31 } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'noshow.report@example.com', name: 'Paolo Ramos', seat: 32 } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'act.report@example.com', name: 'Grace Lim', seat: 33 } });

  // trainee 1 watches the Demo 1 video and repeats a command from it
  const lia = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(lia, request, 'lia.report@example.com', 'Lia Mendoza');
  await expect(lia.locator('#who')).toContainText('Seat 31');
  await lia.locator('#btn-menu').click();
  await expect(lia.locator('#menu-dlg').getByRole('button', { name: 'Class report' })).toHaveCount(0); // trainees never see it
  await lia.keyboard.press('Escape');
  await openMission(lia, 'd2-demo1');
  await lia.getByRole('button', { name: /Watch the video/ }).click();
  await lia.getByRole('button', { name: 'Close and practice' }).click();
  await type(lia, 'hostnamectl');
  await expect(lia.locator('#sync')).toContainText('Saved online', { timeout: 15000 });
  await lia.waitForTimeout(4500); // let the debounced save reach the server

  // trainee 2 starts an activity
  const grace = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(grace, request, 'act.report@example.com', 'Grace Lim');
  await openMission(grace, 'd2-act2.1');
  await type(grace, 'ipconfig');
  await expect(grace.locator('#sync')).toContainText('Saved online', { timeout: 15000 });
  await grace.waitForTimeout(4500); // let the debounced save reach the server

  // the trainer opens the Class report
  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(coach, request, 'coach.report@example.com', 'Coach Trainer');
  await menu(coach, 'Class report');
  const rp = coach.locator('#report-dlg');
  await expect(rp.locator('#rp-day')).toHaveValue('2'); // the day the trainer opened
  const row = (email: string) => rp.locator('tr', { hasText: email });
  await expect(row('lia.report@example.com')).toContainText('Following the demos');
  await expect(row('lia.report@example.com').locator('td').nth(4)).toHaveText('1/3');
  await expect(row('act.report@example.com')).toContainText('Doing activities');
  await expect(row('noshow.report@example.com')).toContainText('Not signed in');
  await expect(row('noshow.report@example.com')).toContainText('never');
  await expect(rp.locator('tr', { hasText: 'coach.report@example.com' })).toHaveCount(0); // trainer accounts are not listed
  await coach.screenshot({ path: 'e2e/shots/36-class-report.png' });
  const dl = coach.waitForEvent('download');
  await rp.getByRole('button', { name: /Download CSV/ }).click();
  const csv = readFileSync(await (await dl).path(), 'utf-8');
  expect(csv).toContain('lia.report@example.com');
  expect(csv.split('\r\n')[0]).toContain('Day 9 Status');
  await rp.locator('#rp-day').selectOption('9');
  await expect(row('lia.report@example.com')).toContainText('Signed in, not started');
  await coach.screenshot({ path: 'e2e/shots/37-class-report-day9.png' });
});
