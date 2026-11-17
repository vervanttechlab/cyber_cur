// Update notices: a newer build is published while a trainee works. A modal tells them; Later keeps everything as it is;
// Update now saves and reloads with the work kept. A returning trainee who missed an update sees "What's new" once.
import { test, expect } from '@playwright/test';
import { openMission, signInOnline, menu } from './lab';

const NEWER = { version: '2999-01-01T00:00:00.000Z', notes: [{ id: 'e2e-new', date: '1 Jan 2999', title: 'Faster terminals', items: ['The terminal opens faster.'], trainer: ['Only for trainers.'] }] };

test('a newer published lab: modal, Later keeps the work, Update now reloads with the work kept', async ({ page, request }) => {
  await request.post('http://localhost:4180/__setting', { data: { name: 'Open Days', value: '2' } });
  await signInOnline(page, request, 'update.test@example.com', 'Una Dizon');
  await expect(page.locator('#who')).toContainText('Una Dizon');
  await openMission(page, 'd2-act2.1');
  await page.locator('[data-k="t.ip.wr"]').fill('10.10.20.121');
  await expect(page.locator('#update-dlg')).toBeHidden(); // the build that is running: nothing to say

  // the site now serves a newer build: the lab notices on its next check (every minute, or when the window is used)
  await page.route('**/version.json*', (r) => r.fulfill({ json: NEWER }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const dlg = page.locator('#update-dlg');
  await expect(dlg).toBeVisible({ timeout: 10000 });
  await expect(dlg).toContainText('The lab has been updated');
  await expect(dlg).toContainText('The terminal opens faster.');
  await expect(dlg).not.toContainText('Only for trainers.');
  await expect(dlg).toContainText('Your work is safe.');
  expect(await dlg.evaluate((d) => d.matches(':modal'))).toBe(true);
  await page.screenshot({ path: 'e2e/shots/74-update-modal.png' });

  // Later: nothing changes, and the title bar keeps an "Update ready" button
  await dlg.getByRole('button', { name: 'Later' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('[data-k="t.ip.wr"]')).toHaveValue('10.10.20.121');
  await expect(page.locator('#btn-update')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1000);
  await expect(dlg).toBeHidden(); // no nagging right after Later

  // Update now right after typing: saved at once, reloaded, the work is all there
  await page.locator('[data-k="t.ip.lr"]').fill('192.168.56.121');
  await page.locator('#btn-update').click();
  await expect(dlg).toBeVisible();
  await page.unroute('**/version.json*'); // after the reload the lab is the published build
  await dlg.getByRole('button', { name: 'Update now' }).click();
  await page.waitForLoadState('load');
  await expect(page.locator('#who')).toContainText('Una Dizon');
  await openMission(page, 'd2-act2.1');
  await expect(page.locator('[data-k="t.ip.wr"]')).toHaveValue('10.10.20.121');
  await expect(page.locator('[data-k="t.ip.lr"]')).toHaveValue('192.168.56.121');
  await expect(page.locator('#update-dlg')).toBeHidden();
  await expect(page.locator('#btn-update')).toBeHidden();
});

test('a returning trainee who missed an update sees What\'s new once; the menu shows it any time', async ({ page, request }) => {
  await signInOnline(page, request, 'news.test@example.com', 'Nora Cruz');
  await expect(page.locator('#who')).toContainText('Nora Cruz');
  await expect(page.locator('#update-dlg')).toBeHidden(); // a new trainee: everything is new, no notes
  await page.waitForTimeout(500); // the lab writes its local save 250 ms after a change
  await page.evaluate(() => localStorage.setItem('ctm-notes-seen', 'an-older-note'));
  await page.reload();
  const dlg = page.locator('#update-dlg');
  await expect(dlg).toContainText("What's new in the lab", { timeout: 10000 });
  await expect(dlg).toContainText('Team rooms');
  await dlg.getByRole('button', { name: 'OK' }).click();
  await page.reload();
  await expect(page.locator('#who')).toContainText('Nora Cruz');
  await page.waitForTimeout(2500);
  await expect(dlg).toBeHidden(); // once
  await menu(page, /What's new/);
  await expect(dlg).toContainText("What's new in the lab");
});
