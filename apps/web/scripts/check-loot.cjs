// Requires Chrome and Playwright; media stays outside the implementation branch.
require('tsx/cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { CHESTS, REVEALS, LOOT_HERO, sealed } = require('../src/screens/sandbox/lootFixtures.ts');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.LOOT_OUTPUT || path.join(require('node:os').tmpdir(), 'dark-chest-spin-review');
const baseURL = process.env.LOOT_BASE_URL || 'http://127.0.0.1:5187';
const me = hero => ({ season: 0, hero, draft: null, canCreate: false, canRetire: true });
const errors = [];

async function prepare(page, locale = 'en', hero = LOOT_HERO) {
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('dark.guideSeen', '1'); localStorage.setItem('dc.sound', 'off'); });
  await page.route('**/auth/status', r => r.fulfill({ json: { devLogin: true } }));
  await page.route('**/api/me', r => r.fulfill({ json: { player: {
    id: 'preview', name: 'Preview', status: 'approved', isAdmin: false, locale, avatarUrl: null,
  } } }));
  await page.route('**/api/heroes/me', r => r.fulfill({ json: me(hero) }));
  await page.goto(`${baseURL}/sandbox?lang=${locale}`);
}

async function landed(page) {
  await page.locator('[data-spin-complete=true]').waitFor();
  const centerError = await page.locator('.spin-window').evaluate(el => {
    const prize = el.querySelector('.spin-strip').children[40].getBoundingClientRect();
    const needle = el.querySelector('.spin-needle').getBoundingClientRect();
    return Math.abs((prize.left + prize.right) / 2 - needle.left);
  });
  assert.ok(centerError < 1, `Prize missed the needle by ${centerError}px`);
  assert.equal(await page.locator('.loot-scene').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
}

async function dismissSpin(page) {
  await page.locator('.loot-scene > button').click();
  assert.equal(await page.locator('.loot-overlay').count(), 0);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    if (process.argv.includes('--record')) {
      for (const name of ['iron', 'gold', 'relic']) {
        const context = await browser.newContext({ viewport: { width: 375, height: 812 },
          recordVideo: { dir: path.join(output, 'raw'), size: { width: 375, height: 812 } } });
        const page = await context.newPage(); await prepare(page);
        await page.locator(name === 'relic' ? '[data-reveal=relic]' : `[data-chest=${name}]`).click();
        await page.waitForTimeout(name === 'relic' ? 4100 : 5400);
        await page.screenshot({ path: path.join(output, `${name}.png`) });
        const video = page.video(); await context.close();
        await video.saveAs(path.join(output, `${name}.webm`)); await video.delete();
        console.log(`Recorded ${name}`);
      }
      return;
    }

    const results = [];
    for (const locale of ['en', 'ru']) for (const motion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: motion });
      const page = await context.newPage(); await prepare(page, locale);
      for (const grade of ['iron', 'silver', 'gold']) {
        const trigger = page.locator(`[data-chest=${grade}]`);
        await trigger.click();
        if (motion === 'no-preference') {
          assert.equal(await page.locator('.spin-prize').count(), 0);
          if (grade === 'silver') await page.locator('.loot-scene > button').click();
        }
        await landed(page);
        assert.ok((await page.locator('.spin-prize').innerText()).includes(CHESTS[grade].prize.name[locale]));
        if (!CHESTS[grade].prize.identified) {
          assert.equal(await page.locator('.spin-prize img').count(), 0);
          assert.ok((await page.locator('.spin-prize').innerText()).includes('?'));
        }
        await page.screenshot({ path: path.join(output, `${grade}-${locale}-${motion}.png`) });
        await dismissSpin(page);
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        results.push(`${locale}/${motion}/${grade}`);
      }
      for (const kind of ['rare', 'radiant', 'relic']) {
        await page.locator(`[data-reveal=${kind}]`).click();
        if (motion === 'no-preference') {
          await page.locator('[data-reveal-step="1"]').waitFor();
          assert.ok(await page.locator('.identify-reveal [data-hidden=true]').count() > 0);
          if (kind === 'rare') await page.locator('.identify-reveal > button').click();
        }
        await page.locator('[data-reveal-complete=true]').waitFor();
        assert.equal(await page.locator('.identify-reveal [data-hidden=true]').count(), 0);
        const visible = await page.locator('.identify-reveal').innerText();
        assert.ok(visible.includes(REVEALS[kind].name[locale]));
        for (const bonus of REVEALS[kind].bonusStats) assert.ok(visible.includes(bonus[locale]));
        if (motion === 'reduce') {
          assert.equal(await page.locator('.identify-reveal .tier-spark, .identify-reveal .tier-ray').count(), 0);
        }
        // The host sheet has its own entrance; let it settle before visual evidence.
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(output, `${kind}-${locale}-${motion}.png`) });
        await page.locator('.identify-reveal > button').click();
        await page.locator('.identify-reveal').waitFor({ state: 'detached' });
        results.push(`${locale}/${motion}/${kind}`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('[data-replay-tiers]').click();
      assert.equal(await page.locator('[data-loot-preview] [data-tier]').count(), 7);
      assert.equal(await page.locator('[data-tier=common] .tier-fx').count(), 0);
      if (motion === 'no-preference') {
        for (let i = 0; i < 4; i++) {
          await page.locator('[data-chest=gold]').click();
          await page.keyboard.press('Escape'); await landed(page);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.loot-overlay').count(), 0);
        }
        await page.locator('[data-chest=iron]').click();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await landed(page); await dismissSpin(page);
      }
      await context.close(); console.log(`PASS ${locale}/${motion}: Spins, reveals, every Tier, Skip, layout`);
    }

    // Production Loot and Heroes screens, real handlers with only network responses stubbed.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const hero = structuredClone(LOOT_HERO);
      const stack = (base, kind, icon) => ({ ...sealed(REVEALS.rare), id: base, base, kind, icon, identified: true,
        name: { en: base, ru: base }, tier: 'uncommon', gear: null });
      hero.bag = [stack('chest-iron', 'chest', 'chest'), stack('key-iron', 'key', 'key'), sealed(REVEALS.rare)];
      await prepare(page, 'en', hero);
      let opens = 0, identifies = 0;
      await page.route('**/api/items/*/open', r => { opens++; hero.bag = hero.bag.filter(i => i.kind === 'gear');
        return r.fulfill({ json: { ...CHESTS.iron, hero } }); });
      await page.route('**/api/items/*/identify', r => { identifies++; hero.bag = [REVEALS.rare];
        return r.fulfill({ json: { item: REVEALS.rare, free: true, hero } }); });
      await page.goto(`${baseURL}/loot?lang=en`);
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await landed(page); await dismissSpin(page); assert.equal(opens, 1);
      await page.getByRole('button', { name: 'Unidentified Item', exact: true }).click();
      await page.getByRole('button', { name: 'Identify', exact: true }).click();
      await page.locator('[data-reveal-complete=true]').waitFor();
      await page.locator('.identify-reveal > button').click();
      await page.locator('.identify-reveal').waitFor({ state: 'detached' });
      assert.equal(identifies, 1);

      hero.bag = [sealed(REVEALS.rare)];
      const text = en => ({ en, ru: en });
      await page.route('**/api/heroes/options', r => r.fulfill({ json: {
        races: [{ id: 'elf', name: text('Elf'), trait: text('Keen senses'), talentPicks: 1 }],
        classes: [{ id: 'wizard', name: text('Wizard'), hitDie: 6, fights: text('Magic'), trick: text('Identify'), primary: 'int' }],
        talents: [], portraits: [], banners: [],
      } }));
      await page.goto(`${baseURL}/heroes?lang=en`);
      await page.getByRole('button', { name: 'Unidentified Item', exact: true }).click();
      await page.getByRole('button', { name: 'Identify', exact: true }).click();
      await page.locator('[data-reveal-complete=true]').waitFor();
      assert.equal(identifies, 2);
      assert.ok((await page.locator('.identify-reveal').innerText()).includes(REVEALS.rare.name.en));
      await page.locator('.identify-reveal > button').click();
      await page.locator('.identify-reveal').waitFor({ state: 'detached' });
      await context.close(); console.log('PASS Loot open/identify and Heroes identify with stubbed API');
    }
    // Labyrinth report uses the same bursts, while its existing handler plays one best-Tier cue.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage(); await prepare(page);
      const fight = require('../src/screens/sandbox/fightFixtures.json')['wizard-burst'];
      const view = {
        location: 'labyrinth', hero: { name: 'Mira', portraitUrl: LOOT_HERO.portraitUrl, banner: LOOT_HERO.banner,
          hp: 30, maxHp: 30, level: 4, xp: 0, xpNext: 100, stamina: 10, staminaMax: 10, staminaNextAt: null,
          carriedGold: 0, spells: 1, heals: 0, potions: 0, portalScrolls: 0, stance: 'steady',
          bombs: { fire: 0, smoke: 0 }, features: [], kit: [], shortRests: { left: 2, of: 2, backAt: null } },
        season: { status: 'active', bossGateAt: null, omen: null }, waypoints: [], portal: null, bestFloor: 4,
        floor: { number: 4, name: { en: 'Crypt', ru: 'Склеп' }, theme: 'crypt', width: 3, height: 3 },
        room: { id: 5, type: 'fight', event: null, map: fight.map, cleared: false, restedAt: null, eventView: null, vault: null,
          facing: { kind: 'fight', monsters: fight.monsters, foes: [], threat: { bold: 'risky', steady: 'risky', wary: 'risky' }, sneak: null } },
        exits: [], map: { rooms: [], doors: [] }, graves: [],
      };
      const result = { view, fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false, notices: [], checks: [], duel: null, run: null, deeds: [] };
      await page.route('**/api/labyrinth', r => r.fulfill({ json: result }));
      await page.route('**/api/labyrinth/face', r => r.fulfill({ json: { ...result, loot: [REVEALS.rare, REVEALS.relic],
        view: { ...view, room: { ...view.room, cleared: true, facing: null } } } }));
      await page.goto(`${baseURL}/labyrinth?lang=en`);
      await page.getByRole('button', { name: 'Fight', exact: true }).click();
      await page.locator('[role=dialog] [data-tier=relic]').waitFor();
      assert.equal(await page.locator('[role=dialog] [data-tier]').count(), 2);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, 'labyrinth-drops.png') });
      await page.getByRole('button', { name: REVEALS.relic.name.en, exact: true }).click();
      assert.ok((await page.locator('[role=dialog]').last().innerText()).includes(REVEALS.relic.power.en));
      await context.close(); console.log('PASS Labyrinth drop bursts and Item sheet');
    }

    // Reuse the app's sound switch: one vibration on a Mythic reveal, none when muted.
    {
      const context = await browser.newContext({ viewport: { width: 1000, height: 850 } });
      const page = await context.newPage(); await prepare(page);
      await page.evaluate(async () => {
        window.lootVibrations = [];
        navigator.vibrate = pattern => { window.lootVibrations.push(pattern); return true; };
        const sound = await import('/src/sound.ts'); sound.setSoundOn(true);
      });
      await page.locator('[data-chest=gold]').click();
      await page.locator('.loot-scene > button').click(); await landed(page);
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => window.lootVibrations), [[70, 50, 140]]);
      await page.screenshot({ path: path.join(output, 'gold-desktop.png') });
      await dismissSpin(page);
      await page.evaluate(async () => (await import('/src/sound.ts')).setSoundOn(false));
      await page.locator('[data-chest=gold]').click(); await page.locator('.loot-scene > button').click();
      await landed(page); assert.equal(await page.evaluate(() => window.lootVibrations.length), 1);
      await dismissSpin(page); await context.close(); console.log('PASS desktop, one Tier vibration, mute');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'browser-checks.json'), JSON.stringify({ results, errors, integration: 'Loot, Heroes, Labyrinth, sound preference passed' }, null, 2));
    console.log(`PASS ${results.length} scene/language/motion combinations`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
