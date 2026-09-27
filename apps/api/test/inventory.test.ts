import type { FastifyInstance } from 'fastify';
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
  it('swaps the worn weapon with one from the Bag', async () => {
    const hero = await newRogue();
    const bow = hero.bag.find((i) => i.base === 'shortbow')!;
    const after: HeroJson = (await post(`/api/items/${bow.id}/equip`)).json().hero;
    expect(after.worn.find((w) => w.slot === 'main')?.item.base).toBe('shortbow');
    expect(after.bag.map((i) => i.base).sort()).toEqual(['potion', 'rapier']);
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
    const bow = hero.bag.find((i) => i.base === 'shortbow')!;
    await prisma.item.update({ where: { id: bow.id }, data: { tier: 'relic' } });
    expect((await post(`/api/items/${bow.id}/drop`)).json().error).toBe('relic_kept');
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
