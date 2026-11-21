// Teams, against the real Code.gs on the local fake server: the team room (members, live team chat with typing, pinned
// announcements), sharing and copying answers inside a team (flagged on the Trainer board), and the trainer rearranging teams.
import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test';
import { openMission, finishBefore } from './lab';

const SYNC = 'http://localhost:4180';
async function signIn(browser: Browser, request: APIRequestContext, email: string, name: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  await page.goto(`/?sync=${SYNC}/exec`);
  await page.getByLabel('Your full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  const { code } = await (await request.get(`${SYNC}/__code?email=${email}`)).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#who')).toContainText(name);
  return page;
}
async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const panel = (p: Page) => p.locator('#social');
const tab = (p: Page, name: RegExp) => panel(p).getByRole('tab', { name });
async function send(p: Page, text: string) {
  await panel(p).locator('#soc-text').fill(text);
  await panel(p).locator('#soc-text').press('Enter');
}

test('Team room: members, live team chat with typing, the trainer moderates and announces', async ({ browser, request }) => {
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'coach.social@example.com' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'mara.social@example.com', name: 'Mara Santos', seat: 34, team: 'Blue Team' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'nico.social@example.com', name: 'Nico Reyes', seat: 35, team: 'Blue Team' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'ola.social@example.com', name: 'Ola Garcia', seat: 36, team: 'Red Team' } });

  const coach = await signIn(browser, request, 'coach.social@example.com', 'Coach Rosa');
  const nico = await signIn(browser, request, 'nico.social@example.com', 'Nico Reyes');
  const ola = await signIn(browser, request, 'ola.social@example.com', 'Ola Garcia');
  const mara = await signIn(browser, request, 'mara.social@example.com', 'Mara Santos');
  await openMission(mara, 'd2-act2.1');

  // one room per team: the members of my team only, online or not, and what they work on
  await mara.locator('#btn-social').click();
  await expect(panel(mara).locator('.soc-head')).toContainText('Blue Team');
  await expect(panel(mara).locator('.soc-tabs [role=tab]')).toHaveCount(3); // Chat · Members · Shared, no channel picker
  await expect(panel(mara).locator('select')).toHaveCount(0);
  await tab(mara, /Members/).click();
  await expect(panel(mara).locator('.soc-people')).toContainText('Mara Santos (you)');
  await expect(panel(mara).locator('.soc-people')).toContainText('Nico Reyes');
  await expect(panel(mara)).not.toContainText('Ola Garcia');
  await expect(panel(mara)).toContainText('A trainer is online.');
  await mara.screenshot({ path: 'e2e/shots/38-team-online.png' });

  // live chat: typing shows, messages arrive within a few seconds
  await tab(mara, /Chat/).click();
  await nico.locator('#btn-social').click();
  await panel(nico).locator('#soc-text').fill('Ok, checking');
  await expect(panel(mara).locator('#soc-typing')).toHaveText('Nico is typing…', { timeout: 6000 });
  await panel(nico).locator('#soc-text').fill('');
  await send(mara, 'Hi Blue Team! I am on Activity 2.1, who has the IP for WKS-LAB?');
  await expect(panel(mara).locator('.soc-msg.mine')).toContainText('Hi Blue Team!');
  await expect(panel(nico).locator('.soc-msg')).toContainText('Hi Blue Team!', { timeout: 6000 });
  await send(nico, 'Run ipconfig on the PowerShell tab 🙂');
  await expect(panel(mara).locator('.soc-msg').last()).toContainText('Run ipconfig', { timeout: 6000 });
  await expect(panel(mara).locator('#soc-typing')).toHaveText('');
  await mara.screenshot({ path: 'e2e/shots/39-team-chat.png' });

  // the panel closed: a new message shows as a toast and on the badge
  await panel(nico).getByRole('button', { name: 'Close' }).click();
  await mara.waitForTimeout(1600); // the server allows one message per 1.5 s
  await send(mara, 'Thanks Nico!');
  await expect(nico.locator('#toast')).toContainText('Mara in Blue Team: Thanks Nico!', { timeout: 15000 });
  await expect(nico.locator('#btn-social .soc-badge')).toBeVisible();

  // another team never sees the Blue Team room
  await ola.locator('#btn-social').click();
  await expect(panel(ola).locator('.soc-head')).toContainText('Red Team');
  await expect(panel(ola).locator('.soc-msgs')).not.toContainText('Hi Blue Team');
  await expect(panel(ola).locator('#soc-ann')).toHaveCount(0); // trainees cannot announce

  // the trainer opens any team's room, hides a message, and announces to every team (pinned)
  await coach.locator('#btn-social').click();
  await expect(coach.locator('#btn-social')).toContainText('Teams');
  await panel(coach).locator('#soc-team').selectOption('Blue Team');
  await expect(panel(coach).locator('.soc-msg')).toHaveCount(3);
  await panel(coach).locator('.soc-msg', { hasText: 'Run ipconfig' }).getByRole('button', { name: 'Hide' }).click();
  await expect(panel(coach).locator('.soc-msg')).toHaveCount(2);
  await expect(panel(mara).locator('.soc-msg')).toHaveCount(2, { timeout: 6000 }); // gone for the team too
  await panel(coach).locator('#soc-ann').check();
  await send(coach, 'Break until 10:30. Finish Activity 2.1 first.');
  await expect(panel(ola).locator('#soc-pin')).toContainText('Break until 10:30', { timeout: 6000 });
  await expect(panel(mara).locator('#soc-pin')).toContainText('Break until 10:30', { timeout: 6000 });
  await expect(panel(mara).locator('.soc-msgs')).not.toContainText('Break until'); // pinned, not in the team chat
  await coach.screenshot({ path: 'e2e/shots/40-trainer-chat.png' });
});

test('Answer sharing: a teammate copies shared answers, the board flags it; the trainer rearranges teams', async ({ browser, request }) => {
  test.setTimeout(60000); // four sign-ins, three of them reloaded with Activity 2.1 finished
  await request.post(`${SYNC}/__setting`, { data: { name: 'Trainer Emails', value: 'coach.share@example.com' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Open Days', value: '2' } });
  await request.post(`${SYNC}/__setting`, { data: { name: 'Answer Sharing', value: '2' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'ana.share@example.com', name: 'Ana Lopez', seat: 37, team: 'Gold Team' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'ben.share@example.com', name: 'Ben Ramos', seat: 38, team: 'Gold Team' } });
  await request.post(`${SYNC}/__roster`, { data: { email: 'cara.share@example.com', name: 'Cara Diaz', seat: 39, team: 'Green Team' } });
  const ana = await signIn(browser, request, 'ana.share@example.com', 'Ana Lopez');
  const ben = await signIn(browser, request, 'ben.share@example.com', 'Ben Ramos');
  const cara = await signIn(browser, request, 'cara.share@example.com', 'Cara Diaz');
  for (const p of [ana, ben, cara]) await finishBefore(p, 'd2-act2.2'); // activities go in order: 2.1 first

  // Ana does both steps and answers all of Activity 2.2, then shares it with her team
  await openMission(ana, 'd2-act2.2');
  await type(ana, 'cat ~/assets/lab_network_topology.txt');
  await type(ana, "grep -- '->' ~/assets/lab_network_topology.txt");
  const anaWs = ana.locator('#nb-body');
  await expect(anaWs.locator('#teambar')).toContainText('Share my answers with Gold Team', { timeout: 15000 });
  const fields = anaWs.locator('[data-k]');
  const total = await fields.count();
  for (let i = 0; i < total; i++) {
    const f = fields.nth(i);
    if (await f.evaluate((el) => el.tagName === 'SELECT')) await f.selectOption('Risky'); else await f.fill(i === 0 ? 'Internet' : `Answer ${i}`);
  }
  await fields.nth(total - 1).press('Tab'); // leaving the last answer: her own worksheet is complete
  await expect(ana.locator('#board-dlg')).toContainText('Every answer is filled in: ready to submit');
  await ana.locator('#board-dlg').getByRole('button', { name: 'Later' }).click();
  await anaWs.locator('#tb-share').check();
  await expect(ana.locator('#toast')).toContainText('your answers are shared with Gold Team');

  // Ben, same team, opens the activity: straight onto the activity (no video), his empty worksheet is filled in with
  // Ana's answers and her finished steps at once, and it is ready to submit
  await openMission(ben, 'd2-act2.2', { skipVideo: false });
  const dlg = ben.locator('#board-dlg');
  await expect(dlg).toContainText('Every answer is filled in: ready to submit', { timeout: 15000 });
  await expect(ben.locator('#watch')).toBeHidden();
  await expect(dlg.locator('.of-sum')).toContainText(`${total} / ${total}`);
  await expect(dlg.locator('.of-sum')).toContainText('2 / 2'); // Ana's steps are marked done for Ben
  await expect(dlg).not.toContainText('steps not done yet');
  await ben.screenshot({ path: 'e2e/shots/73-ready-to-submit.png' });
  const benWs = ben.locator('#nb-body');
  await expect(benWs.locator('[data-k="z.1.zone"]')).toHaveValue('Internet');
  await expect(benWs.locator('[data-k="r.1.v"]')).toHaveValue('Risky');
  await dlg.getByRole('button', { name: 'Submit now' }).click();
  const sub = ben.locator('#submit-dlg');
  await expect(sub).toContainText('Submit Activity 2.2?');
  await expect(sub.locator('#sb-go')).toBeVisible();
  await sub.getByRole('button', { name: 'Cancel' }).click(); // not sent: the submit specs count the class's submissions

  // the offer is asked once; the share stays open from the bar above the worksheet and the team room
  await ben.reload();
  await openMission(ben, 'd2-act2.2');
  await expect(benWs.locator('#teambar')).toContainText('Shared by Ana Lopez', { timeout: 15000 });
  await ben.waitForTimeout(1500);
  await expect(dlg).toBeHidden();
  await benWs.locator('#teambar').getByRole('button', { name: 'Ana Lopez' }).click();
  await expect(dlg).toContainText('Ana Lopez · Activity 2.2');
  await expect(dlg).toContainText('Answer 1');
  await ben.screenshot({ path: 'e2e/shots/70-shared-answers.png' });
  await dlg.getByRole('button', { name: 'Close' }).click();
  await ben.locator('#btn-social').click();
  await tab(ben, /Shared/).click();
  await expect(panel(ben).locator('.soc-shares')).toContainText('Ana Lopez');
  await openMission(cara, 'd2-act2.2');
  await expect(cara.locator('#teambar')).toContainText('No teammate shares this activity yet.', { timeout: 15000 });
  await cara.locator('#nb-body input[data-k]').first().fill('Her own answer'); // typed by Cara: a fill asks before replacing it
  await expect(cara.locator('#board-dlg')).toBeHidden(); // another team gets no offer

  // the trainer: the copy is flagged on the board (in the live cell, before any submission)
  const coach = await signIn(browser, request, 'coach.share@example.com', 'Coach Rosa');
  await coach.evaluate(() => { location.hash = '#/board/2'; });
  const row = coach.locator('.btable tr', { hasText: 'Ben Ramos' });
  await expect(row.locator('.tag.copy')).toBeVisible({ timeout: 15000 });
  await expect(row.locator('.tag.copy')).toHaveAttribute('title', new RegExp(`Copied ${total} answers from Ana Lopez`));
  await expect(coach.locator('.btable tr', { hasText: 'Ana Lopez' }).locator('.tag.copy')).toHaveCount(0);

  // the Teams page: move Cara to Gold Team and save; her room switches within seconds
  await coach.getByRole('link', { name: /Teams/ }).first().click();
  await expect(coach.locator('.tcols')).toBeVisible();
  await expect(coach.locator('.tcol[data-team="Gold Team"] .tcard')).toHaveCount(2);
  await coach.locator('[data-move="cara.share@example.com"]').selectOption('Gold Team');
  await expect(coach.locator('#tm-pending')).toHaveText('1 change not saved');
  await coach.screenshot({ path: 'e2e/shots/71-teams-page.png' });
  await coach.getByRole('button', { name: 'Save' }).click();
  await expect(coach.locator('#toast')).toContainText('Saved: 1 trainee moved');
  await expect(coach.locator('.tcol[data-team="Gold Team"] .tcard')).toHaveCount(3);
  // Cara, now in Gold Team and on the activity, has typed an answer of her own: she is asked first; "Not now" closes it
  await expect(cara.locator('#board-dlg')).toContainText("with Ana's answers?", { timeout: 15000 });
  await expect(cara.locator('#board-dlg')).toContainText('of your answers replaced');
  await cara.screenshot({ path: 'e2e/shots/72-fill-offer.png' });
  await cara.locator('#board-dlg').getByRole('button', { name: 'Not now' }).click();
  await expect(cara.locator('#teambar')).toContainText('Shared by Ana Lopez');
  await cara.locator('#btn-social').click();
  await expect(panel(cara).locator('.soc-head')).toContainText('Gold Team', { timeout: 8000 });

  // an activity with a "Watch first" video: Ben has not watched it, yet opening the shared activity skips the video
  // and lands on the activity, filled in (the video stays on the Demo video button)
  await openMission(ana, 'd2-act2.1');
  await expect(anaWs.locator('#teambar')).toContainText('Share my answers with Gold Team', { timeout: 15000 });
  await anaWs.locator('input[data-k], textarea[data-k]').first().fill('Shared answer');
  await anaWs.locator('#tb-share').check();
  await expect(ana.locator('#toast')).toContainText('your answers are shared with Gold Team');
  await ana.waitForTimeout(3000); // saved online
  await openMission(ben, 'd2-act2.1', { skipVideo: false });
  await expect(dlg).toContainText('answers filled in', { timeout: 15000 }); // Ana answered only one: the rest is listed
  await expect(ben.locator('#watch')).toBeHidden();
  await expect(ben.locator('#btn-watch-again')).toBeVisible();
  await expect(ben.locator('#nb-body input[data-k], #nb-body textarea[data-k]').first()).toHaveValue('Shared answer');
  await dlg.getByRole('button', { name: 'OK' }).click();

  // the trainer turns sharing off for the day: the share bar says so
  await request.post(`${SYNC}/__setting`, { data: { name: 'Answer Sharing', value: '' } });
  await expect(ben.locator('#teambar')).toContainText('Answer sharing in Gold Team is off for Day 2', { timeout: 8000 });
});
