// Who is online + team chat, against the real Code.gs on the local fake server.
import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test';
import { openDay, openMission, statusBar, missionTitle, menu } from './lab';

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
const panel = (p: Page) => p.locator('#social');

test('Who is online and team chat: teams see their own members, the trainer sees and moderates everything', async ({ browser, request }) => {
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

  // a trainee sees their own team (and the trainer), never another team
  await mara.locator('#btn-social').click();
  await expect(panel(mara).locator('.soc-head')).toContainText('Blue Team');
  await expect(panel(mara).locator('.soc-people')).toContainText(['Coach Rosa']);
  await expect(panel(mara)).toContainText('Nico Reyes');
  await expect(panel(mara)).toContainText('Mara Santos (you)');
  await expect(panel(mara)).not.toContainText('Ola Garcia');
  await mara.screenshot({ path: 'e2e/shots/38-team-online.png' });

  // team chat
  await panel(mara).getByRole('button', { name: /^Chat/ }).click();
  await panel(mara).locator('#soc-text').fill('Hi Blue Team! I am on Activity 2.1, who has the IP for WKS-LAB?');
  await panel(mara).locator('#soc-text').press('Enter');
  await expect(panel(mara).locator('.soc-msg.mine')).toContainText('Hi Blue Team!');
  await nico.locator('#btn-social').click();
  await panel(nico).getByRole('button', { name: /^Chat/ }).click();
  await expect(panel(nico).locator('.soc-msg')).toContainText('Hi Blue Team!');
  await panel(nico).locator('#soc-text').fill('Run ipconfig on the PowerShell tab 🙂');
  await panel(nico).getByRole('button', { name: 'Send' }).click();
  await expect(panel(mara).locator('.soc-msg').last()).toContainText('Run ipconfig', { timeout: 10000 }); // arrives within 5 s
  await mara.screenshot({ path: 'e2e/shots/39-team-chat.png' });

  // another team cannot see the Blue Team chat
  await ola.locator('#btn-social').click();
  await expect(panel(ola)).not.toContainText('Mara Santos');
  await panel(ola).getByRole('button', { name: /^Chat/ }).click();
  await expect(panel(ola).locator('#soc-ch option')).toHaveText(['💬 Red Team (your team)', '📣 Announcements']);
  await expect(panel(ola).locator('.soc-msgs')).not.toContainText('Hi Blue Team');

  // the trainer sees everyone online and every team's chat; hides a message; posts an announcement
  await coach.locator('#btn-social').click();
  await expect(coach.locator('#btn-social')).toContainText('Teams');
  for (const n of ['Mara Santos', 'Nico Reyes', 'Ola Garcia']) await expect(panel(coach)).toContainText(n);
  await expect(panel(coach)).toContainText('Activity 2.1'); // what each trainee is working on
  await panel(coach).getByRole('button', { name: /^Chat/ }).click();
  await panel(coach).locator('#soc-ch').selectOption('Blue Team');
  await expect(panel(coach).locator('.soc-msg')).toHaveCount(2);
  await panel(coach).locator('.soc-msg', { hasText: 'Run ipconfig' }).getByRole('button', { name: 'Hide' }).click();
  await expect(panel(coach).locator('.soc-msg')).toHaveCount(1);
  await expect(panel(mara).locator('.soc-msg')).toHaveCount(1, { timeout: 10000 }); // gone for the team too
  await panel(coach).locator('#soc-ch').selectOption('Announcements');
  await panel(coach).locator('#soc-text').fill('Break until 10:30. Finish Activity 2.1 first.');
  await panel(coach).locator('#soc-text').press('Enter');
  await expect(panel(coach).locator('.soc-msg')).toContainText('Break until 10:30');
  await coach.screenshot({ path: 'e2e/shots/40-trainer-chat.png' });

  // trainees read announcements but cannot post there
  await panel(ola).locator('#soc-ch').selectOption('Announcements');
  await expect(panel(ola).locator('.soc-msg')).toContainText('Break until 10:30');
  await expect(panel(ola).locator('#soc-send')).toBeHidden();
  await expect(panel(ola)).toContainText('Only your trainer posts here.');
});
