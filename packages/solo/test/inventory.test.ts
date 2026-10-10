// Ported from apps/api/test/inventory.test.ts: the same scenario, on the solo backend.
import { readFileSync } from 'node:fs';
import type { SoloApp as FastifyInstance } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { devLogin, resetDatabase } from './helpers.js';

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const post = (url: string, payload: object = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
type ItemJson = { id: string; base: string; quantity: number };
type HeroJson = { worn: { slot: string; item: ItemJson }[]; bag: ItemJson[]; storage: ItemJson[]; armorClass: number };

async function newRogue(): Promise<HeroJson> {
  await post('/api/heroes/draft');
  const response = await post('/api/heroes', {
    name: 'Pip', race: 'halfling', class: 'rogue', talents: ['lucky-charm'], portrait: 'hooded', banner: '#3f7a4a', set: 0,
  });
  return response.json().hero;
}

beforeEach(async () => {
  await resetDatabase();
  cookie = await devLogin(app, 'Owner', true);
});

describe('inventory', () => {
  /** Puts a fresh identified Common piece of gear in the Hero's Bag. */
  async function give(base: string): Promise<string> {
    const hero = await prisma.hero.findFirstOrThrow();
    return (await prisma.item.create({ data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base, tier: 'common', quality: 50 } })).id;
  }
  const held = (hero: HeroJson) => hero.worn.filter((w) => w.slot === 'main' || w.slot === 'off').map((w) => `${w.slot}:${w.item.base}`);

  it('swaps the worn weapon with one from the Bag', async () => {
    await newRogue();
    const saber = await give('saber');
    const after: HeroJson = (await post(`/api/items/${saber}/equip`)).json().hero;
    expect(held(after)).toEqual(['main:saber', 'off:dagger']);
    expect(after.bag.map((i) => i.base).sort()).toEqual(['potion', 'rapier']);
  });

  it('takes the off-hand dagger off for a bow, and a dagger goes in the hand asked for', async () => {
    await newRogue();
    const bow = await give('shortbow');
    let hero: HeroJson = (await post(`/api/items/${bow}/equip`)).json().hero;
    expect(held(hero)).toEqual(['main:shortbow']);
    expect(hero.bag.map((i) => i.base).sort()).toEqual(['dagger', 'potion', 'rapier']);
    // A dagger asked for in the off-hand puts the two-handed bow away.
    const dagger = hero.bag.find((i) => i.base === 'dagger')!;
    hero = (await post(`/api/items/${dagger.id}/equip`, { slot: 'off' })).json().hero;
    expect(held(hero)).toEqual(['off:dagger']);
    const rapier = hero.bag.find((i) => i.base === 'rapier')!;
    hero = (await post(`/api/items/${rapier.id}/equip`)).json().hero;
    expect(held(hero)).toEqual(['main:rapier', 'off:dagger']);
    // Another dagger, asked for in the main hand, swaps with the rapier.
    const second = await give('dagger');
    hero = (await post(`/api/items/${second}/equip`, { slot: 'main' })).json().hero;
    expect(held(hero)).toEqual(['main:dagger', 'off:dagger']);
    expect((await post(`/api/items/${await give('shield')}/equip`)).json().error).toBe('not_proficient');
    expect((await post(`/api/items/${await give('rapier')}/equip`, { slot: 'off' })).json().error).toBe('wrong_slot');
  });

  it('needs room for both hands’ pieces when a two-handed weapon replaces them', async () => {
    await newRogue();
    const bow = await give('longbow');
    const hero = await prisma.hero.findFirstOrThrow();
    // Fill the Bag: the potion stack, the bow and 18 more.
    for (let i = 0; i < 18; i++) await prisma.item.create({ data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base: 'ring', tier: 'common', quality: 50 } });
    expect((await post(`/api/items/${bow}/equip`)).json().error).toBe('hands_full');
    const ring = await prisma.item.findFirstOrThrow({ where: { heroId: hero.id, base: 'ring' } });
    await post(`/api/items/${ring.id}/drop`);
    const after: HeroJson = (await post(`/api/items/${bow}/equip`)).json().hero;
    expect(held(after)).toEqual(['main:longbow']);
  });

  // A Postgres data migration on the server's live rows; solo saves start after it.
  it.skip('moves a shield worn beside a two-handed weapon back to the Bag (the hands migration)', async () => {
    await newRogue();
    const hero = await prisma.hero.findFirstOrThrow();
    // Before hands: a greatsword and a shield worn together.
    await prisma.item.deleteMany({ where: { heroId: hero.id, slot: { in: ['main', 'off'] } } });
    await prisma.item.create({ data: { seasonId: hero.seasonId, heroId: hero.id, place: 'WORN', slot: 'main', base: 'greatsword', tier: 'common', quality: 50 } });
    const shield = await prisma.item.create({ data: { seasonId: hero.seasonId, heroId: hero.id, place: 'WORN', slot: 'off', base: 'shield', tier: 'common', quality: 50 } });
    const sql = readFileSync(new URL('../prisma/migrations/20261007180000_two_handed/migration.sql', import.meta.url), 'utf8');
    await prisma.$executeRawUnsafe(sql);
    expect(await prisma.item.findUniqueOrThrow({ where: { id: shield.id } })).toMatchObject({ place: 'BAG', slot: null });
    expect(await prisma.item.count({ where: { heroId: hero.id, place: 'WORN', slot: 'main', base: 'greatsword' } })).toBe(1);
  });

  it('takes gear off into the Bag and changes Armor Class', async () => {
    const hero = await newRogue();
    const armor = hero.worn.find((w) => w.slot === 'body')!.item;
    const after: HeroJson = (await post(`/api/items/${armor.id}/unequip`)).json().hero;
    expect(after.worn.some((w) => w.slot === 'body')).toBe(false);
    expect(after.bag.some((i) => i.id === armor.id)).toBe(true);
    expect(after.armorClass).toBeLessThan(hero.armorClass);
  });

  it('refuses gear the Class cannot use', async () => {
    await newRogue();
    const hero = await prisma.hero.findFirstOrThrow();
    const plate = await prisma.item.create({
      data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base: 'plate', tier: 'common', quality: 50 },
    });
    const response = await post(`/api/items/${plate.id}/equip`);
    expect(response.json().error).toBe('not_proficient');
  });

  it('refuses to wear an Unidentified Item', async () => {
    await newRogue();
    const hero = await prisma.hero.findFirstOrThrow();
    const dagger = await prisma.item.create({
      data: { seasonId: hero.seasonId, heroId: hero.id, place: 'BAG', base: 'dagger', tier: 'rare', quality: 70, identified: false },
    });
    expect((await post(`/api/items/${dagger.id}/equip`)).json().error).toBe('identify_first');
  });

  it('moves between Bag and Storage and merges stacks', async () => {
    const hero = await newRogue();
    const potions = hero.bag.find((i) => i.base === 'potion')!;
    const stored: HeroJson = (await post(`/api/items/${potions.id}/move`, { to: 'storage' })).json().hero;
    expect(stored.storage).toEqual([expect.objectContaining({ base: 'potion', quantity: 2 })]);

    const h = await prisma.hero.findFirstOrThrow();
    const more = await prisma.item.create({ data: { seasonId: h.seasonId, heroId: h.id, place: 'BAG', base: 'potion', tier: 'common', quantity: 3 } });
    const merged: HeroJson = (await post(`/api/items/${more.id}/move`, { to: 'storage' })).json().hero;
    expect(merged.storage).toEqual([expect.objectContaining({ base: 'potion', quantity: 5 })]);
    expect(merged.bag.some((i) => i.base === 'potion')).toBe(false);
  });

  it('drops a whole stack from the Bag for good, but never worn gear or a Relic', async () => {
    const hero = await newRogue();
    const potions = hero.bag.find((i) => i.base === 'potion')!;
    const after: HeroJson = (await post(`/api/items/${potions.id}/drop`)).json().hero;
    expect(after.bag.some((i) => i.base === 'potion')).toBe(false);
    expect(await prisma.item.count({ where: { id: potions.id } })).toBe(0);

    const worn = hero.worn[0]!.item;
    expect((await post(`/api/items/${worn.id}/drop`)).json().error).toBe('not_in_bag');
    const bow = await give('shortbow');
    await prisma.item.update({ where: { id: bow }, data: { tier: 'relic' } });
    expect((await post(`/api/items/${bow}/drop`)).json().error).toBe('relic_kept');
  });

  it('will not touch another Player’s Items', async () => {
    const hero = await newRogue();
    cookie = await devLogin(app, 'Thief', true);
    expect((await post(`/api/items/${hero.worn[0]!.item.id}/unequip`)).json().error).toBe('no_hero');
    await newRogue();
    const response = await post(`/api/items/${hero.worn[0]!.item.id}/unequip`);
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('item_not_found');
  });
});
