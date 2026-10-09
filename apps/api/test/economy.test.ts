import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type GearRoll, createRng, rollGear } from '@dark/engine';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { gearData } from '../src/services/items.js';
import { omenOf } from '../src/services/omens.js';
import { runDueJobs } from '../src/services/scheduler.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let seasonId: string;

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

async function makeHero(name: string, cls: 'fighter' | 'wizard' | 'rogue' | 'cleric' = 'fighter', talents: string[] = ['alert', 'tough']) {
  const cookie = await devLogin(app, name, true);
  await post(cookie, '/api/heroes/draft');
  const portrait = { fighter: 'human-fighter-1', wizard: 'elf-wizard-1', rogue: 'halfling-rogue-1', cleric: 'dwarf-cleric-1' }[cls];
  const race = { fighter: 'human', wizard: 'elf', rogue: 'halfling', cleric: 'dwarf' }[cls];
  const created = await post(cookie, '/api/heroes', { name, race, class: cls, talents: race === 'human' ? talents : talents.slice(0, 1), portrait, banner: '#9e2a2a', set: 0 });
  if (created.statusCode !== 200) throw new Error(created.body);
  // Charisma 10: plain prices (Charisma's own test raises it).
  const hero = await prisma.hero.update({ where: { id: (await prisma.hero.findFirstOrThrow({ where: { name } })).id }, data: { cha: 10 } });
  return { cookie, hero };
}

async function giveGear(heroId: string, roll: GearRoll, place: 'BAG' | 'STORAGE' = 'BAG') {
  return prisma.item.create({ data: { ...gearData(roll, 'test'), seasonId, heroId, place } });
}
async function giveStack(heroId: string, base: string, quantity: number, place: 'BAG' | 'STORAGE' = 'BAG') {
  return prisma.item.create({ data: { seasonId, heroId, place, base, tier: 'common', quantity } });
}
const setGold = (heroId: string, gold: number) => prisma.hero.update({ where: { id: heroId }, data: { gold } });
const gold = async (heroId: string) => (await prisma.hero.findUniqueOrThrow({ where: { id: heroId } })).gold;
const count = (heroId: string, base: string) => prisma.item.aggregate({ where: { heroId, base }, _sum: { quantity: true } }).then((a) => a._sum.quantity ?? 0);

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
  seasonId = (await prisma.season.create({ data: { number: 0, seed: 'economy', status: 'ACTIVE', startsAt: new Date() } })).id;
});

describe('the Shops', () => {
  it('sell basics for City gold, and not in the Labyrinth', async () => {
    const { cookie, hero } = await makeHero('Buyer');
    const r = await post(cookie, '/api/shop/buy', { offer: 'scroll-identify', quantity: 3 });
    expect(r.statusCode).toBe(200);
    expect(r.json().gold).toBe(-60);
    expect(await gold(hero.id)).toBe(40);
    expect(await count(hero.id, 'scroll-identify')).toBe(3);
    expect((await post(cookie, '/api/shop/buy', { offer: 'key-gold' })).json().error).toBe('not_enough_gold');

    await post(cookie, '/api/labyrinth/enter', { floor: 1 });
    expect((await post(cookie, '/api/shop/buy', { offer: 'potion' })).json().error).toBe('not_in_city');
  });

  it('sell each piece of today’s gear once, cheaper for a Haggler', async () => {
    const { cookie, hero } = await makeHero('Haggle', 'fighter', ['haggler', 'tough']);
    await setGold(hero.id, 10_000);
    const shop = (await get(cookie, '/api/shop')).json();
    expect(shop.stock).toHaveLength(6);
    const offer = shop.stock[0];
    const bought = await post(cookie, '/api/shop/buy', { offer: offer.id });
    expect(bought.json().gold).toBe(-offer.price);
    expect((await post(cookie, '/api/shop/buy', { offer: offer.id })).json().error).toBe('sold_out');
    expect((await get(cookie, '/api/shop')).json().stock[0].soldOut).toBe(true);
    expect(shop.basics.find((b: { id: string }) => b.id === 'potion').price).toBe(23);
  });

  it('buy back anything but Relics, a stack piece by piece', async () => {
    const { cookie, hero } = await makeHero('Seller');
    const epic = await giveGear(hero.id, rollGear(createRng('s1'), { tier: 'epic', itemLevel: 3, identified: true }));
    const relic = await giveGear(hero.id, rollGear(createRng('s2'), { tier: 'relic', itemLevel: 9, identified: true }));
    const potions = await prisma.item.findFirstOrThrow({ where: { heroId: hero.id, base: 'potion' } });
    const sold = await post(cookie, `/api/items/${epic.id}/sell`);
    expect(sold.json().gold).toBe(Math.round(250 * 1.3));
    expect(await prisma.item.findUnique({ where: { id: epic.id } })).toBeNull();
    expect((await post(cookie, `/api/items/${relic.id}/sell`)).json().error).toBe('relic');
    await post(cookie, `/api/items/${potions.id}/sell`, { quantity: 1 });
    expect(await count(hero.id, 'potion')).toBe(1);
  });

  it('deal better with a charming Hero: 4% a point of Charisma modifier, gear counted', async () => {
    const { cookie, hero } = await makeHero('Charmer');
    // Charisma 12 of its own and +2 from a worn ring: 14, a +2 modifier, 8% better.
    await prisma.hero.update({ where: { id: hero.id }, data: { cha: 12 } });
    await prisma.item.create({
      data: { ...gearData(rollGear(createRng('r1'), { tier: 'common', itemLevel: 1, baseId: 'ring', identified: true }), 'test'), seasonId, heroId: hero.id, place: 'WORN', slot: 'ring1', bonusStats: [{ stat: 'cha', value: 2 }] },
    });
    const shop = (await get(cookie, '/api/shop')).json();
    expect(shop.sellRate).toBeCloseTo(1.08);
    expect(shop.hero.gear).toMatchObject({ charm: 8, abilities: { cha: 2 } });
    expect(shop.basics.find((b: { id: string }) => b.id === 'scroll-identify').price).toBe(18);
    const epic = await giveGear(hero.id, rollGear(createRng('s1'), { tier: 'epic', itemLevel: 3, identified: true }));
    expect((await post(cookie, `/api/items/${epic.id}/sell`)).json().gold).toBe(Math.round(Math.round(250 * 1.3) * 1.08));
  });

  it('deals a quarter better to a Hero wearing the Usurper’s Signet', async () => {
    const { cookie, hero } = await makeHero('Usurper');
    await prisma.item.create({
      data: { ...gearData(rollGear(createRng('u1'), { tier: 'mythic', itemLevel: 5, uniqueId: 'usurpers-signet', identified: true }), 'test'), seasonId, heroId: hero.id, place: 'WORN', slot: 'ring1', bonusStats: [] },
    });
    const shop = (await get(cookie, '/api/shop')).json();
    expect(shop.sellRate).toBeCloseTo(1.25);
    const epic = await giveGear(hero.id, rollGear(createRng('s1'), { tier: 'epic', itemLevel: 3, identified: true }));
    expect((await post(cookie, `/api/items/${epic.id}/sell`)).json().gold).toBe(Math.round(Math.round(250 * 1.3) * 1.25));
  });
});

describe('identifying and Chests', () => {
  it('identifies with a scroll, or free for a Wizard', async () => {
    const { cookie, hero } = await makeHero('Reader');
    const rare = await giveGear(hero.id, rollGear(createRng('i1'), { tier: 'rare', itemLevel: 2 }));
    expect((await post(cookie, `/api/items/${rare.id}/identify`)).json().error).toBe('no_identify_scroll');
    await giveStack(hero.id, 'scroll-identify', 1);
    const r = (await post(cookie, `/api/items/${rare.id}/identify`)).json();
    expect(r).toMatchObject({ free: false, item: { identified: true } });
    expect(r.item.bonusStats).toHaveLength(2);
    expect(await count(hero.id, 'scroll-identify')).toBe(0);

    const wiz = await makeHero('Wiz', 'wizard');
    const epic = await giveGear(wiz.hero.id, rollGear(createRng('i2'), { tier: 'epic', itemLevel: 2 }));
    expect((await post(wiz.cookie, `/api/items/${epic.id}/identify`)).json().free).toBe(true);
  });

  it('opens a Chest with its Key, and keeps both when there is no Key', async () => {
    const { cookie, hero } = await makeHero('Opener');
    const chest = await giveStack(hero.id, 'chest-silver', 2);
    expect((await post(cookie, `/api/items/${chest.id}/open`)).json().error).toBe('no_key');
    await giveStack(hero.id, 'key-silver', 1);
    const r = (await post(cookie, `/api/items/${chest.id}/open`)).json();
    expect(r.grade).toBe('silver');
    expect(['rare', 'epic', 'legendary', 'mythic']).toContain(r.prize.tier);
    expect(r.odds.reduce((s: number, o: { percent: number }) => s + o.percent, 0)).toBeCloseTo(100);
    expect(await count(hero.id, 'chest-silver')).toBe(1);
    expect(await count(hero.id, 'key-silver')).toBe(0);
    expect(await prisma.rollLog.count({ where: { kind: 'chest' } })).toBe(1);
  });
});

describe('the Forge', () => {
  it('charges for an Upgrade and leaves the Item in a state that matches the outcome', async () => {
    const { cookie, hero } = await makeHero('Smith');
    for (let i = 0; i < 12; i++) {
      await setGold(hero.id, 1_000_000);
      await prisma.item.deleteMany({ where: { heroId: hero.id, base: { in: ['soulstone', 'scroll-protection'] } } });
      await giveStack(hero.id, 'soulstone', 10);
      await giveStack(hero.id, 'scroll-protection', 1);
      const item = await giveGear(hero.id, rollGear(createRng(`f${i}`), { tier: 'epic', itemLevel: 3, identified: true }));
      await prisma.item.update({ where: { id: item.id }, data: { upgrade: 8 } });
      const quote = (await get(cookie, `/api/items/${item.id}/forge`)).json();
      // 30% to reach +9, and more on a day whose Omen favors the Forge.
      const omen = omenOf(await prisma.season.findFirstOrThrow({ where: { status: { in: ['ACTIVE', 'FINALE'] } } }))?.upgrade ?? 0;
      expect(quote.upgrade).toMatchObject({ to: 9, chance: 30 + omen, risky: true });
      const r = (await post(cookie, `/api/items/${item.id}/upgrade`, { protect: true })).json();
      expect(await gold(hero.id)).toBe(1_000_000 - quote.upgrade.cost.gold);
      expect(await count(hero.id, 'soulstone')).toBe(10 - quote.upgrade.cost.materials[0].quantity);
      expect(r.outcome).not.toBe('destroyed');
      const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
      expect(after.upgrade).toBe({ success: 9, failed: 8, dropped: 7, saved: 7 }[r.outcome as 'success']);
      expect(await count(hero.id, 'scroll-protection')).toBe(r.outcome === 'saved' ? 0 : 1);
    }
  });

  it('won’t work Unidentified Items, salvages into Materials, reforges and crafts', async () => {
    const { cookie, hero } = await makeHero('Salvager');
    const hidden = await giveGear(hero.id, rollGear(createRng('h'), { tier: 'rare', itemLevel: 1 }));
    expect((await get(cookie, `/api/items/${hidden.id}/forge`)).json().blocked).toBe('identify_first');
    expect((await post(cookie, `/api/items/${hidden.id}/upgrade`)).json().error).toBe('identify_first');

    const epic = await giveGear(hero.id, rollGear(createRng('e'), { tier: 'epic', itemLevel: 1, identified: true }));
    const salvaged = (await post(cookie, `/api/items/${epic.id}/salvage`)).json();
    expect(salvaged.got.base).toBe('essence');
    expect(await count(hero.id, 'essence')).toBe(salvaged.got.quantity);

    await setGold(hero.id, 5000);
    await giveStack(hero.id, 'essence', 10);
    const rare = await giveGear(hero.id, rollGear(createRng('r'), { tier: 'rare', itemLevel: 4, identified: true }));
    const reforged = (await post(cookie, `/api/items/${rare.id}/reforge`)).json();
    expect(reforged.item.bonusStats).toHaveLength(2);
    expect(reforged.before).toHaveLength(2);
    expect(await gold(hero.id)).toBe(5000 - 250);

    await giveStack(hero.id, 'scrap', 13);
    expect((await post(cookie, '/api/forge/craft', { recipe: 'key-iron', quantity: 2 })).statusCode).toBe(200);
    expect(await count(hero.id, 'key-iron')).toBe(2);
    expect(await count(hero.id, 'scrap')).toBe(1);
    expect((await post(cookie, '/api/forge/craft', { recipe: 'key-iron' })).json().error).toBe('missing_materials');
  });
});

describe('the Market', () => {
  it('moves the Item and the gold, keeps 5%, and records Relic owners', async () => {
    const seller = await makeHero('Vera');
    const buyer = await makeHero('Bram');
    const relic = await giveGear(seller.hero.id, rollGear(createRng('m'), { tier: 'relic', itemLevel: 9, identified: true }));
    await prisma.item.update({ where: { id: relic.id }, data: { owners: ['Vera'] as Prisma.InputJsonValue, serial: 1 } });

    const listed = (await post(seller.cookie, '/api/market/list', { itemId: relic.id, price: 1000 })).json();
    expect(listed.mine).toHaveLength(1);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: relic.id } })).place).toBe('MARKET');
    expect((await post(seller.cookie, `/api/market/${listed.mine[0].id}/buy`)).json().error).toBe('own_listing');

    const market = (await get(buyer.cookie, '/api/market')).json();
    expect(market.listings).toHaveLength(1);
    expect((await post(buyer.cookie, `/api/market/${market.listings[0].id}/buy`)).json().error).toBe('not_enough_gold');
    await setGold(buyer.hero.id, 1500);
    expect((await post(buyer.cookie, `/api/market/${market.listings[0].id}/buy`)).statusCode).toBe(200);

    const item = await prisma.item.findUniqueOrThrow({ where: { id: relic.id } });
    expect(item).toMatchObject({ heroId: buyer.hero.id, place: 'BAG', owners: ['Vera', 'Bram'] });
    expect(await gold(buyer.hero.id)).toBe(500);
    expect(await gold(seller.hero.id)).toBe(100 + 950);
    expect(await prisma.listing.count()).toBe(0);
    expect(await prisma.feedEvent.count({ where: { kind: 'market-sale' } })).toBe(1);
  });

  it('lets the seller take back a listing, even an expired one nobody can buy', async () => {
    const seller = await makeHero('Oona');
    const buyer = await makeHero('Tam');
    const potions = await prisma.item.findFirstOrThrow({ where: { heroId: seller.hero.id, base: 'potion' } });
    const listing = (await post(seller.cookie, '/api/market/list', { itemId: potions.id, price: 40 })).json().mine[0];
    await prisma.listing.update({ where: { id: listing.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await get(buyer.cookie, '/api/market')).json().listings).toHaveLength(0);
    expect((await post(buyer.cookie, `/api/market/${listing.id}/buy`)).json().error).toBe('listing_expired');
    expect((await post(buyer.cookie, `/api/market/${listing.id}/cancel`)).json().error).toBe('not_yours');
    const back = (await post(seller.cookie, `/api/market/${listing.id}/cancel`)).json();
    expect(back.mine).toHaveLength(0);
    expect(await count(seller.hero.id, 'potion')).toBe(2);
  });
});

describe('the Temple', () => {
  it('sells a Blessing that shows in the Hero’s luck', async () => {
    const { cookie, hero } = await makeHero('Pious');
    const r = (await post(cookie, '/api/temple/bless', { blessing: 'greed' })).json();
    expect(r.hero.luck).toMatchObject({ goldFind: 50, blessing: { id: 'greed' } });
    expect(await gold(hero.id)).toBe(0);
    expect((await post(cookie, '/api/temple/bless', { blessing: 'fortune' })).json().error).toBe('not_enough_gold');
  });
});

describe('the Academy', () => {
  it('teaches a Hero from level 12 up to three more Talents, each dearer than the last', async () => {
    const { cookie, hero } = await makeHero('Scholar');
    await setGold(hero.id, 30_000);
    expect((await post(cookie, '/api/academy/learn', { talent: 'fireproof' })).json().error).toBe('too_green');
    await prisma.hero.update({ where: { id: hero.id }, data: { level: 12 } });
    const view = (await get(cookie, '/api/academy')).json();
    expect(view).toMatchObject({ minLevel: 12, max: 3, learned: [], price: 2000 });
    expect(view.talents.find((t: { id: string }) => t.id === 'alert').known).toBe(true);
    expect((await post(cookie, '/api/academy/learn', { talent: 'alert' })).json().error).toBe('talent_known');

    const first = (await post(cookie, '/api/academy/learn', { talent: 'fireproof' })).json();
    expect(first).toMatchObject({ learned: ['fireproof'], price: 6000 });
    expect(first.hero.talents).toContain('fireproof');
    expect(await gold(hero.id)).toBe(28_000);
    await post(cookie, '/api/academy/learn', { talent: 'iron-will' });
    const third = (await post(cookie, '/api/academy/learn', { talent: 'battle-hardened' })).json();
    expect(third).toMatchObject({ learned: ['fireproof', 'iron-will', 'battle-hardened'], price: null });
    expect(await gold(hero.id)).toBe(30_000 - 2000 - 6000 - 15_000);
    expect((await post(cookie, '/api/academy/learn', { talent: 'scavenger' })).json().error).toBe('academy_done');
  });

  it('teaches only in the City', async () => {
    const { cookie, hero } = await makeHero('Truant');
    await prisma.hero.update({ where: { id: hero.id }, data: { level: 12, gold: 5000, location: 'LABYRINTH', floor: 1, room: 0 } });
    expect((await post(cookie, '/api/academy/learn', { talent: 'fireproof' })).json().error).toBe('not_in_city');
  });
});

describe('the Training grounds', () => {
  it('trains one ability at a time: eight hours away from the Labyrinth and the Well, then +1', async () => {
    const { cookie, hero } = await makeHero('Drill');
    await setGold(hero.id, 20_000);
    const view = (await post(cookie, '/api/training/start', { ability: 'str' })).json();
    expect(view).toMatchObject({ trained: [], price: 1000, current: { ability: 'str' } });
    expect(new Date(view.current.until).getTime()).toBeGreaterThan(Date.now() + 7.9 * 3600_000);
    expect(view.hero.training).toMatchObject({ ability: 'str' });
    expect(await gold(hero.id)).toBe(19_000);
    // Meanwhile: no Labyrinth, no Well, and no second training.
    expect((await post(cookie, '/api/labyrinth/enter', { floor: 1 })).json().error).toBe('training');
    expect((await post(cookie, '/api/delve/start')).json().error).toBe('training');
    expect((await post(cookie, '/api/training/start', { ability: 'dex' })).json().error).toBe('already_training');
    // The hours pass: the +1 lands on the next look, once.
    await prisma.hero.update({ where: { id: hero.id }, data: { trainingUntil: new Date(Date.now() - 1000) } });
    const done = (await get(cookie, '/api/training')).json();
    expect(done).toMatchObject({ trained: ['str'], price: 3000, current: null });
    expect(done.hero.abilities.str).toBe(hero.str + 1);
    expect((await get(cookie, '/api/training')).json().hero.abilities.str).toBe(hero.str + 1);
    expect((await post(cookie, '/api/labyrinth/enter', { floor: 1 })).statusCode).toBe(200);
  });

  it('lands the +1 by itself when the hours are up', async () => {
    const { cookie, hero } = await makeHero('Sleeper');
    await setGold(hero.id, 1000);
    await post(cookie, '/api/training/start', { ability: 'con' });
    await runDueJobs(new Date(Date.now() + 8 * 3600_000 + 1000));
    const after = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });
    expect(after).toMatchObject({ con: hero.con + 1, trained: ['con'], training: null, trainingUntil: null });
  });

  it('stops at 20 and after three trainings, and only in the City', async () => {
    const { cookie, hero } = await makeHero('Maxed');
    await prisma.hero.update({ where: { id: hero.id }, data: { gold: 50_000, str: 20, trained: ['dex', 'dex', 'con'] } });
    expect((await post(cookie, '/api/training/start', { ability: 'str' })).json().error).toBe('ability_max');
    expect((await post(cookie, '/api/training/start', { ability: 'wis' })).json().error).toBe('training_done');
    await prisma.hero.update({ where: { id: hero.id }, data: { trained: [], location: 'LABYRINTH', floor: 1, room: 0 } });
    expect((await post(cookie, '/api/training/start', { ability: 'wis' })).json().error).toBe('not_in_city');
  });
});

describe('selling and Salvage in bulk', () => {
  /** A Bag holding what a bulk sale up to Rare takes, and what it must leave. */
  async function mixedBag(heroId: string) {
    // Never Radiant by chance (1 in 200): bulk selling keeps Radiant Items, which the test sets up on purpose below.
    const roll = (tier: 'common' | 'uncommon' | 'rare' | 'epic', identified = true) =>
      rollGear(createRng(`bulk-${tier}-${Math.random()}`), { tier, itemLevel: 2, identified, radiant: false });
    const taken = [await giveGear(heroId, roll('common')), await giveGear(heroId, roll('uncommon')), await giveGear(heroId, roll('rare'))];
    const above = await giveGear(heroId, roll('epic'));
    const unseen = await giveGear(heroId, roll('rare', false));
    const upgraded = await giveGear(heroId, roll('common'));
    const radiant = await giveGear(heroId, roll('uncommon'));
    const ring = await giveGear(heroId, roll('rare'));
    const stored = await giveGear(heroId, roll('common'), 'STORAGE');
    await prisma.item.update({ where: { id: upgraded.id }, data: { upgrade: 2 } });
    await prisma.item.update({ where: { id: radiant.id }, data: { radiant: true } });
    await prisma.item.update({ where: { id: ring.id }, data: { base: 'bond-ring' } });
    const potions = await giveStack(heroId, 'potion', 3);
    return { taken, kept: [above, unseen, upgraded, radiant, ring, stored, potions] };
  }
  const left = (ids: { id: string }[]) => prisma.item.count({ where: { id: { in: ids.map((i) => i.id) } } });

  it('sells every Bag Item up to a Tier for what the screen shows, and leaves the rest', async () => {
    const { cookie, hero } = await makeHero('Hoarder');
    await setGold(hero.id, 0);
    const { taken, kept } = await mixedBag(hero.id);
    const shop = (await get(cookie, '/api/shop')).json();
    const shown = (shop.hero.bag as { id: string; worth: number }[])
      .filter((i) => taken.some((t) => t.id === i.id))
      .reduce((sum, i) => sum + Math.round(i.worth * shop.sellRate), 0);
    const r = (await post(cookie, '/api/shop/sell-bulk', { upTo: 'rare' })).json();
    expect(r.sold).toBe(3);
    expect(r.gold).toBe(shown);
    expect(await gold(hero.id)).toBe(shown);
    expect(await left(taken)).toBe(0);
    expect(await left(kept)).toBe(kept.length);
  });

  it('salvages every Bag Item up to a Tier into Materials, and leaves the rest', async () => {
    const { cookie, hero } = await makeHero('Smelter');
    const { taken, kept } = await mixedBag(hero.id);
    const r = (await post(cookie, '/api/forge/salvage-bulk', { upTo: 'rare' })).json();
    expect(r.salvaged).toBe(3);
    expect(await left(taken)).toBe(0);
    expect(await left(kept)).toBe(kept.length);
    // A Common and an Uncommon give 3–6 Scrap; a Rare 1–2 Essence.
    const got = Object.fromEntries((r.got as { base: string; quantity: number }[]).map((g) => [g.base, g.quantity]));
    expect(got.scrap).toBeGreaterThanOrEqual(3);
    expect(got.scrap).toBeLessThanOrEqual(6);
    expect(got.essence).toBeGreaterThanOrEqual(1);
    expect(got.essence).toBeLessThanOrEqual(2);
    expect(await count(hero.id, 'scrap')).toBe(got.scrap);
  });

  it('never reaches past Epic, and works only in the City', async () => {
    const { cookie, hero } = await makeHero('Careful');
    expect((await post(cookie, '/api/shop/sell-bulk', { upTo: 'legendary' })).statusCode).toBe(400);
    await prisma.hero.update({ where: { id: hero.id }, data: { location: 'LABYRINTH', floor: 1, room: 0 } });
    expect((await post(cookie, '/api/forge/salvage-bulk', { upTo: 'common' })).json().error).toBe('not_in_city');
  });
});

describe('nothing can be duplicated', () => {
  it('sells one listing to exactly one of two racing buyers', async () => {
    const seller = await makeHero('Sly');
    const a = await makeHero('Ann');
    const b = await makeHero('Ben');
    const epic = await giveGear(seller.hero.id, rollGear(createRng('race'), { tier: 'epic', itemLevel: 2, identified: true }));
    const listing = (await post(seller.cookie, '/api/market/list', { itemId: epic.id, price: 500 })).json().mine[0];
    await setGold(a.hero.id, 1000);
    await setGold(b.hero.id, 1000);
    const results = await Promise.all([
      post(a.cookie, `/api/market/${listing.id}/buy`),
      post(b.cookie, `/api/market/${listing.id}/buy`),
      post(seller.cookie, `/api/market/${listing.id}/cancel`),
    ]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await prisma.item.count({ where: { id: epic.id } })).toBe(1);
    const total = (await gold(a.hero.id)) + (await gold(b.hero.id)) + (await gold(seller.hero.id));
    // Either a sale (500 left the buyers, 475 reached the seller) or a take-back (nothing moved).
    expect([100 + 2000 - 25, 100 + 2000]).toContain(total);
  });

  it('pays once when the same Item is sold twice at once', async () => {
    const { cookie, hero } = await makeHero('Double');
    const epic = await giveGear(hero.id, rollGear(createRng('twice'), { tier: 'epic', itemLevel: 1, identified: true }));
    const results = await Promise.all([1, 2, 3].map(() => post(cookie, `/api/items/${epic.id}/sell`)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await gold(hero.id)).toBe(100 + Math.round(250 * 1.1));
  });

  it('opens two Chests with one Key only once', async () => {
    const { cookie, hero } = await makeHero('Keys');
    const chest = await giveStack(hero.id, 'chest-iron', 2);
    await giveStack(hero.id, 'key-iron', 1);
    const results = await Promise.all([post(cookie, `/api/items/${chest.id}/open`), post(cookie, `/api/items/${chest.id}/open`)]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await count(hero.id, 'chest-iron')).toBe(1);
  });

  it('spends gold once when buying in parallel', async () => {
    const { cookie, hero } = await makeHero('Spender');
    await setGold(hero.id, 60);
    const results = await Promise.all([1, 2, 3].map(() => post(cookie, '/api/shop/buy', { offer: 'scroll-portal' })));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await gold(hero.id)).toBe(10);
    expect(await count(hero.id, 'scroll-portal')).toBe(1);
  });
});
