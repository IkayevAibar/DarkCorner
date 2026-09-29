// Run against the dev server. PLAYWRIGHT_MODULE can point at a preinstalled Playwright runtime.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('../src/screens/sandbox/fightFixtures.json');
const baseURL = process.env.FIGHT_BASE_URL || 'http://127.0.0.1:5187';
// Review media lives outside the merge branch. FIGHT_OUTPUT may point at a separate evidence checkout.
const output = path.resolve(process.env.FIGHT_OUTPUT || path.join(require('node:os').tmpdir(), 'dark-fight-scene-review'));

async function prepare(page, locale = 'en') {
  await page.addInitScript(() => { localStorage.setItem('dark.guideSeen', '1'); localStorage.setItem('dc.sound', 'off'); });
  await page.route('**/auth/status', r => r.fulfill({ json: { devLogin: true } }));
  await page.route('**/api/me', r => r.fulfill({ json: { player: {
    id: 'preview', name: 'Preview', status: 'approved', isAdmin: false, locale, avatarUrl: null,
  } } }));
  await page.goto(`${baseURL}/sandbox?lang=${locale}`);
}

async function open(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.locator('[data-fight-ready="true"]').waitFor({ timeout: 30000 });
}

async function through(page, count) {
  for (let i = 0; i < count + 3; i++) {
    if (await page.locator('[data-fight-complete="true"]').count()) return;
    await page.clock.fastForward(3000);
    // Let React commit the next step before the next clock jump.
    await page.locator('[data-fight-step]').evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  }
  assert.fail('Replay did not finish');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    if (process.argv.includes('--record')) {
      for (const [name, eventType, power, seconds] of [
        ['wizard-burst', 'burst', null, 8], ['survived-death-saves', 'down', null, 13],
        ['sapper-blast', 'defeated', null, 8], ['dragon', 'power', 'breath', 10],
      ]) {
        const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1,
          recordVideo: { dir: path.join(output, 'raw'), size: { width: 375, height: 812 } } });
        const page = await context.newPage(); await prepare(page); await page.clock.install(); await open(page, name);
        const target = fixtures[name].events.findIndex(e => e.type === eventType && (!power || e.power === power));
        while (Number(await page.locator('[data-fight-step]').getAttribute('data-fight-step')) < target) {
          await page.clock.fastForward(3000);
          await page.locator('[data-fight-step]').evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
        }
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        await page.screenshot({ path: path.join(output, `${name}.png`) });
        const video = page.video(); await context.close();
        await video.saveAs(path.join(output, `${name}.webm`)); await video.delete();
        console.log(`Recorded ${name}`);
      }
      return;
    }

    const errors = [];
    const results = [];
    for (const locale of ['en', 'ru']) for (const reducedMotion of ['reduce', 'no-preference']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1,
        reducedMotion });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await prepare(page, locale); await page.clock.install();
      const names = [...Object.keys(fixtures), 'visual-lucky-reroll', 'visual-elite-powers-fallback', 'visual-hero-bow'];
      for (const name of names) {
        await open(page, name);
        assert.equal(await page.locator('.fight-canvas canvas').count(), 1, `${name}: canvas`);
        await through(page, fixtures[name]?.events.length ?? 10);
        const label = await page.locator('.fight-outcome').innerText();
        assert.ok(label.length > 0);
        assert.equal(await page.locator('.fight-panel').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
        if (name === 'dragon' || name === 'visual-elite-powers-fallback')
          await page.screenshot({ path: path.join(output, `${name}-${locale}.png`) });
        await page.locator('[data-fight-skip]').click();
        assert.equal(await page.locator('.fight-overlay, .fight-canvas canvas').count(), 0);
        results.push({ name, locale, reducedMotion, outcome: label }); console.log(`PASS ${locale} ${reducedMotion} ${name}`);
      }
      // Escape, keyboard focus restoration, and repeated mounts with cached art.
      for (let i = 0; i < 5; i++) {
        await open(page, 'wizard-burst');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('[data-fight-speed]').evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.fight-overlay').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'wizard-burst', exact: true }).evaluate(el => el === document.activeElement), true);
      }
      // Pausing freezes the canvas and event cursor, and only reveals the log so far.
      await open(page, 'dragon');
      await page.clock.fastForward(3000);
      await page.locator('[data-fight-log]').click();
      const step = await page.locator('[data-fight-step]').getAttribute('data-fight-step');
      const sceneTime = await page.locator('.fight-canvas').getAttribute('data-scene-time');
      const lines = await page.locator('.fight-history li').count();
      assert.ok(lines > 0 && lines < fixtures.dragon.events.length);
      assert.equal(await page.locator('.fight-history .text-center').count(), 0, 'no future outcome');
      await page.clock.fastForward(10000);
      assert.equal(await page.locator('[data-fight-step]').getAttribute('data-fight-step'), step);
      assert.equal(await page.locator('.fight-canvas').getAttribute('data-scene-time'), sceneTime);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.fight-history').count(), 0);
      assert.equal(await page.locator('.fight-overlay').count(), 1);
      await page.locator('[data-fight-speed]').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('dc.fight.speed')), '2');
      await page.locator('[data-fight-skip]').click();
      await open(page, 'wizard-burst');
      assert.equal(await page.locator('[data-fight-speed]').innerText(), '2×');
      await page.locator('[data-fight-speed]').click();
      await page.locator('[data-fight-skip]').click();
      await context.close();
    }
    // Skip must work before the dynamically imported graphics module arrives.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await prepare(page);
      await page.route('**/components/fight/stage.ts*', async route => {
        await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue();
      });
      await page.getByRole('button', { name: 'wizard-burst', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1800);
      assert.equal(await page.locator('.fight-overlay, .fight-canvas canvas').count(), 0);
      await context.close();
    }
    // A device without WebGL still gets an accessible, skippable replay.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return String(kind).startsWith('webgl') ? null : original.call(this, kind, ...args);
        };
      });
      await prepare(page); await page.clock.install(); await open(page, 'wizard-burst');
      assert.equal(await page.locator('.fight-fallback').count(), 1);
      await through(page, fixtures['wizard-burst'].events.length);
      await page.locator('[data-fight-skip]').click(); await context.close();
    }
    // Exercise the production Labyrinth component's Fight -> replay -> report handoff.
    // Only the network is stubbed; the screen, modal stack and turned Room map are real.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const replay = fixtures['wizard-burst'];
      const view = {
        location: 'labyrinth', hero: { name: replay.hero.name.en, portraitUrl: replay.hero.art, banner: replay.hero.banner,
          hp: replay.hero.hp, maxHp: replay.hero.maxHp, level: 4, xp: 0, xpNext: 100, stamina: 10, staminaMax: 10,
          staminaNextAt: null, carriedGold: 0, spells: 1, heals: 0, potions: 0, portalScrolls: 0, stance: 'steady',
          bombs: { fire: 0, smoke: 0 }, features: [], kit: [], shortRests: { left: 2, of: 2, backAt: null } },
        season: { status: 'active', bossGateAt: null, omen: null }, waypoints: [], portal: null, bestFloor: 4,
        floor: { number: 4, name: { en: 'Crypt', ru: 'Склеп' }, theme: 'crypt', width: 3, height: 3 },
        room: { id: 5, type: 'fight', event: null, map: replay.map, cleared: false, restedAt: null, eventView: null, vault: null,
          facing: { kind: 'fight', monsters: replay.monsters, foes: [], threat: { bold: 'risky', steady: 'risky', wary: 'risky' }, sneak: null } },
        exits: [], map: { rooms: [], doors: [] }, graves: [],
      };
      const result = { view, fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false, notices: [], checks: [], duel: null, run: null, deeds: [] };
      await page.route('**/api/labyrinth', r => r.fulfill({ json: result }));
      await page.route('**/api/labyrinth/face', r => {
        assert.deepEqual(r.request().postDataJSON(), { action: 'fight', bomb: false });
        return r.fulfill({ json: { ...result, fight: replay,
          view: { ...view, room: { ...view.room, cleared: true, facing: null } } } });
      });
      await prepare(page); await page.goto(`${baseURL}/labyrinth?lang=en`); await page.clock.install();
      await page.getByRole('button', { name: 'Fight', exact: true }).click();
      await page.locator('[data-fight-ready="true"]').waitFor();
      assert.equal(await page.locator('.fight-canvas canvas').count(), 1);
      await page.screenshot({ path: path.join(output, 'labyrinth-fight.png') });
      await through(page, replay.events.length);
      await page.locator('[data-fight-skip]').click();
      assert.equal(await page.locator('.fight-overlay').count(), 0);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Fight', exact: true }).count(), 0);
      await context.close(); console.log('PASS Labyrinth fight/report handoff (stubbed API)');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'browser-checks.json'), JSON.stringify({ results, errors, lifecycle: 'passed', fallback: 'passed' }, null, 2));
    console.log(`PASS ${results.length} fixture/locale combinations, lifecycle and graphics fallback`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
