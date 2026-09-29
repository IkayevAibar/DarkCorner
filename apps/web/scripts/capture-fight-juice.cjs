// Review clips stay outside the implementation branch. Run with the sandbox dev server.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('../src/screens/sandbox/fightFixtures.json');
const baseURL = process.env.FIGHT_BASE_URL || 'http://127.0.0.1:5187';
const output = process.env.FIGHT_OUTPUT || path.join(require('node:os').tmpdir(), 'dark-fight-juice-review');
const clips = [
  ['fighter-crit', 'champion-survivor', e => e.type === 'attack' && e.crit && e.actor === 'hero', 8],
  ['archer-arrows', 'rogue-pack', (e, r) => e.type === 'attack' && r.monsters.find(m => m.key === e.actor)?.strike === 'shoot', 8],
  ['wizard-fireball', 'wizard-burst', e => e.type === 'burst', 8],
  ['wizard-bolt', 'wizard-burst', e => e.type === 'attack' && e.kind === 'spell', 5],
  ['cleric-heal', 'cleric-heals', e => e.type === 'heal' && e.ability === 'cure-wounds', 7],
  ['undead-crumble', 'miniboss-bone-knight', e => e.type === 'defeated', 6],
  ['demon-embers', 'cleric-heals', e => e.type === 'defeated', 4],
  ['down-rise', 'rise-on-20', e => e.type === 'down', 13],
  ['dragon-breath', 'dragon', e => e.type === 'power' && e.power === 'breath', 9],
  ['fire-bomb', 'fire-bomb', e => e.type === 'burst', 6],
];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const [name, fixture, matches, seconds] of clips) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1,
        recordVideo: process.argv.includes('--record') ? { dir: path.join(output, 'raw'), size: { width: 375, height: 812 } } : undefined });
      const page = await context.newPage();
      await page.addInitScript(() => { localStorage.setItem('dark.guideSeen', '1'); localStorage.setItem('dc.sound', 'off'); });
      await page.route('**/auth/status', r => r.fulfill({ json: { devLogin: true } }));
      await page.route('**/api/me', r => r.fulfill({ json: { player: {
        id: 'preview', name: 'Preview', status: 'approved', isAdmin: false, locale: 'en', avatarUrl: null,
      } } }));
      await page.goto(`${baseURL}/sandbox?lang=en`);
      await page.clock.install({ time: new Date('2026-09-29T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-29T12:00:01Z'));
      await page.getByRole('button', { name: fixture, exact: true }).click();
      await page.locator('[data-fight-ready="true"]').waitFor();
      const replay = fixtures[fixture], index = replay.events.findIndex(e => matches(e, replay));
      if (index < 0) throw new Error(`Missing event for ${name}`);
      while (Number(await page.locator('[data-fight-step]').getAttribute('data-fight-step')) < index + 1) {
        await page.clock.fastForward(3000);
      }
      await page.clock.runFor(name === 'wizard-bolt' || name === 'archer-arrows' ? 190 : 350);
      await page.screenshot({ path: path.join(output, `${name}.png`) });
      if (process.argv.includes('--record')) { await page.clock.resume(); await new Promise(resolve => setTimeout(resolve, seconds * 1000)); }
      const video = page.video(); await context.close();
      if (video) { await video.saveAs(path.join(output, `${name}.webm`)); await video.delete(); }
      console.log(`Captured ${name}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
