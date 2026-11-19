// Submissions and the trainer board (DAL3-style), against the real Code.gs on the local fake server:
// a trainee submits -> the trainer sees it, re-checked on the trainee's seat -> verdict + feedback -> the trainee sees it
// -> returned for redo -> the trainee submits again (attempt 2). Screenshots e2e/shots/60-*.
import { test, expect, type Page } from '@playwright/test';
import { openDay, openMission, statusBar, menu, signInOnline } from './lab';

const SYNC = 'http://localhost:4180';
async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const poll = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the lab checks in on focus

test('submit an activity, the trainer grades it and returns it for redo, the trainee submits again', async ({ browser, request }) => {
  test.setTimeout(120000);
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'coach.submit@example.com' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'kim.submit@example.com', name: 'Kim Aquino', seat: 15, team: 'Blue Team' } });

  // the trainee works Activity 2.1 and submits it
  const kim = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(kim, request, 'kim.submit@example.com', 'Kim Aquino');
  await expect(kim.locator('#who')).toContainText('Seat 15');
  await openMission(kim, 'd2-act2.1');
  await type(kim, 'ipconfig');
  await kim.locator('[data-k="t.ip.wc"]').fill('ipconfig');
  await kim.locator('[data-k="t.ip.wr"]').fill('10.10.20.115');
  await kim.locator('[data-k="t.gw.wr"]').fill('10.10.20.254'); // wrong on purpose
  await kim.getByRole('button', { name: 'Check my answers' }).click();
  await kim.locator('#btn-submit').click();
  const dlg = kim.locator('#submit-dlg');
  await expect(dlg).toContainText('Submit Activity 2.1?');
  await expect(dlg).toContainText('2 / 25'); // the auto-checked answers (an empty answer counts as wrong)
  await kim.screenshot({ path: 'e2e/shots/60-submit-dialog.png' });
  await dlg.getByRole('button', { name: 'Submit' }).click();
  await expect(dlg).toContainText('is with your trainer');
  await dlg.getByRole('button', { name: 'Stay here' }).click();
  await expect(statusBar(kim)).toContainText('Submitted 2/25 (attempt 1)');
  await expect(kim.locator('#btn-submit')).toHaveText('Submit again');
  await openDay(kim, 2);
  await expect(kim.locator('#view .row[data-m="d2-act2.1"]')).toContainText('SUBMITTED');
  await expect(kim.locator('#view .row[data-m="d2-act2.1"]')).toContainText('waiting for trainer');

  // the trainer opens the board: the work, re-checked on seat 15
  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await signInOnline(coach, request, 'coach.submit@example.com', 'Coach Rosa');
  await expect(coach.locator('#bd-day')).toHaveValue('2'); // a trainer lands on the Trainer board
  await expect(coach.locator('#crumbs')).toHaveText('Trainer board');
  const cell = coach.locator('.bcell[data-email="kim.submit@example.com"][data-act="d2-act2.1"]');
  await expect(cell).toContainText('2/25');
  await expect(cell).toContainText('NEW');
  await expect(coach.locator('#bd-next')).toContainText('Grade next (1 waiting');
  await coach.screenshot({ path: 'e2e/shots/61-trainer-board.png' });
  await cell.click();
  const det = coach.locator('#board-dlg');
  await expect(det).toContainText('Kim Aquino · Activity 2.1');
  await expect(det.locator('.dsum')).toContainText('Re-checked on seat 15');
  await expect(det.locator('.dsum')).not.toContainText('Differs');
  await expect(det.locator('.ptable')).toContainText('10.10.20.115');
  await expect(det).toContainText('ipconfig'); // the command log
  await det.getByRole('button', { name: 'Not Yet Competent' }).click();
  await det.locator('#dt-fb').fill('- Check the default gateway line of ipconfig.');
  await coach.screenshot({ path: 'e2e/shots/62-trainer-detail.png' });
  await det.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(det).toBeHidden();
  await expect(cell).toContainText('NYC');

  // the trainee sees the verdict and the feedback
  await poll(kim);
  await expect(kim.locator('#toast')).toContainText('NOT YET COMPETENT');
  await expect(kim.locator('#view .row[data-m="d2-act2.1"]')).toContainText('NOT YET COMPETENT');
  await expect(kim.locator('#view .row[data-m="d2-act2.1"] .feedback')).toContainText('Check the default gateway');

  // returned for redo
  await cell.click();
  await det.getByRole('button', { name: 'Return for redo…' }).click();
  await det.locator('#dt-redo-note').fill('Fix the gateway, then submit again.');
  await det.getByRole('button', { name: 'Return to the trainee' }).click();
  await expect(cell).toContainText('REDO');
  await poll(kim);
  await expect(kim.locator('#view .row[data-m="d2-act2.1"]')).toContainText('REDO');
  await openMission(kim, 'd2-act2.1');
  await expect(kim.locator('#missions .note')).toContainText('Fix the gateway, then submit again.');
  await kim.locator('[data-k="t.gw.wr"]').fill('10.10.20.1');
  await kim.locator('#btn-submit').click();
  await expect(dlg).toContainText('3 / 25');
  await dlg.getByRole('button', { name: 'Submit' }).click();
  await expect(dlg).toContainText('Attempt 2');

  // the board: attempt 2 waits for a verdict; both attempts are kept
  await coach.locator('#bd-refresh').click();
  await expect(cell).toContainText('3/25');
  await expect(cell).toContainText('×2');
  await expect(cell).toContainText('NEW');
  await cell.click();
  await expect(det.locator('[data-attempt]')).toHaveCount(2);
  await det.getByRole('button', { name: 'Competent', exact: true }).click();
  await det.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(cell).toContainText('C');
  // the trainer's Day page shows the class, not the trainer's own progress; previews have no Watch first and no Submit
  await openDay(coach, 2);
  await expect(coach.locator('#view .row[data-m="d2-act2.1"]')).toContainText(/1\/\d+ submitted/); // the shared test server has the trainees of the other specs too
  await expect(coach.locator('#view .trainer-banner')).toBeVisible();
  await coach.screenshot({ path: 'e2e/shots/63-trainer-day.png' });
  await openMission(coach, 'd2-act2.1', { skipVideo: false });
  await expect(coach.locator('#watch')).toBeHidden();
  await expect(coach.locator('#btn-submit')).toBeHidden();
  await coach.evaluate(() => { location.hash = '#/board/2'; });
  await expect(cell).toContainText('C');
  const dl = coach.waitForEvent('download');
  await coach.locator('#bd-csv').click();
  expect((await dl).suggestedFilename()).toMatch(/^CTM_Grades_\d{4}-\d\d-\d\d\.csv$/);

  // trainees never reach the board
  await kim.evaluate(() => { location.hash = '#/board'; });
  await kim.waitForFunction(() => document.body.dataset.route === '#/');
});
