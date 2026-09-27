import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type GearRoll, createRng, rollGear } from '@dark/engine';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { gearData } from '../src/services/items.js';
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
  const hero = await prisma.hero.findFirstOrThrow({ where: { name } });
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
      expect(quote.upgrade).toMatchObject({ to: 9, chance: 30, risky: true });
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
