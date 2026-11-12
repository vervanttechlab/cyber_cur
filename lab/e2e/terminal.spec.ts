// Long output must never hide the newest lines: the prompt (cursor row) stays inside the visible terminal,
// at different window sizes, on both Windows and Ubuntu tabs.
import { test, expect, type Page } from '@playwright/test';
import { openMission } from './lab';

async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 1 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}
/** The bottom of the last terminal row must be inside the visible terminal box (and inside the window). */
async function lastRowVisible(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('.terms')!.getBoundingClientRect();
    const rows = document.querySelectorAll('.term.show .xterm-rows > div');
    const last = rows[rows.length - 1].getBoundingClientRect();
    return { lastBottom: Math.round(last.bottom), boxBottom: Math.round(box.bottom), winBottom: window.innerHeight, ok: last.bottom <= box.bottom + 0.5 && last.bottom <= window.innerHeight + 0.5 };
  });
}

for (const [w, h] of [[1440, 860], [1280, 720], [1366, 768], [1920, 1080]]) {
  test(`long output keeps the prompt visible at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.getByLabel('Your full name').fill('Scroll Test');
    await page.getByLabel(/Seat number/).fill('4');
    await page.getByRole('button', { name: 'Start the lab' }).click();
    await openMission(page, 'd2-demo1');
    await page.locator('#host-tabs button', { hasText: 'Ubuntu' }).click();
    await type(page, 'cat ~/day5/soc_alert_sop.txt');
    await type(page, 'echo LAST-LINE-MARKER');
    expect(await lastRowVisible(page), 'Ubuntu').toMatchObject({ ok: true });
    await expect(page.locator('.term.show .xterm-rows')).toContainText('LAST-LINE-MARKER');
    await page.locator('#host-tabs button', { hasText: 'PowerShell' }).click();
    await type(page, String.raw`Get-Content day5\soc_alert_sop.txt`);
    expect(await lastRowVisible(page), 'PowerShell').toMatchObject({ ok: true });
  });
}
