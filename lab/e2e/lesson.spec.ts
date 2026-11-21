// The DAL3-style flow: Home -> Day -> Lesson (handout parts with their demo videos) -> Activity with "Watch first".
// Also the phone layout (one pane at a time) and the Files tab. Screenshots in e2e/shots/50-*.
import { test, expect, type Page } from '@playwright/test';
import { openDay, finishBefore } from './lab';

async function start(page: Page, name = 'Lesson Test', seat = '11') {
  await page.goto('/');
  await page.getByLabel('Your full name').fill(name);
  await page.getByLabel(/Seat number/).fill(seat);
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await expect(page.locator('#view')).toContainText('Training days');
}

test('Day page, lesson reader, Watch first, Files', async ({ page }) => {
  await start(page);
  await page.screenshot({ path: 'e2e/shots/50-home.png' });
  await page.locator('#view a.row', { hasText: 'Computing and Network Foundations' }).click();
  await expect(page.locator('#view .pagehead')).toContainText('0 of 4 activities finished');
  await expect(page.locator('#view .row[data-m="d2-act2.1"]')).toContainText('Watch first: Demo 1');
  await page.screenshot({ path: 'e2e/shots/51-day2.png' });

  // the lesson: part 1, then Next; parts with a demo video carry a VIDEO tag and the player
  await page.getByRole('link', { name: 'Read the lesson' }).click();
  await expect(page.locator('.lpart h2')).toHaveText('Learning Objectives');
  await expect(page.locator('.lprog')).toContainText('1 of 8 parts read');
  await page.locator('.lnav a.primary').click();
  await expect(page.locator('.lpart h2')).toHaveText('1. Why a Monitor Needs IT Foundations');
  await expect(page.locator('.lprog')).toContainText('2 of 8 parts read');
  await page.locator('.toc a', { hasText: '2. Operating Systems' }).click();
  await expect(page.locator('.toc a.on .tag')).toHaveText('VIDEO');
  await expect(page.locator('.lpart video')).toHaveAttribute('src', 'videos/Day02_Demo1_Monitoring_Commands.mp4');
  await page.screenshot({ path: 'e2e/shots/52-lesson.png' });
  await page.locator('.toc a', { hasText: 'References' }).click();
  await expect(page.locator('.lnav a.primary')).toHaveText(/Finish: go to the activities/);

  // Files: the two student PDFs
  await openDay(page, 2);
  await page.locator('.daytabs a', { hasText: 'Files' }).click();
  await expect(page.locator('#view .files a.row')).toHaveCount(2);
  const pdf = await page.request.get(await page.locator('#view .files a.row').first().getAttribute('href') as string);
  expect(pdf.headers()['content-type']).toContain('pdf');

  // an activity opens on its demo video first; skipping is allowed and recorded (2.1 and 2.2 finished first: activities go in order)
  await finishBefore(page, 'd2-act2.3');
  await openDay(page, 2);
  await page.locator('#view .row[data-m="d2-act2.3"]').click();
  await expect(page.locator('#watch')).toBeVisible();
  await expect(page.locator('#watch .vtitle')).toHaveText('Demo 2 · Web Log Investigation');
  await page.screenshot({ path: 'e2e/shots/53-watch-first.png' });
  await page.getByRole('button', { name: /Skip the video/ }).click();
  await expect(page.locator('#watch')).toBeHidden();
  await expect(page.locator('#host-tabs')).toContainText('ubuntu-lab-11');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ctm-virtual-lab:v1')!).watched)).toEqual({ 'd2-act2.3': 'skipped' }); // saved 250 ms later
  // coming back later goes straight to the work (the video stays one click away)
  await openDay(page, 2);
  await page.locator('#view .row[data-m="d2-act2.3"]').click();
  await expect(page.locator('#watch')).toBeHidden();
  await expect(page.locator('#btn-watch-again')).toBeVisible();
});

test('phone: bottom tabs and one pane at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await start(page, 'Phone Test', '12');
  await expect(page.locator('#sidenav')).toBeHidden();
  await expect(page.locator('#bottomnav')).toBeVisible();
  await page.locator('#bottomnav a', { hasText: 'Day 2' }).click();
  await page.locator('#view .row[data-m="d2-demo1"]').click();
  await expect(page.locator('#missions')).toBeVisible(); // a new mission opens on its steps
  await expect(page.locator('.p-term')).toBeHidden();
  await page.locator('#seg button', { hasText: 'Terminal' }).click();
  await expect(page.locator('.p-term')).toBeVisible();
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type('hostname', { delay: 2 });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('.term.show .xterm-rows').innerText()).toContain('WKS-TRN-07');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // no sideways scroll
  await page.screenshot({ path: 'e2e/shots/54-phone-terminal.png' });
  await page.locator('#seg button', { hasText: 'Notebook' }).click();
  await expect(page.locator('#notebook')).toBeVisible();
});
