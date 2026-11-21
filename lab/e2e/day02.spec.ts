// End-to-end run of the Day 2 lab in the installed Microsoft Edge (no browser download needed).
import { test, expect, type Page } from '@playwright/test';
import { openDay, openMission, statusBar, missionTitle, menu, finishBefore } from './lab';

async function type(page: Page, line: string) {
  await page.locator('.term.show .xterm-helper-textarea').focus();
  await page.keyboard.type(line, { delay: 2 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const screen = (page: Page) => page.locator('.term.show .xterm-rows').innerText();
// the terminal wraps long lines at its real width, so compare ignoring the line breaks xterm inserted
const flat = async (page: Page) => (await screen(page)).replace(/\n/g, '');

test('Day 2: sign in, practice Demo 1, do Activity 2.3, export', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your full name').fill('Ana Reyes');
  await page.getByLabel(/Seat number/).fill('12');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await expect(page.locator('#view')).toContainText('Training days');
  await openMission(page, 'd2-demo1');
  await expect(missionTitle(page)).toContainText('Demo 1');

  // Practice Demo 1 on the demo workstation
  await type(page, 'ipconfig /all');
  await expect.poll(() => screen(page)).toContain('10.10.20.57(Preferred)');
  await type(page, 'netstat -ano | findstr LISTENING');
  await expect.poll(() => screen(page)).toContain('0.0.0.0:3389');
  await expect(page.locator('.steps li.done')).toHaveCount(2);
  await page.screenshot({ path: 'e2e/shots/01-demo1-windows.png' });

  // Ubuntu tab
  await page.locator('#host-tabs button', { hasText: 'Ubuntu' }).click();
  await type(page, 'sudo ss -tunap | grep LISTEN');
  await expect.poll(() => flat(page)).toContain('pid=901');
  await page.getByRole('button', { name: /Pin last output/ }).click();
  await page.screenshot({ path: 'e2e/shots/02-demo1-ubuntu-evidence.png' });

  // Activity 2.3 on the trainee's own VM (activities open in order: 2.1 and 2.2 finished first)
  await finishBefore(page, 'd2-act2.3');
  await openMission(page, 'd2-act2.3');
  await type(page, "awk '{print $1}' ~/assets/web_access.log | sort | uniq -c | sort -rn");
  await expect.poll(() => screen(page)).toContain('203.0.113.77');
  // a command longer than the terminal width is echoed once (no repeated prompt lines)
  expect(((await screen(page)).match(/awk '\{print/g) ?? []).length).toBe(1);
  await page.locator('#nb-tabs button', { hasText: 'Worksheet' }).click();
  await page.locator('[data-k="s.1.ip"]').fill('198.51.100.200');
  await page.locator('[data-k="s.1.st"]').fill('200');
  await page.locator('[data-k="s.1.ok"]').selectOption('Yes');
  await page.locator('[data-k="s.2.ip"]').fill('10.10.20.15');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.td .mark.ok')).toHaveCount(3);
  await expect(page.locator('.td .mark.no')).toHaveCount(1);
  await page.screenshot({ path: 'e2e/shots/03-activity23-worksheet.png' });

  // Activity 2.1 shows seat-specific hosts
  await openMission(page, 'd2-act2.1');
  await expect(page.locator('#host-tabs')).toContainText('WKS-LAB-12');
  await type(page, 'ipconfig');
  await expect.poll(() => screen(page)).toContain('10.10.20.112');
  await page.screenshot({ path: 'e2e/shots/04-activity21-seat12.png' });

  // Export
  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('Day02_Lab_Notebook_Ana_Reyes_Seat12.doc');

  // Reload keeps progress
  await page.reload();
  await expect(page.locator('#who')).toContainText('Ana Reyes');
  await openDay(page, 2);
  await expect(page.locator('#view .row[data-m="d2-demo1"]')).toContainText('steps');
});

test('Screenshot for the Demo 3 video: Activity 2.4 in the lab', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your full name').fill('Juan Dela Cruz');
  await page.getByLabel(/Seat number/).fill('5');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await finishBefore(page, 'd2-act2.4');
  await openMission(page, 'd2-act2.4');
  await type(page, 'cd ~/assets');
  await type(page, 'grep -n import log_counter.py');
  await type(page, 'python3 log_counter.py web_access.log');
  await expect.poll(() => screen(page)).toContain('IP ADDRESS');
  await page.locator('[data-k="reads"]').fill('Only the log file named on the command line (sys.argv[1]).');
  await page.locator('[data-k="changes"]').fill('Nothing. It only prints. Imports are sys and collections: no network.');
  await page.locator('[data-k="top.1.ip"]').fill('203.0.113.77');
  await page.locator('[data-k="top.1.codes"]').fill('404 x4');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await page.waitForTimeout(5600); // let the step toast fade
  await page.screenshot({ path: 'e2e/shots/05-activity24-for-video.png' });
});

test('Screenshots for the Demo 1 and Demo 2 videos', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your full name').fill('Juan Dela Cruz');
  await page.getByLabel(/Seat number/).fill('5');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await openMission(page, 'd2-act2.1');
  await type(page, 'ipconfig');
  await type(page, 'netstat -ano | findstr LISTENING');
  await page.locator('[data-k="t.ip.wc"]').fill('ipconfig');
  await page.locator('[data-k="t.ip.wr"]').fill('10.10.20.105');
  await page.locator('[data-k="t.gw.wc"]').fill('ipconfig');
  await page.locator('[data-k="t.gw.wr"]').fill('10.10.20.1');
  await page.waitForTimeout(5600);
  await page.screenshot({ path: 'e2e/shots/06-activity21-for-video.png' });
  await finishBefore(page, 'd2-act2.3');
  await openMission(page, 'd2-act2.3');
  await type(page, "awk '{print $1}' ~/assets/web_access.log | sort | uniq -c | sort -rn");
  await page.locator('[data-k="s.1.ip"]').fill('203.0.113.77');
  await page.locator('[data-k="s.1.what"]').fill('Nikto scanner probing admin pages');
  await page.locator('[data-k="s.1.st"]').fill('404');
  await page.locator('[data-k="s.1.ok"]').selectOption('No');
  await page.waitForTimeout(5600);
  await page.screenshot({ path: 'e2e/shots/07-activity23-for-video.png' });
});

test('Days 3 and 4: switch day, work activities, export per day', async ({ page, request }) => {
  test.setTimeout(90000); // three 5-second waits so the toasts are gone before each screenshot
  // a trainer account sees every day unlocked (signs in through the local sync server)
  await request.post('http://localhost:4180/__setting', { data: { name: 'Trainer Emails', value: 'maria.trainer@example.com' } });
  await request.post('http://localhost:4180/__roster', { data: { email: 'maria.trainer@example.com', name: 'Maria Santos', seat: 9 } });
  await page.goto('/?sync=http://localhost:4180/exec');
  await page.getByLabel('Your full name').fill('Maria Santos');
  await page.getByLabel('Email').fill('maria.trainer@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  const { code } = await (await request.get('http://localhost:4180/__code?email=maria.trainer@example.com')).json();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#who')).toContainText('TRAINER');

  // Day 3
  await openDay(page, 3);
  await expect(page.locator('#view .row[data-m="d3-demo1"]')).toContainText('Demo 1');
  await openMission(page, 'd3-act3.1');
  await expect(missionTitle(page)).toContainText('Activity 3.1');
  await type(page, 'cat ~/day3/malware_behavior_cards.txt');
  await expect.poll(() => screen(page)).toContain('CARD 8');
  await page.locator('[data-k="c.1.type"]').selectOption('Ransomware');
  await page.locator('[data-k="c.1.tac"]').selectOption('Impact');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.td .mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/09-day3-activity31.png' });
  await openMission(page, 'd3-act3.3');
  await page.getByRole('button', { name: 'Mark as done' }).first().click();
  await expect(page.locator('.steps li.done')).toHaveCount(1);

  // Day 4: log hunt on Linux, then Defender on Windows
  await openDay(page, 4);
  await openMission(page, 'd4-act4.1');
  await expect(page.getByText('A CCTV camera starts scanning the internal network')).toBeVisible();
  await expect(page.locator('#btn-watch-again')).toBeVisible(); // its supplemental video (Watch first)
  await type(page, 'clear'); // no Day 3 output left on the end-card screen
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/41-day4-activity41.png' }); // end card of Day04_Demo4 (empty worksheet: no answers shown)
  await openMission(page, 'd4-act4.3');
  await type(page, "grep ':3389 ' ~/day4/firewall.log | awk '{print $6}' | cut -d= -f2 | cut -d: -f1 | sort | uniq -c");
  await expect.poll(() => screen(page)).toContain('198.51.100.150');
  await page.locator('#host-tabs button', { hasText: 'PowerShell' }).click();
  await type(page, String.raw`Import-Csv day4\windows_security_events.csv | Where-Object event_id -eq 4625 | Group-Object account`);
  await expect.poll(() => screen(page)).toContain('vendor');
  await page.locator('[data-k="ip"]').fill('198.51.100.150');
  await page.locator('[data-k="fails"]').fill('12');
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.locator('.field .mark.ok')).toHaveCount(2);
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/10-day4-activity43.png' });

  await openMission(page, 'd4-act4.4');
  await type(page, 'Get-MpThreatDetection');
  await expect.poll(() => screen(page)).toContain('InitialDetectionTime');
  await type(page, "Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624} | Format-List TimeCreated, Message");
  await expect.poll(() => screen(page)).toContain('trainee09');
  await page.waitForTimeout(5400);
  await page.screenshot({ path: 'e2e/shots/11-day4-activity44.png' });

  const dl = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  expect((await dl).suggestedFilename()).toBe('Day04_Lab_Notebook_Maria_Santos_Seat09.doc');
});

test('Workspace is separate from the activities', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your full name').fill('Trainer Demo');
  await page.getByLabel(/Seat number/).fill('1');
  await page.getByRole('button', { name: 'Start the lab' }).click();
  await openMission(page, 'workspace');
  await expect(page.locator('#mission-head')).toContainText(/not linked to any activity/i);
  await page.locator('#host-tabs button', { hasText: 'ubuntu-lab (demo)' }).click();
  await type(page, 'touch only_in_workspace.txt');
  await type(page, 'sudo ss -tunap | grep LISTEN');
  await expect.poll(() => flat(page)).toContain('pid=901');
  await page.locator('button[data-cheat]').first().click(); // "Type it" fills the Windows demo tab
  await expect(page.locator('#host-tabs button.active')).toContainText('WKS-TRN-07 (demo)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'e2e/shots/12-workspace.png' });

  // Back to Day 2: no steps completed, nothing logged, and the workspace file is not on the activity VM
  await openMission(page, 'd2-demo1');
  await expect(statusBar(page)).toContainText('0/13 steps');
  await page.locator('#nb-tabs button', { hasText: 'Command log' }).click();
  await expect(page.locator('#nb-body')).toContainText('Every command you run is recorded here');
  await page.locator('#host-tabs button', { hasText: 'Ubuntu' }).click();
  await type(page, 'ls');
  await expect.poll(() => screen(page)).not.toContain('only_in_workspace.txt');
});
