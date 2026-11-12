// Smoke test: the Electron wrapper starts, shows the sign-in, and runs a command.
import { _electron as electron } from 'playwright';
const app = await electron.launch({ args: ['.'] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
// with the trainer's sync URL built in, the sign-in is online: choose offline practice for the smoke test
if (await win.getByRole('button', { name: /Practice offline/ }).isVisible().catch(() => false)) await win.getByRole('button', { name: /Practice offline/ }).click();
if (await win.getByLabel('Your full name').isVisible().catch(() => false)) {
  await win.getByLabel('Your full name').fill('Smoke Test');
  await win.getByLabel(/Seat number/).fill('3');
  await win.getByRole('button', { name: 'Start the lab' }).click();
}
await win.locator('.term.show').waitFor();
await win.locator('.term.show .xterm-helper-textarea').focus();
await win.keyboard.type('whoami'); await win.keyboard.press('Enter');
await win.waitForTimeout(400);
const txt = await win.locator('.term.show .xterm-rows').innerText();
console.log('title:', await win.title(), '| whoami ->', /lab\trainee07/.test(txt) ? 'ok' : txt.slice(-200));
await win.screenshot({ path: 'e2e/shots/08-electron.png' });
await app.close();
